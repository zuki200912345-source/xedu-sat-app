import { prisma } from "@/lib/prisma";

// XP thresholds → level. Level N requires N*(N-1)/2 * 100 XP (gentle curve).
export function levelForXp(xp: number): { level: number; into: number; toNext: number } {
  let level = 1;
  let needed = 100;
  let remaining = xp;
  while (remaining >= needed) {
    remaining -= needed;
    level++;
    needed += 50;
  }
  return { level, into: remaining, toNext: needed };
}

export const BADGES: Record<string, { title: string; description: string; emoji: string }> = {
  first_steps: { title: "First Steps", description: "Completed your first practice module", emoji: "🎯" },
  diagnostic_done: { title: "Know Thyself", description: "Finished the diagnostic", emoji: "🧭" },
  first_test: { title: "Test Pilot", description: "Completed a full-length test", emoji: "✈️" },
  streak_3: { title: "On a Roll", description: "3-day study streak", emoji: "🔥" },
  streak_7: { title: "Unstoppable", description: "7-day study streak", emoji: "⚡" },
  century_club: { title: "Century Club", description: "Answered 100 questions", emoji: "💯" },
  wordsmith: { title: "Wordsmith", description: "Reviewed 50 flashcards", emoji: "📚" },
  scholar: { title: "Scholar", description: "Completed 5 lessons", emoji: "🎓" },
  well_read: { title: "Well Read", description: "Summarized 5 daily articles", emoji: "📰" },
};

/** Add XP to a user (used by every graded activity). */
export async function awardXp(userId: string, amount: number) {
  await prisma.user.update({ where: { id: userId }, data: { xp: { increment: amount } } });
}

/**
 * Count one meaningful action for a user (surfaced in the developer dashboard).
 * Call on: completing a practice/drill session, completing a mock test,
 * completing a Thoth walkthrough, or reviewing a mistake-notebook question.
 * Never called for page views or logins.
 */
export async function bumpUsefulInteraction(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { usefulInteractions: { increment: 1 } },
  });
}

/** Grant a badge if not already earned. Silent no-op on duplicates. */
export async function grantBadge(userId: string, key: keyof typeof BADGES) {
  try {
    await prisma.badge.create({ data: { userId, key } });
  } catch {
    // Unique constraint — already earned.
  }
}

/**
 * Update the daily study streak. Increments if the last active day was
 * yesterday, resets to 1 if a day was missed, and is a no-op if already counted
 * today. Grants streak badges as milestones are reached.
 */
export async function touchStreak(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streak: true, lastActiveDay: true },
  });
  if (!user) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = user.lastActiveDay ? new Date(user.lastActiveDay) : null;
  if (last) last.setHours(0, 0, 0, 0);

  let streak = user.streak;
  if (!last) {
    streak = 1;
  } else {
    const dayMs = 24 * 60 * 60 * 1000;
    const diff = Math.round((today.getTime() - last.getTime()) / dayMs);
    if (diff === 0) return; // already counted today
    streak = diff === 1 ? streak + 1 : 1;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { streak, lastActiveDay: today },
  });

  if (streak >= 3) await grantBadge(userId, "streak_3");
  if (streak >= 7) await grantBadge(userId, "streak_7");
}
