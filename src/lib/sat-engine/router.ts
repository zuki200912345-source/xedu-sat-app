import { tiersFor, type Section } from "./spec";

/**
 * Route Module 2 tier from Module 1 raw-correct count, per the spec's 5-tier
 * table. Module 1 itself is always tier 3 (baseline), per module_1_rule.
 */
export function routeTier(section: Section, module1Correct: number): number {
  const tiers = tiersFor(section);
  for (const t of tiers) {
    const [lo, hi] = t.module1_correct_range;
    if (module1Correct >= lo && module1Correct <= hi) return t.tier;
  }
  // Above/below all ranges → clamp to the nearest edge tier.
  return module1Correct <= 0 ? tiers[0].tier : tiers[tiers.length - 1].tier;
}

export const BASELINE_TIER = 3;
