/**
 * Shared letter-reference remapping for answer-key shuffles (SAT-01).
 *
 * When an MCQ's choices are permuted, any letter references in the
 * explanation must be remapped through the same permutation or they cite the
 * wrong option. Sections differ:
 *
 * - RW: explanations never use bare capital A–D for anything except choice
 *   references, so every standalone token is remapped (subsumes "Choice B").
 * - MATH: bare capital letters can be geometry labels ("angle A") or
 *   variables ("A = πr^2"). Only explicit "choice/option/answer X" (any case)
 *   and conservative "X is/was/must/would/correctly/incorrectly" refs are
 *   remapped — and items whose explanations mix letters with geometry or
 *   variable contexts should be PINNED (not shuffled) via `mathUnsafe`.
 *
 * Everything runs in a SINGLE pass per string so a remapped letter can never
 * be remapped twice.
 */

export const LETTERS = ["A", "B", "C", "D"] as const;

/** MATH explanations where bare-letter remapping could corrupt geometry/vars. */
export function mathUnsafe(explanation: string): boolean {
  return (
    /(?:triangles?|angles?|points?|vertex|vertices|sides?|lines?|segments?|rays?|arcs?|chords?|sectors?|rectangles?|squares?|circles?|boxe?s?)\s+[A-D]\b/i.test(explanation) ||
    /\b[A-D]\s*=/.test(explanation)
  );
}

const RW_PATTERN = /\b([A-D])\b/g;
const MATH_PATTERN =
  /\b((?:[Oo]ptions?|[Cc]hoices?|[Aa]nswers?)\s+)([A-D])\b|\b([A-D])(?=\s+(?:is|was|must|would|correctly|incorrectly)\b)/g;

/**
 * Remap letter references in `explanation` through `perm`, where
 * `perm[oldIndex] = newIndex` (i.e. the choice at old position i now sits at
 * position perm[i]).
 */
export function remapExplanation(
  explanation: string,
  section: "RW" | "MATH",
  perm: number[],
): string {
  const map = (letter: string): string =>
    LETTERS[perm[LETTERS.indexOf(letter as (typeof LETTERS)[number])]];

  if (section === "RW") {
    return explanation.replace(RW_PATTERN, (_, l: string) => map(l));
  }
  return explanation.replace(MATH_PATTERN, (m, word: string | undefined, l1: string | undefined, l2: string | undefined) => {
    if (word && l1) return `${word}${map(l1)}`;
    if (l2) return map(l2);
    return m;
  });
}

/** Detect letter references (for verification): returns letters in order. */
export function detectRefs(explanation: string, section: "RW" | "MATH"): string[] {
  const out: string[] = [];
  const re = section === "RW" ? new RegExp(RW_PATTERN.source, "g") : new RegExp(MATH_PATTERN.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(explanation))) out.push(m[1] && !m[2] ? m[1] : (m[2] ?? m[3])!);
  return out;
}
