"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTier } from "@/lib/tier";
import { sm2, type Grade } from "@/lib/sm2";
import { awardXp } from "@/lib/gamification";

const gradeSchema = z.object({
  wordId: z.string().min(1),
  grade: z.enum(["AGAIN", "HARD", "GOOD", "EASY"]),
});

/** Record one flashcard review and schedule the next via SM-2. */
export async function gradeCard(input: { wordId: string; grade: Grade }) {
  const user = await requireTier("PLUS");
  const { wordId, grade } = gradeSchema.parse(input);

  const existing = await prisma.vocabProgress.findUnique({
    where: { userId_wordId: { userId: user.id, wordId } },
  });

  const next = sm2(
    {
      easeFactor: existing?.easeFactor ?? 2.5,
      interval: existing?.interval ?? 0,
      repetitions: existing?.repetitions ?? 0,
    },
    grade,
  );

  await prisma.vocabProgress.upsert({
    where: { userId_wordId: { userId: user.id, wordId } },
    create: {
      userId: user.id,
      wordId,
      easeFactor: next.easeFactor,
      interval: next.interval,
      repetitions: next.repetitions,
      dueAt: next.dueAt,
      lastGrade: grade,
    },
    update: {
      easeFactor: next.easeFactor,
      interval: next.interval,
      repetitions: next.repetitions,
      dueAt: next.dueAt,
      lastGrade: grade,
    },
  });

  await awardXp(user.id, 2);
  return { ok: true };
}
