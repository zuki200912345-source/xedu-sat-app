// Answer checking and raw scoring shared by practice modules and full tests.

/** Normalize a Student-Produced Response for tolerant equality. */
function normalizeSPR(value: string): string {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

/**
 * Convert simple fraction / decimal SPR responses to a number when possible,
 * so "1/2", "0.5", and ".5" all compare equal. Returns null if not numeric.
 */
function sprToNumber(value: string): number | null {
  const v = normalizeSPR(value);
  if (/^-?\d+\/\d+$/.test(v)) {
    const [n, d] = v.split("/").map(Number);
    if (d === 0) return null;
    return n / d;
  }
  if (/^-?\.?\d+(\.\d+)?$/.test(v) || /^-?\d+\.?\d*$/.test(v)) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Check a response against a question's correct answer.
 * - MCQ: exact letter match ("A".."D"), case-insensitive.
 * - SPR: canonical answer may list "|"-separated accepted forms; numeric forms
 *   are compared with a small tolerance so equivalent fractions/decimals pass.
 */
export function isResponseCorrect(
  type: string,
  correctAnswer: string,
  response: string | null | undefined,
): boolean {
  if (response == null || response === "") return false;

  if (type === "MCQ") {
    return response.trim().toUpperCase() === correctAnswer.trim().toUpperCase();
  }

  // SPR
  const accepted = correctAnswer.split("|");
  const respNum = sprToNumber(response);
  return accepted.some((form) => {
    if (normalizeSPR(form) === normalizeSPR(response)) return true;
    const formNum = sprToNumber(form);
    if (respNum != null && formNum != null) {
      return Math.abs(respNum - formNum) < 1e-6;
    }
    return false;
  });
}

/** Validate the format of an SPR entry as the student types (Bluebook rules). */
export function isValidSPRFormat(value: string): boolean {
  const v = value.trim();
  if (v === "") return false;
  // Up to 5 characters: digits, one optional leading minus, a single decimal
  // point or a single fraction slash. No mixed numbers.
  if (v.length > 6) return false;
  if (!/^-?(\d+\.?\d*|\.\d+|\d+\/\d+)$/.test(v)) return false;
  return true;
}

export interface RawScoreResult {
  correct: number;
  total: number;
  fraction: number;
}

/** Tally correct answers over a set of graded responses. */
export function rawScore(
  items: { type: string; correctAnswer: string; response: string | null }[],
): RawScoreResult {
  const total = items.length;
  const correct = items.reduce(
    (acc, it) => acc + (isResponseCorrect(it.type, it.correctAnswer, it.response) ? 1 : 0),
    0,
  );
  return { correct, total, fraction: total === 0 ? 0 : correct / total };
}
