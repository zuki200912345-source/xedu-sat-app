import { SPEC } from "./spec";

/**
 * Section score from the spec's scoring_model:
 *   200 + round_to_10( (m1c + m2c) / (m1t + m2t) * 600 * tier_multiplier )
 * then hard-capped by the Module-2 tier's cap. Mirrors the real test's
 * easier-route score ceiling (approximation for practice — see honesty note).
 */
export function scoreSection(input: {
  module1Correct: number;
  module1Total: number;
  module2Correct: number;
  module2Total: number;
  tier: number;
}): number {
  const { module1Correct, module1Total, module2Correct, module2Total, tier } = input;
  const { scale, tier_multipliers, tier_caps } = SPEC.scoring_model.per_section;
  const [floor, ceil] = scale;

  const totalCorrect = module1Correct + module2Correct;
  const totalQuestions = module1Total + module2Total;
  const fraction = totalQuestions > 0 ? totalCorrect / totalQuestions : 0;

  const mult = tier_multipliers[String(tier)] ?? 1;
  const raw = floor + Math.round((fraction * 600 * mult) / 10) * 10;

  const cap = tier_caps[String(tier)] ?? ceil;
  return Math.max(floor, Math.min(raw, cap, ceil));
}

/** Composite 400–1600 from the two section scores. */
export function compositeScore(rwSection: number, mathSection: number): number {
  return rwSection + mathSection;
}
