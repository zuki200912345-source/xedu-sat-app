"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { captureMistake, resolveMistake } from "@/lib/mistakes";
import { awardXp, bumpUsefulInteraction } from "@/lib/gamification";

const answerSchema = z.object({
  skill: z.string().min(1).max(120),
  questionId: z.string().min(1).max(64),
  correct: z.boolean(),
  response: z.string().max(200).nullable(),
  isFinalAttempt: z.boolean(),
});

/**
 * Record a solo-mode walkthrough answer: update skill mastery, and feed the
 * mistake notebook on a final incorrect attempt (or resolve it when correct).
 */
export async function recordWalkthroughAnswer(input: z.infer<typeof answerSchema>) {
  const user = await requireUser();
  const data = answerSchema.parse(input);

  const q = await prisma.question.findUnique({
    where: { id: data.questionId },
    select: { section: true, skill: true },
  });
  if (!q) return { ok: false };

  // Skill mastery — count the attempt once (on the final attempt).
  if (data.isFinalAttempt) {
    await prisma.skillMastery.upsert({
      where: { userId_skill: { userId: user.id, skill: q.skill } },
      create: {
        userId: user.id,
        skill: q.skill,
        section: q.section,
        attempts: 1,
        correct: data.correct ? 1 : 0,
      },
      update: {
        attempts: { increment: 1 },
        correct: data.correct ? { increment: 1 } : undefined,
        lastSeen: new Date(),
      },
    });
  }

  if (data.correct) {
    await resolveMistake(user.id, data.questionId);
  } else if (data.isFinalAttempt) {
    await captureMistake({ userId: user.id, questionId: data.questionId, source: "walkthrough", response: data.response });
  }
  return { ok: true };
}

/** Mark a walkthrough completed and award progress. */
export async function completeWalkthrough(skill: string) {
  const user = await requireUser();
  z.string().min(1).max(120).parse(skill);

  await prisma.walkthroughProgress.upsert({
    where: { userId_skill: { userId: user.id, skill } },
    create: { userId: user.id, skill, status: "COMPLETED" },
    update: { status: "COMPLETED" },
  });

  await awardXp(user.id, 25);
  await bumpUsefulInteraction(user.id);

  revalidatePath("/walkthroughs");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Mark a walkthrough started (first visit). */
export async function startWalkthrough(skill: string) {
  const user = await requireUser();
  z.string().min(1).max(120).parse(skill);
  await prisma.walkthroughProgress.upsert({
    where: { userId_skill: { userId: user.id, skill } },
    create: { userId: user.id, skill, status: "IN_PROGRESS" },
    update: {}, // don't downgrade a completed one
  });
  return { ok: true };
}
