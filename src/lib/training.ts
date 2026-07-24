import { prisma } from "@/lib/prisma";

/**
 * Training-data capture (long-term).
 *
 * Every meaningful piece of user work — test/diagnostic responses,
 * walkthrough answers, notebook re-attempts, reading summaries — is appended
 * to TrainingEvent as a JSON payload. Two purposes:
 *
 *  1. TRAINING: an exportable corpus (admin JSONL export) for future model
 *     fine-tuning on real student behaviour.
 *  2. EVALUATION: longitudinal signals (accuracy trends, before/after
 *     walkthrough deltas, reading-score trajectories) that show whether the
 *     platform actually improves outcomes.
 *
 * Fire-and-forget by design: a logging failure must never block or slow the
 * student's action.
 */
export function logTrainingEvent(userId: string, kind: string, payload: unknown): void {
  void prisma.trainingEvent
    .create({ data: { userId, kind, payload: JSON.stringify(payload) } })
    .catch(() => {});
}

/** Whether the user has a completed diagnostic (drives hiding it in the UI). */
export async function hasCompletedDiagnostic(userId: string): Promise<boolean> {
  const n = await prisma.testAttempt.count({
    where: { userId, status: "COMPLETED", test: { kind: "DIAGNOSTIC" } },
  });
  return n > 0;
}
