import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import type { SeedQuestion } from "../prisma/seed-data/types";

/**
 * SAT-01 guard: the MCQ answer key must stay near-uniform. If any letter
 * drifts outside 25% ± 3 — overall or within a section — position becomes a
 * stronger signal than knowledge and the adaptive engine's routing, predicted
 * scores and skill mastery are all compromised.
 */
const TOLERANCE = 3; // percentage points around 25
const LETTERS = ["A", "B", "C", "D"] as const;

function loadMcqs(): SeedQuestion[] {
  const path = join(__dirname, "../prisma/seed-data/generated-bank.json");
  const bank = JSON.parse(readFileSync(path, "utf8")) as SeedQuestion[];
  return bank.filter((q) => q.type === "MCQ");
}

function percentages(qs: SeedQuestion[]): Record<string, number> {
  const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const q of qs) counts[q.correctAnswer] = (counts[q.correctAnswer] ?? 0) + 1;
  const out: Record<string, number> = {};
  for (const l of LETTERS) out[l] = (100 * counts[l]) / qs.length;
  return out;
}

describe("answer-key distribution (SAT-01)", () => {
  const mcqs = loadMcqs();

  it("has a meaningful sample", () => {
    expect(mcqs.length).toBeGreaterThan(1000);
  });

  it("every key is a valid letter", () => {
    for (const q of mcqs) expect(LETTERS).toContain(q.correctAnswer);
  });

  it("explanations that cite a letter as correct cite the actual key", () => {
    // The guard that catches a broken remap: when an explanation says
    // "Choice X … correct" (and not "incorrect"), X must be the answer key.
    let checked = 0;
    for (const q of mcqs) {
      const re = /\b(?:options?|choices?|answers?)\s+([A-D])\b([^.]{0,60})/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(q.explanation))) {
        const tail = m[2] ?? "";
        if (/\bcorrect/i.test(tail) && !/\bincorrect/i.test(tail)) {
          checked++;
          expect(m[1].toUpperCase(), `"${m[0].trim()}" but key is ${q.correctAnswer}`).toBe(q.correctAnswer);
        }
      }
    }
    expect(checked).toBeGreaterThan(50); // the pattern must actually occur
  });

  for (const scope of ["overall", "RW", "MATH"] as const) {
    it(`${scope}: every letter within 25% ± ${TOLERANCE}`, () => {
      const qs = scope === "overall" ? mcqs : mcqs.filter((q) => q.section === scope);
      const pct = percentages(qs);
      for (const l of LETTERS) {
        expect(pct[l], `${scope} ${l} = ${pct[l].toFixed(1)}%`).toBeGreaterThanOrEqual(25 - TOLERANCE);
        expect(pct[l], `${scope} ${l} = ${pct[l].toFixed(1)}%`).toBeLessThanOrEqual(25 + TOLERANCE);
      }
    });
  }
});
