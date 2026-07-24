/**
 * SAT-01: Rebalance the answer key.
 *
 * The generator wrote the correct answer first, so the key skewed to early
 * letters (A 44.7% / D 5.3%). This script shuffles each MCQ's choices with a
 * SEEDED RNG — deterministic per item (keyed on the stem), so a re-run
 * produces byte-identical output and the diff is reviewable.
 *
 * Items whose text references choice letters positionally ("both A and B",
 * "option C") are PINNED (left unshuffled) and logged for manual review —
 * shuffling would break the reference.
 *
 * Run: npx tsx scripts/rebalance-key.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { SeedQuestion } from "../prisma/seed-data/types";

const FILES = ["generated-bank.json", "challenge-bank.json"];

/**
 * Positional letter references that make an item unsafe to shuffle.
 * Applied to CHOICE text: "Both A and B", "neither C nor D", "option A".
 * Applied to EXPLANATION text: only explicit "choice/option/answer X" — bare
 * letters there are usually geometry point labels (triangle ABC), which are
 * unaffected by shuffling.
 */
const CHOICE_POSITIONAL =
  /\b(?:both|neither|either)\s+[A-D]\b|\b(?:options?|choices?|answers?)\s+[A-D]\b/i;
const EXPLANATION_POSITIONAL = /\b(?:options?|choices?|answers?)\s+[A-D]\b/;

/** Deterministic 32-bit hash of a string (FNV-1a). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — small, seedable, deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LETTERS = ["A", "B", "C", "D"] as const;

function rebalanceFile(file: string): void {
  const path = join(__dirname, "../prisma/seed-data", file);
  const bank = JSON.parse(readFileSync(path, "utf8")) as SeedQuestion[];

  let shuffled = 0;
  let pinned = 0;
  for (const q of bank) {
    if (q.type !== "MCQ" || !q.choices || q.choices.length !== 4) continue;

    // Choices that reference other choices by letter ("Both A and B") cannot
    // be shuffled safely — pin and log for manual review.
    if (CHOICE_POSITIONAL.test(q.choices.join(" "))) {
      pinned++;
      console.log(`  pinned (positional choice text): ${q.stem.slice(0, 70)}…`);
      continue;
    }

    // Deterministic Fisher-Yates keyed on the item's unique content (R&W stems
    // are canonical and shared across many items, so the stem alone would give
    // whole buckets the same permutation and preserve the skew).
    const rng = mulberry32(hash(`${q.stem}|${q.passageText ?? ""}|${q.choices.join("|")}`));
    const order = [0, 1, 2, 3];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    const oldIndex = LETTERS.indexOf(q.correctAnswer as (typeof LETTERS)[number]);
    q.choices = order.map((i) => q.choices![i]) as [string, string, string, string];
    q.correctAnswer = LETTERS[order.indexOf(oldIndex)];

    // Explanations may reference letters explicitly ("Choice B restates…").
    // Remap those references through the same permutation in a single pass —
    // each source letter maps to its new position, so references stay correct.
    if (EXPLANATION_POSITIONAL.test(q.explanation)) {
      q.explanation = q.explanation.replace(
        /\b(options?|choices?|answers?)(\s+)([A-D])\b/g,
        (_, word: string, ws: string, letter: string) =>
          `${word}${ws}${LETTERS[order.indexOf(LETTERS.indexOf(letter as (typeof LETTERS)[number]))]}`,
      );
    }
    shuffled++;
  }

  writeFileSync(path, JSON.stringify(bank, null, 2));

  // Report the resulting distribution.
  const mcqs = bank.filter((q) => q.type === "MCQ");
  const dist = (qs: SeedQuestion[]) => {
    const c: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const q of qs) c[q.correctAnswer]++;
    return LETTERS.map((l) => `${l} ${((100 * c[l]) / qs.length).toFixed(1)}%`).join("  ");
  };
  console.log(`${file}: ${shuffled} shuffled, ${pinned} pinned`);
  console.log(`  overall: ${dist(mcqs)}`);
  for (const section of ["RW", "MATH"]) {
    const qs = mcqs.filter((q) => q.section === section);
    if (qs.length) console.log(`  ${section}: ${dist(qs)}`);
  }
}

for (const f of FILES) rebalanceFile(f);
