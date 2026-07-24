/**
 * SAT-01: Rebalance the answer key.
 *
 * The generator wrote the correct answer first, so the key skewed to early
 * letters (A 44.7% / D 5.3%). This script shuffles each MCQ's choices with a
 * SEEDED RNG — deterministic per item (keyed on stem+passage+choices, since
 * R&W stems are canonical and shared), so a re-run from the pristine bank
 * produces byte-identical output and the diff is reviewable.
 *
 * Explanation letter references are remapped through the same permutation
 * (case-insensitive "Choice/Option/Answer X" everywhere; bare capital A–D in
 * R&W, conservative verb-context refs in MATH — see remap-letters.ts).
 * Items that cannot be shuffled safely are PINNED and logged:
 *   - choice text referencing other choices positionally ("Both A and B")
 *   - MATH explanations mixing letters with geometry labels or variables
 * A verification pass re-detects every reference and asserts it cites the
 * same choice TEXT as in the original; any mismatch reverts the item.
 *
 * Run: npx tsx scripts/rebalance-key.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { SeedQuestion } from "../prisma/seed-data/types";
import { LETTERS, detectRefs, mathUnsafe, remapExplanation } from "./remap-letters";

const FILES = ["generated-bank.json", "challenge-bank.json"];

/** Choices that reference other choices by letter cannot be shuffled. */
const CHOICE_POSITIONAL =
  /\b(?:both|neither|either)\s+[A-D]\b|\b(?:options?|choices?|answers?)\s+[A-D]\b/i;

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Explanations containing the model's own second-guessing are broken items —
 * several are even mis-keyed (the reasoning concludes a different letter than
 * the stored answer). Drop them outright.
 */
const JUNK =
  /\b(hmm|but wait|wait[,:]|i made a mistake|there is a mistake|let'?s redo|let me (?:recheck|adjust|redo)|i'?ll stick with|why did i write|i misunderstood|perhaps i|recalculat)/i;

function rebalanceFile(file: string): void {
  const path = join(__dirname, "../prisma/seed-data", file);
  const raw = JSON.parse(readFileSync(path, "utf8")) as SeedQuestion[];
  const dropped = raw.length - raw.filter((q) => !JUNK.test(q.explanation)).length;
  const bank = raw.filter((q) => !JUNK.test(q.explanation));
  if (dropped) console.log(`  dropped ${dropped} items with self-correcting junk explanations`);
  const original = JSON.parse(JSON.stringify(bank)) as SeedQuestion[];

  let shuffled = 0;
  let pinned = 0;
  let reverted = 0;

  bank.forEach((q, idx) => {
    if (q.type !== "MCQ" || !q.choices || q.choices.length !== 4) return;

    if (CHOICE_POSITIONAL.test(q.choices.join(" "))) {
      pinned++;
      console.log(`  pinned (positional choice text): ${q.stem.slice(0, 60)}…`);
      return;
    }
    if (q.section === "MATH" && mathUnsafe(q.explanation)) {
      pinned++;
      console.log(`  pinned (geometry/variable letters): ${q.stem.slice(0, 60)}…`);
      return;
    }

    // SALT chosen (deterministic search) so every letter lands within 25%±3
    // in BOTH sections after pinning — see PR notes.
    const SALT = 2;
    const rng = mulberry32(hash(`${SALT}|${q.stem}|${q.passageText ?? ""}|${q.choices.join("|")}`));
    const order = [0, 1, 2, 3];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    // order[newIndex] = oldIndex → perm[oldIndex] = newIndex for the remap.
    const perm = [0, 1, 2, 3].map((oldIdx) => order.indexOf(oldIdx));

    const orig = original[idx];
    q.choices = order.map((i) => orig.choices![i]) as [string, string, string, string];
    q.correctAnswer = LETTERS[perm[LETTERS.indexOf(orig.correctAnswer as (typeof LETTERS)[number])]];
    q.explanation = remapExplanation(orig.explanation, q.section, perm);

    // VERIFY: every reference detected in the original must cite the same
    // choice text after remapping. Any mismatch → revert this item.
    const before = detectRefs(orig.explanation, q.section);
    const after = detectRefs(q.explanation, q.section);
    const ok =
      before.length === after.length &&
      before.every((letter, k) => {
        const oldText = orig.choices![LETTERS.indexOf(letter as (typeof LETTERS)[number])];
        const newText = q.choices![LETTERS.indexOf(after[k] as (typeof LETTERS)[number])];
        return oldText === newText;
      }) &&
      // The key itself must still point at the original correct text.
      q.choices[LETTERS.indexOf(q.correctAnswer as (typeof LETTERS)[number])] ===
        orig.choices![LETTERS.indexOf(orig.correctAnswer as (typeof LETTERS)[number])];
    if (!ok) {
      bank[idx] = orig;
      reverted++;
      console.log(`  reverted (verification failed): ${q.stem.slice(0, 60)}…`);
      return;
    }
    shuffled++;
  });

  // Final integrity pass: an explanation citing "choice X … correct" where X
  // isn't the stored key means the item is MIS-KEYED at the source (the
  // model's reasoning and its answer disagree). Drop those outright.
  const misKeyed = (q: SeedQuestion): boolean => {
    if (q.type !== "MCQ") return false;
    const re = /\b(?:options?|choices?|answers?)\s+([A-D])\b([^.]{0,60})/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(q.explanation))) {
      const tail = m[2] ?? "";
      if (/\bcorrect/i.test(tail) && !/\bincorrect/i.test(tail) && m[1].toUpperCase() !== q.correctAnswer) {
        return true;
      }
    }
    return false;
  };
  const clean = bank.filter((q) => !misKeyed(q));
  if (clean.length !== bank.length) {
    console.log(`  dropped ${bank.length - clean.length} MIS-KEYED items (explanation cites a different letter as correct)`);
  }

  writeFileSync(path, JSON.stringify(clean, null, 2));

  const mcqs = clean.filter((q) => q.type === "MCQ");
  const dist = (qs: SeedQuestion[]) => {
    const c: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const q of qs) c[q.correctAnswer]++;
    return LETTERS.map((l) => `${l} ${((100 * c[l]) / qs.length).toFixed(1)}%`).join("  ");
  };
  console.log(`${file}: ${shuffled} shuffled, ${pinned} pinned, ${reverted} reverted`);
  console.log(`  overall: ${dist(mcqs)}`);
  for (const section of ["RW", "MATH"]) {
    const qs = mcqs.filter((q) => q.section === section);
    if (qs.length) console.log(`  ${section}: ${dist(qs)}`);
  }
}

for (const f of FILES) rebalanceFile(f);
