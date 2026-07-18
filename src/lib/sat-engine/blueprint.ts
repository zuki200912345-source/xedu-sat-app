import { SPEC } from "./spec";
import type { Rng } from "./rng";

export interface RwBlockCount {
  type: string;
  domain: string;
  count: number;
}
export interface MathDomainCount {
  domain: string;
  count: number;
}

// Recommended jitter pairs (spec): move ±1 between adjacent blocks so the total
// stays exactly 27 / 22, each block within its ±1 tolerance.
const RW_JITTER_PAIRS: [string, string][] = [
  ["words_in_context", "text_structure_and_purpose"],
  ["cross_text_connections", "central_ideas_and_details"],
  ["command_of_evidence_quantitative", "inferences"],
  ["transitions", "rhetorical_synthesis"],
  ["standard_english_conventions", "transitions"],
];
const MATH_JITTER_PAIRS: [string, string][] = [
  ["algebra", "advanced_math"],
  ["problem_solving_and_data_analysis", "geometry_and_trigonometry"],
];

/** R&W block counts in fixed spec order, total exactly 27, with ≤1 jitter move. */
export function rwBlockCounts(rng: Rng): RwBlockCount[] {
  const blocks = SPEC.reading_writing.blueprint.map((b) => ({
    type: b.type,
    domain: b.domain,
    count: b.count,
    tolerance: b.tolerance,
  }));
  const byType = new Map(blocks.map((b) => [b.type, b]));

  // Apply a single deterministic jitter move (or none) from the jitter pairs.
  if (rng.next() < 0.6) {
    const [a, b] = rng.pick(RW_JITTER_PAIRS);
    const from = rng.next() < 0.5 ? a : b;
    const to = from === a ? b : a;
    const src = byType.get(from);
    const dst = byType.get(to);
    if (src && dst && src.count - 1 >= Math.max(0, src.count - src.tolerance)) {
      src.count -= 1;
      dst.count += 1;
    }
  }

  const total = blocks.reduce((s, b) => s + b.count, 0);
  if (total !== SPEC.reading_writing.questions_per_module) {
    // Correct any drift back onto the largest block.
    const diff = SPEC.reading_writing.questions_per_module - total;
    blocks.sort((x, y) => y.count - x.count)[0].count += diff;
  }
  // Restore spec order.
  const order = SPEC.reading_writing.blueprint.map((b) => b.type);
  blocks.sort((x, y) => order.indexOf(x.type) - order.indexOf(y.type));
  return blocks.map(({ type, domain, count }) => ({ type, domain, count }));
}

/** Math domain counts, total exactly 22, with ≤1 jitter move. */
export function mathDomainCounts(rng: Rng): MathDomainCount[] {
  const domains = SPEC.math.domain_counts_per_module.map((d) => ({
    domain: d.domain,
    count: d.count,
    tolerance: d.tolerance,
  }));
  const byDomain = new Map(domains.map((d) => [d.domain, d]));

  if (rng.next() < 0.6) {
    const [a, b] = rng.pick(MATH_JITTER_PAIRS);
    const from = rng.next() < 0.5 ? a : b;
    const to = from === a ? b : a;
    const src = byDomain.get(from);
    const dst = byDomain.get(to);
    if (src && dst && src.count - 1 >= Math.max(1, src.count - src.tolerance)) {
      src.count -= 1;
      dst.count += 1;
    }
  }

  const total = domains.reduce((s, d) => s + d.count, 0);
  if (total !== SPEC.math.questions_per_module) {
    const diff = SPEC.math.questions_per_module - total;
    domains.sort((x, y) => y.count - x.count)[0].count += diff;
  }
  const order = SPEC.math.domain_counts_per_module.map((d) => d.domain);
  domains.sort((x, y) => order.indexOf(x.domain) - order.indexOf(y.domain));
  return domains.map(({ domain, count }) => ({ domain, count }));
}

/** Target SPR count for a math module (spec: ~25%, 5 ±1). */
export function mathSprTarget(): number {
  return SPEC.math.format.spr_count;
}
