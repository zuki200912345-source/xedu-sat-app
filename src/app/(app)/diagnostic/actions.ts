"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isResponseCorrect } from "@/lib/scoring";
import { toRunnerQuestion, type RunnerQuestion } from "@/lib/serialize";
import { awardXp, grantBadge, touchStreak } from "@/lib/gamification";

const TOTAL = 20; // 10 R&W + 10 Math, alternating

/** Lazily get (or create) the singleton DIAGNOSTIC test + its placeholder module. */
async function getDiagnosticModuleId(): Promise<string> {
  let test = await prisma.test.findFirst({
    where: { kind: "DIAGNOSTIC" },
    include: { modules: true },
  });
  if (!test) {
    test = await prisma.test.create({
      data: {
        title: "Adaptive Diagnostic",
        kind: "DIAGNOSTIC",
        description: "20-question adaptive diagnostic",
        isPublished: true,
        modules: { create: { section: "RW", order: 1, path: "BASE" } },
      },
      include: { modules: true },
    });
  }
  return test.modules[0].id;
}

/** Start (or resume) a diagnostic attempt. Returns the attempt id. */
export async function startDiagnostic(): Promise<string> {
  const user = await requireUser();
  const moduleId = await getDiagnosticModuleId();

  const test = await prisma.test.findFirstOrThrow({ where: { kind: "DIAGNOSTIC" } });
  const existing = await prisma.testAttempt.findFirst({
    where: { userId: user.id, testId: test.id, status: "IN_PROGRESS" },
    include: { moduleAttempts: true },
  });
  if (existing) return existing.id;

  const attempt = await prisma.testAttempt.create({
    data: {
      userId: user.id,
      testId: test.id,
      status: "IN_PROGRESS",
      moduleAttempts: { create: { moduleId } },
    },
  });
  return attempt.id;
}

const nextSchema = z.object({
  attemptId: z.string().min(1),
  prev: z.object({ questionId: z.string(), response: z.string().nullable() }).nullable(),
});

/**
 * Adaptive step: record the previous answer, then serve the next question.
 * Difficulty is chosen IRT-style from the running accuracy in that section
 * (>=70% → hard, >=40% → medium, else easy). Sections alternate to cover both.
 */
export async function nextDiagnosticQuestion(
  input: z.infer<typeof nextSchema>,
): Promise<{ done: true } | { done: false; index: number; total: number; question: RunnerQuestion }> {
  const user = await requireUser();
  const { attemptId, prev } = nextSchema.parse(input);

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: { moduleAttempts: { include: { answers: true } } },
  });
  if (!attempt || attempt.userId !== user.id) throw new Error("FORBIDDEN");
  const ma = attempt.moduleAttempts[0];

  // Save the previous answer.
  if (prev) {
    const q = await prisma.question.findUnique({
      where: { id: prev.questionId },
      select: { type: true, correctAnswer: true },
    });
    if (q) {
      const correct = isResponseCorrect(q.type, q.correctAnswer, prev.response);
      await prisma.answer.upsert({
        where: { moduleAttemptId_questionId: { moduleAttemptId: ma.id, questionId: prev.questionId } },
        create: { moduleAttemptId: ma.id, questionId: prev.questionId, response: prev.response, isCorrect: correct },
        update: { response: prev.response, isCorrect: correct },
      });
    }
  }

  const answered = await prisma.answer.findMany({
    where: { moduleAttemptId: ma.id },
    include: { question: { select: { section: true } } },
  });
  const index = answered.length; // how many answered so far
  if (index >= TOTAL) return { done: true };

  // Alternate sections; 10 each.
  const section = index % 2 === 0 ? "RW" : "MATH";
  const sectionAnswers = answered.filter((a) => a.question.section === section);
  const acc =
    sectionAnswers.length === 0
      ? 0.5
      : sectionAnswers.filter((a) => a.isCorrect).length / sectionAnswers.length;
  const difficulty = acc >= 0.7 ? "hard" : acc >= 0.4 ? "medium" : "easy";

  const askedIds = answered.map((a) => a.questionId);
  // Try the target difficulty, then fall back to any difficulty in the section.
  let pool = await prisma.question.findMany({
    where: { section, difficulty, status: "PUBLISHED", id: { notIn: askedIds } },
    include: { passage: true },
    take: 25,
  });
  if (pool.length === 0) {
    pool = await prisma.question.findMany({
      where: { section, status: "PUBLISHED", id: { notIn: askedIds } },
      include: { passage: true },
      take: 25,
    });
  }
  if (pool.length === 0) return { done: true };

  const picked = pool[Math.floor(Math.random() * pool.length)];
  return {
    done: false,
    index: index + 1,
    total: TOTAL,
    question: toRunnerQuestion(picked, index + 1),
  };
}

/** Finalize the diagnostic: score, estimate bands, update mastery, award XP. */
export async function submitDiagnostic(attemptId: string): Promise<{ attemptId: string }> {
  const user = await requireUser();
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: { moduleAttempts: { include: { answers: { include: { question: true } } } } },
  });
  if (!attempt || attempt.userId !== user.id) throw new Error("FORBIDDEN");
  const answers = attempt.moduleAttempts[0].answers;

  const weight: Record<string, number> = { easy: 1, medium: 1.5, hard: 2 };
  const bands: Record<string, number> = {};
  const mastery = new Map<string, { section: string; attempts: number; correct: number }>();

  for (const section of ["RW", "MATH"] as const) {
    const secAns = answers.filter((a) => a.question.section === section);
    let earned = 0;
    let possible = 0;
    for (const a of secAns) {
      const w = weight[a.question.difficulty] ?? 1;
      possible += w;
      if (a.isCorrect) earned += w;
    }
    const ratio = possible === 0 ? 0.4 : earned / possible;
    // Map to 200–800, rounded to nearest 10.
    bands[section] = Math.round((200 + ratio * 600) / 10) * 10;
  }

  for (const a of answers) {
    const m = mastery.get(a.question.skill) ?? { section: a.question.section, attempts: 0, correct: 0 };
    m.attempts++;
    if (a.isCorrect) m.correct++;
    mastery.set(a.question.skill, m);
  }
  for (const [skill, d] of mastery) {
    await prisma.skillMastery.upsert({
      where: { userId_skill: { userId: user.id, skill } },
      create: { userId: user.id, skill, section: d.section, attempts: d.attempts, correct: d.correct },
      update: {
        attempts: { increment: d.attempts },
        correct: { increment: d.correct },
        section: d.section,
        lastSeen: new Date(),
      },
    });
  }

  await prisma.moduleAttempt.update({
    where: { id: attempt.moduleAttempts[0].id },
    data: { rawCorrect: answers.filter((a) => a.isCorrect).length, completedAt: new Date() },
  });
  await prisma.testAttempt.update({
    where: { id: attemptId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      rwScaled: bands.RW,
      mathScaled: bands.MATH,
      scaledTotal: (bands.RW ?? 0) + (bands.MATH ?? 0),
    },
  });

  await awardXp(user.id, 40);
  await touchStreak(user.id);
  await grantBadge(user.id, "diagnostic_done");

  return { attemptId };
}
