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
