"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isResponseCorrect } from "@/lib/scoring";
import { captureMistake, resolveMistake } from "@/lib/mistakes";
import { routeTier } from "@/lib/sat-engine/router";
import { scoreSection } from "@/lib/sat-engine/scorer";
import { questionsPerModule, type Section } from "@/lib/sat-engine/spec";
import { activeModuleAttempt } from "@/lib/full-test";

/**
 * Start (or resume) a full adaptive test. Full tests are a paid feature, so
 * this is gated to PLUS/PREMIUM. Creates the first module attempt (R&W M1).
 */
export async function startFullTest(testId: string): Promise<string> {
  const user = await requireUser();

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { modules: true },
  });
  if (!test || !test.isPublished || test.kind !== "FULL") throw new Error("Test not found");

  const existing = await prisma.testAttempt.findFirst({
    where: { userId: user.id, testId, status: { in: ["IN_PROGRESS", "BREAK"] } },
  });
  if (existing) return existing.id;

  const rwM1 = test.modules.find((m) => m.section === "RW" && m.order === 1);
  if (!rwM1) throw new Error("Test is missing its first module");

  const attempt = await prisma.testAttempt.create({
    data: {
      userId: user.id,
      testId,
      status: "IN_PROGRESS",
      moduleAttempts: { create: { moduleId: rwM1.id } },
    },
  });
  return attempt.id;
}

/** Grade all answers of one module attempt and return raw-correct count. */
async function gradeModule(moduleAttemptId: string): Promise<{ rawCorrect: number; section: string }> {
  const ma = await prisma.moduleAttempt.findUniqueOrThrow({
    where: { id: moduleAttemptId },
    include: {
      module: { include: { questions: true } },
      answers: true,
    },
  });
  const questionIds = ma.module.questions.map((mq) => mq.questionId);
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, type: true, correctAnswer: true, section: true, skill: true },
  });

  let rawCorrect = 0;
  const mastery = new Map<string, { section: string; attempts: number; correct: number }>();

  const gotRight: string[] = [];
  const gotWrong: { id: string; response: string | null }[] = [];

  for (const q of questions) {
    const ans = ma.answers.find((a) => a.questionId === q.id);
    const correct = isResponseCorrect(q.type, q.correctAnswer, ans?.response ?? null);
    if (correct) rawCorrect++;

    await prisma.answer.upsert({
      where: { moduleAttemptId_questionId: { moduleAttemptId: ma.id, questionId: q.id } },
      create: {
        moduleAttemptId: ma.id,
        questionId: q.id,
        response: ans?.response ?? null,
        isCorrect: correct,
        secondsSpent: ans?.secondsSpent ?? 0,
        flagged: ans?.flagged ?? false,
      },
      update: { isCorrect: correct },
    });

    const answered = ans?.response != null && ans.response !== "";
    if (correct) gotRight.push(q.id);
    else if (answered) gotWrong.push({ id: q.id, response: ans?.response ?? null });

    const m = mastery.get(q.skill) ?? { section: q.section, attempts: 0, correct: 0 };
    m.attempts++;
    if (correct) m.correct++;
    mastery.set(q.skill, m);
  }

  const userId = (await prisma.moduleAttempt.findUniqueOrThrow({
    where: { id: ma.id },
    include: { attempt: true },
  })).attempt.userId;

  // Mistake notebook: capture wrong answers, resolve ones now answered right.
  for (const id of gotRight) await resolveMistake(userId, id);
  for (const w of gotWrong) await captureMistake({ userId, questionId: w.id, source: "mock", response: w.response });

  for (const [skill, d] of mastery) {
    await prisma.skillMastery.upsert({
      where: { userId_skill: { userId, skill } },
      create: { userId, skill, section: d.section, attempts: d.attempts, correct: d.correct },
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

  return { rawCorrect, section: ma.module.section };
}

/** Parse a tier number out of a Module 2 path like "TIER4". */
function tierFromPath(path: string): number {
  const n = parseInt(path.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 3;
}

/**
 * Submit the active module: grade it, then advance the state machine.
 * - Module 1 → route to Easy/Hard Module 2 and open it.
 * - R&W Module 2 → start the section break.
 * - Math Module 2 → compute capped scaled scores and complete the test.
 */
export async function submitFullModule(attemptId: string): Promise<{ redirect?: string } | void> {
  const user = await requireUser();

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      test: { include: { modules: true } },
      moduleAttempts: { include: { module: true } },
    },
  });
  if (!attempt || attempt.userId !== user.id) throw new Error("FORBIDDEN");
  if (attempt.status === "COMPLETED") return { redirect: `/tests/report/${attemptId}` };

  const active = activeModuleAttempt({
    status: attempt.status,
    moduleAttempts: attempt.moduleAttempts.map((ma) => ({
      id: ma.id,
      moduleId: ma.moduleId,
      rawCorrect: ma.rawCorrect,
      completedAt: ma.completedAt,
      module: ma.module,
    })),
  });
  if (!active) return;

  const { rawCorrect, section } = await gradeModule(active.id);
  const order = active.module.order;

  if (order === 1) {
    // 5-tier routing: Module 1 raw-correct → Module 2 tier (path "TIER{n}").
    const tier = routeTier(section as Section, rawCorrect);
    const path = `TIER${tier}`;
    const m2 = attempt.test.modules.find(
      (m) => m.section === section && m.order === 2 && m.path === path,
    );
    if (!m2) throw new Error(`Missing ${section} Module 2 (${path})`);
    await prisma.moduleAttempt.update({
      where: { id: active.id },
      data: { routedPath: path },
    });
    await prisma.moduleAttempt.create({ data: { attemptId, moduleId: m2.id } });
    revalidatePath(`/tests/take/${attemptId}`);
    return;
  }

  // Module 2 just finished.
  if (section === "RW") {
    // Break before Math.
    await prisma.testAttempt.update({ where: { id: attemptId }, data: { status: "BREAK" } });
    revalidatePath(`/tests/take/${attemptId}`);
    return;
  }

  // Math Module 2 finished → compute section scaled scores + total.
  await finalizeScores(attemptId);
  return { redirect: `/tests/report/${attemptId}` };
}

/** Continue from the between-sections break into Math Module 1. */
export async function continueFromBreak(attemptId: string): Promise<void> {
  const user = await requireUser();
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: { test: { include: { modules: true } } },
  });
  if (!attempt || attempt.userId !== user.id) throw new Error("FORBIDDEN");
  if (attempt.status !== "BREAK") return;

  const mathM1 = attempt.test.modules.find((m) => m.section === "MATH" && m.order === 1);
  if (!mathM1) throw new Error("Test is missing Math Module 1");

  await prisma.moduleAttempt.create({ data: { attemptId, moduleId: mathM1.id } });
  await prisma.testAttempt.update({ where: { id: attemptId }, data: { status: "IN_PROGRESS" } });
  revalidatePath(`/tests/take/${attemptId}`);
}

async function finalizeScores(attemptId: string): Promise<void> {
  const attempt = await prisma.testAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { moduleAttempts: { include: { module: true } } },
  });

  const sectionScaled: Record<string, number> = {};
  for (const section of ["RW", "MATH"] as Section[]) {
    const m1 = attempt.moduleAttempts.find(
      (ma) => ma.module.section === section && ma.module.order === 1,
    );
    const m2 = attempt.moduleAttempts.find(
      (ma) => ma.module.section === section && ma.module.order === 2,
    );
    const tier = tierFromPath(m2?.module.path ?? "TIER3");
    const perModule = questionsPerModule(section);
    // Tier-multiplier + tier-cap scoring (spec scoring_model).
    sectionScaled[section] = scoreSection({
      module1Correct: m1?.rawCorrect ?? 0,
      module1Total: perModule,
      module2Correct: m2?.rawCorrect ?? 0,
      module2Total: perModule,
      tier,
    });
  }

  const rwScaled = sectionScaled.RW ?? 200;
  const mathScaled = sectionScaled.MATH ?? 200;

  await prisma.testAttempt.update({
    where: { id: attemptId },
    data: {
      rwScaled,
      mathScaled,
      scaledTotal: rwScaled + mathScaled,
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  // XP for finishing a full mock, and count a useful interaction.
  await prisma.user.update({
    where: { id: attempt.userId },
    data: { xp: { increment: 100 }, usefulInteractions: { increment: 1 } },
  });

  revalidatePath("/tests");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}
