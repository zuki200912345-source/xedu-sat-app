// SM-2 spaced-repetition scheduling (SuperMemo 2), used by the flashcards.

export type Grade = "AGAIN" | "HARD" | "GOOD" | "EASY";

// Map the four review buttons to SM-2 quality scores (0–5).
const QUALITY: Record<Grade, number> = { AGAIN: 2, HARD: 3, GOOD: 4, EASY: 5 };

export interface Sm2State {
  easeFactor: number; // >= 1.3
  interval: number; // days until next review
  repetitions: number; // consecutive successful reviews
}

export interface Sm2Result extends Sm2State {
  dueAt: Date;
}

/**
 * Apply one SM-2 review. A grade below "GOOD" resets the repetition streak and
 * schedules the card again soon; higher grades grow the interval by the ease
 * factor. Returns the next state and due date.
 */
export function sm2(prev: Sm2State, grade: Grade, now = new Date()): Sm2Result {
  const q = QUALITY[grade];
  let { easeFactor, interval, repetitions } = prev;

  if (q < 3) {
    // Lapse — relearn from the start.
    repetitions = 0;
    interval = grade === "AGAIN" ? 0 : 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.round(interval * easeFactor);
  }

  // Update ease factor per the SM-2 formula, floored at 1.3.
  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  // "AGAIN" comes back in ~1 minute (this session); others in `interval` days.
  const dueAt =
    interval === 0
      ? new Date(now.getTime() + 60 * 1000)
      : new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

  return { easeFactor, interval, repetitions, dueAt };
}
