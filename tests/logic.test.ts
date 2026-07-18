import { describe, it, expect } from "vitest";
import { routeTier } from "../src/lib/sat-engine/router";
import { scoreSection } from "../src/lib/sat-engine/scorer";
import { isResponseCorrect, isValidSPRFormat } from "../src/lib/scoring";
import { sm2 } from "../src/lib/sm2";
import { similarityGate } from "../src/lib/similarity";
import { countWords, MIN_WORDS } from "../src/lib/summary-analysis";
import { dayNumber } from "../src/lib/reading";

describe("5-tier scoring & routing", () => {
  const perfect = (tier: number) =>
    scoreSection({ module1Correct: 27, module1Total: 27, module2Correct: 27, module2Total: 27, tier });

  it("caps each section at its tier cap and reaches 800 at tier 5", () => {
    expect(perfect(1)).toBeLessThanOrEqual(480);
    expect(perfect(2)).toBeLessThanOrEqual(570);
    expect(perfect(3)).toBeLessThanOrEqual(650);
    expect(perfect(4)).toBeLessThanOrEqual(730);
    expect(perfect(5)).toBe(800);
  });

  it("floors at 200", () => {
    expect(scoreSection({ module1Correct: 0, module1Total: 27, module2Correct: 0, module2Total: 27, tier: 3 })).toBe(200);
  });

  it("routes Module 1 raw-correct to the right tier", () => {
    expect(routeTier("RW", 5)).toBe(1);
    expect(routeTier("RW", 10)).toBe(2);
    expect(routeTier("RW", 16)).toBe(3);
    expect(routeTier("RW", 22)).toBe(4);
    expect(routeTier("RW", 27)).toBe(5);
    expect(routeTier("MATH", 4)).toBe(1);
    expect(routeTier("MATH", 19)).toBe(5);
  });
});

describe("answer checking", () => {
  it("matches MCQ letters case-insensitively", () => {
    expect(isResponseCorrect("MCQ", "B", "b")).toBe(true);
    expect(isResponseCorrect("MCQ", "B", "C")).toBe(false);
  });

  it("accepts equivalent SPR numeric forms", () => {
    expect(isResponseCorrect("SPR", "0.5", "1/2")).toBe(true);
    expect(isResponseCorrect("SPR", "8", "8")).toBe(true);
    expect(isResponseCorrect("SPR", "8", "9")).toBe(false);
  });

  it("validates SPR format", () => {
    expect(isValidSPRFormat("3/4")).toBe(true);
    expect(isValidSPRFormat("0.5")).toBe(true);
    expect(isValidSPRFormat("6/")).toBe(false);
    expect(isValidSPRFormat("abc")).toBe(false);
  });
});

describe("SM-2", () => {
  it("resets interval on a lapse and grows it on success", () => {
    const lapse = sm2({ easeFactor: 2.5, interval: 10, repetitions: 3 }, "AGAIN");
    expect(lapse.repetitions).toBe(0);
    expect(lapse.interval).toBe(0);

    const good = sm2({ easeFactor: 2.5, interval: 0, repetitions: 0 }, "GOOD");
    expect(good.interval).toBe(1);
    expect(good.repetitions).toBe(1);
  });
});

describe("daily reading", () => {
  it("counts words for the summary minimum", () => {
    expect(countWords("  one   two three ")).toBe(3);
    expect(countWords("")).toBe(0);
    expect(MIN_WORDS).toBe(50);
  });

  it("picks a stable article-of-the-day index per calendar day", () => {
    const a = dayNumber(new Date("2026-07-07T09:00:00Z"));
    const b = dayNumber(new Date("2026-07-07T23:00:00Z"));
    const c = dayNumber(new Date("2026-07-08T01:00:00Z"));
    expect(a).toBe(b); // same day → same article
    expect(c).toBe(a + 1); // next day → next article
  });
});

describe("similarity gate", () => {
  it("passes distinct text and flags near-duplicates", () => {
    const ref = ["the quick brown fox jumps over the lazy dog every single morning"];
    expect(similarityGate("a completely different sentence about marine biology and tides", ref).ok).toBe(true);
    expect(
      similarityGate("the quick brown fox jumps over the lazy dog every single morning", ref).ok,
    ).toBe(false);
  });
});
