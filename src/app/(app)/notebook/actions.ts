"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logTrainingEvent } from "@/lib/training";
import { isResponseCorrect } from "@/lib/scoring";
import { resolveMistake } from "@/lib/mistakes";
import { bumpUsefulInteraction } from "@/lib/gamification";

const schema = z.object({
  questionId: z.string().min(1).max(64),
  response: z.string().min(1).max(200),
});

/**
 * Re-attempt a notebook question. On a correct answer the mistake is marked
 * resolved (moved to "conquered"). Returns the correct answer + explanation so
 * the student always learns after trying.
 */
export async function reattemptMistake(
  input: z.infer<typeof schema>,
): Promise<{ correct: boolean; correctAnswer: string; explanation: string } | { error: string }> {
  const user = await requireUser();
  const { questionId, response } = schema.parse(input);

  // Only allow re-attempting a question that's actually in this user's notebook.
  const entry = await prisma.mistakeEntry.findUnique({
    where: { userId_questionId: { userId: user.id, questionId } },
  });
  if (!entry) return { error: "Not in your notebook." };

  const q = await prisma.question.findUnique({
    where: { id: questionId },
    select: { type: true, correctAnswer: true, explanation: true },
  });
  if (!q) return { error: "Question not found." };

  const correct = isResponseCorrect(q.type, q.correctAnswer, response);
  logTrainingEvent(user.id, "mistake_reattempt", { questionId, response, correct });
  if (correct) await resolveMistake(user.id, questionId);

  // Engaging with the notebook is a meaningful action.
  await bumpUsefulInteraction(user.id);

  revalidatePath("/notebook");
  return { correct, correctAnswer: q.correctAnswer, explanation: q.explanation };
}
