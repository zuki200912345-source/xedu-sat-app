"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isResponseCorrect } from "@/lib/scoring";
import { captureMistake, resolveMistake } from "@/lib/mistakes";
import { logTrainingEvent } from "@/lib/training";

/**
 * Start (or resume) a practice attempt for a single-module drill test. Returns
 * the attempt + module-attempt ids the runner uses for autosave.
 */
export async function startPracticeAttempt(testId: string) {
  const user = await requireUser();

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { modules: { orderBy: { order: "asc" } } },
  });
  if (!test || !test.isPublished) throw new Error("Test not found");
  const mod = test.modules[0];
  if (!mod) throw new Error("Test has no module");

  // Resume an in-progress attempt if one exists.
  const existing = await prisma.testAttempt.findFirst({
    where: { userId: user.id, testId, status: "IN_PROGRESS" },
    include: { moduleAttempts: true },
  });
  if (existing) {
    const ma =
      existing.moduleAttempts[0] ??
      (await prisma.moduleAttempt.create({
        data: { attemptId: existing.id, moduleId: mod.id },
      }));
    return { attemptId: existing.id, moduleAttemptId: ma.id };
  }

  const attempt = await prisma.testAttempt.create({
    data: {
      userId: user.id,
      testId,
      status: "IN_PROGRESS",
      moduleAttempts: { create: { moduleId: mod.id } },
    },
    include: { moduleAttempts: true },
  });
  return { attemptId: attempt.id, moduleAttemptId: attempt.moduleAttempts[0].id };
}

const saveSchema = z.object({
  moduleAttemptId: z.string().min(1),
  questionId: z.string().min(1),
  response: z.string().nullable(),
  secondsSpent: z.number().int().min(0).max(60 * 60 * 4),
  flagged: z.boolean(),
  eliminated: z.array(z.string()).max(4),
});

const progressSchema = z.object({
  moduleAttemptId: z.string().min(1),
  secondsRemaining: z.number().int().min(0).max(60 * 60 * 4),
});

async function requireOpenModuleAttempt(moduleAttemptId: string, userId: string) {
  const moduleAttempt = await prisma.moduleAttempt.findUnique({
    where: { id: moduleAttemptId },
    include: { attempt: true },
  });
  if (!moduleAttempt || moduleAttempt.attempt.userId !== userId) throw new Error("FORBIDDEN");
  if (moduleAttempt.attempt.status !== "IN_PROGRESS" || moduleAttempt.completedAt) {
    throw new Error("Attempt is closed");
  }
  return moduleAttempt;
}

/** Auto-save a single answer. Correctness is NOT computed or returned here. */
export async function saveAnswer(input: z.infer<typeof saveSchema>) {
  const user = await requireUser();
  const data = saveSchema.parse(input);

  // Authorize: the module attempt must belong to this user's attempt.
  await requireOpenModuleAttempt(data.moduleAttemptId, user.id);

  await prisma.answer.upsert({
    where: {
      moduleAttemptId_questionId: {
        moduleAttemptId: data.moduleAttemptId,
        questionId: data.questionId,
      },
    },
    create: {
      moduleAttemptId: data.moduleAttemptId,
      questionId: data.questionId,
      response: data.response,
      secondsSpent: data.secondsSpent,
      flagged: data.flagged,
      eliminated: JSON.stringify(data.eliminated),
    },
    update: {
      response: data.response,
      secondsSpent: data.secondsSpent,
      flagged: data.flagged,
      eliminated: JSON.stringify(data.eliminated),
    },
  });
  return { ok: true };
}

/** Save the timed-module clock so a student can leave and resume safely. */
export async function saveModuleProgress(input: z.infer<typeof progressSchema>) {
  const user = await requireUser();
  const data = progressSchema.parse(input);
  await requireOpenModuleAttempt(data.moduleAttemptId, user.id);
  await prisma.moduleAttempt.update({
    where: { id: data.moduleAttemptId },
    data: { secondsRemaining: data.secondsRemaining },
  });
  return { ok: true };
}

/** Clear only the active module, preserving any earlier completed test modules. */
export async function restartModuleAttempt(moduleAttemptId: string) {
  const user = await requireUser();
  await requireOpenModuleAttempt(moduleAttemptId, user.id);

  await prisma.$transaction([
    prisma.answer.deleteMany({ where: { moduleAttemptId } }),
    prisma.moduleAttempt.update({
      where: { id: moduleAttemptId },
      data: {
        rawCorrect: null,
        routedPath: null,
        secondsRemaining: null,
        startedAt: new Date(),
      },
    }),
  ]);
  return { ok: true };
}

/**
 * Finish a practice attempt: grade every answer server-side, update skill
 * mastery, and mark the attempt completed. Returns the attempt id for the
 * review page.
 */
export async function finishPracticeAttempt(attemptId: string) {
  const user = await requireUser();

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      moduleAttempts: {
        include: {
          module: { include: { questions: true } },
          answers: true,
        },
      },
    },
  });
  if (!attempt || attempt.userId !== user.id) throw new Error("FORBIDDEN");
  if (attempt.status === "COMPLETED") return { attemptId };

  const ma = attempt.moduleAttempts[0];
  const questionIds = ma.module.questions.map((mq) => mq.questionId);
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, type: true, correctAnswer: true, section: true, skill: true },
  });

  let rawCorrect = 0;
  const masteryDelta = new Map<string, { section: string; attempts: number; correct: number }>();

  for (const q of questions) {
    const answer = ma.answers.find((a) => a.questionId === q.id);
    const correct = isResponseCorrect(q.type, q.correctAnswer, answer?.response ?? null);
    if (correct) rawCorrect++;

    // Persist graded correctness on the answer (create a blank one if skipped).
    await prisma.answer.upsert({
      where: {
        moduleAttemptId_questionId: { moduleAttemptId: ma.id, questionId: q.id },
      },
      create: {
        moduleAttemptId: ma.id,
        questionId: q.id,
        response: answer?.response ?? null,
        isCorrect: correct,
        secondsSpent: answer?.secondsSpent ?? 0,
        flagged: answer?.flagged ?? false,
      },
      update: { isCorrect: correct },
    });

    // Mistake notebook: capture wrong answers, resolve ones now answered right.
    const answered = answer?.response != null && answer.response !== "";
    if (correct) await resolveMistake(user.id, q.id);
    else if (answered) await captureMistake({ userId: user.id, questionId: q.id, source: "practice", response: answer?.response ?? null });

    const m = masteryDelta.get(q.skill) ?? { section: q.section, attempts: 0, correct: 0 };
    m.attempts++;
    if (correct) m.correct++;
    masteryDelta.set(q.skill, m);
  }

  // Training corpus: the full graded response set for this attempt.
  logTrainingEvent(user.id, "attempt_completed", {
    attemptId,
    rawCorrect,
    total: questions.length,
    responses: questions.map((q) => {
      const answer = ma.answers.find((a) => a.questionId === q.id);
      return {
        questionId: q.id,
        skill: q.skill,
        section: q.section,
        response: answer?.response ?? null,
        correct: isResponseCorrect(q.type, q.correctAnswer, answer?.response ?? null),
        secondsSpent: answer?.secondsSpent ?? 0,
      };
    }),
  });

  // Update per-skill mastery counters.
  for (const [skill, d] of masteryDelta) {
    await prisma.skillMastery.upsert({
      where: { userId_skill: { userId: user.id, skill } },
      create: {
        userId: user.id,
        skill,
        section: d.section,
        attempts: d.attempts,
        correct: d.correct,
      },
      update: {
        attempts: { increment: d.attempts },
        correct: { increment: d.correct },
        section: d.section,
        lastSeen: new Date(),
      },
    });
  }

  await prisma.moduleAttempt.update({
    where: { id: ma.id },
    data: { rawCorrect, completedAt: new Date() },
  });
  await prisma.testAttempt.update({
    where: { id: attempt.id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  // Award XP for completing a practice module, and count a useful interaction.
  await prisma.user.update({
    where: { id: user.id },
    data: { xp: { increment: 10 + rawCorrect * 2 }, usefulInteractions: { increment: 1 } },
  });

  revalidatePath("/practice");
  revalidatePath("/dashboard");
  return { redirect: `/practice/review/${attempt.id}` };
}
