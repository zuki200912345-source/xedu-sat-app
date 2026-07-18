import { prisma } from "@/lib/prisma";

/**
 * Add a wrong answer to the mistake notebook (idempotent per user+question).
 * Re-capturing an already-resolved mistake reopens it. Safe to call from any
 * answer-submission path.
 */
export async function captureMistake(args: {
  userId: string;
  questionId: string;
  source: "practice" | "mock" | "walkthrough" | "diagnostic";
  response?: string | null;
}) {
  const { userId, questionId, source, response } = args;
  await prisma.mistakeEntry.upsert({
    where: { userId_questionId: { userId, questionId } },
    create: { userId, questionId, source, userResponse: response ?? null, resolved: false },
    update: { source, userResponse: response ?? null, resolved: false, resolvedAt: null },
  });
}

/** Mark a mistake resolved when the student re-answers it correctly. */
export async function resolveMistake(userId: string, questionId: string) {
  await prisma.mistakeEntry
    .update({
      where: { userId_questionId: { userId, questionId } },
      data: { resolved: true, resolvedAt: new Date() },
    })
    .catch(() => {
      // No existing entry — nothing to resolve.
    });
}
