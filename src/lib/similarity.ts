// N-gram overlap similarity, shared by the authoring pipeline and the admin
// "similarity check" button. Rejects near-duplicate candidate items.

const NGRAM_SIZE = 5;
export const SIMILARITY_THRESHOLD = 0.35;

function ngrams(text: string, n = NGRAM_SIZE): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const grams = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) grams.add(words.slice(i, i + n).join(" "));
  return grams;
}

/**
 * Returns the maximum n-gram overlap ratio of `candidate` against any of
 * `references`, and whether it is within the acceptable threshold.
 */
export function similarityGate(
  candidate: string,
  references: string[],
): { ok: boolean; maxOverlap: number } {
  const cand = ngrams(candidate);
  if (cand.size === 0) return { ok: true, maxOverlap: 0 };
  let maxOverlap = 0;
  for (const ref of references) {
    const refGrams = ngrams(ref);
    if (refGrams.size === 0) continue;
    let shared = 0;
    for (const g of cand) if (refGrams.has(g)) shared++;
    maxOverlap = Math.max(maxOverlap, shared / cand.size);
  }
  return { ok: maxOverlap <= SIMILARITY_THRESHOLD, maxOverlap };
}
