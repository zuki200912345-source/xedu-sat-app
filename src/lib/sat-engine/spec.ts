// Typed loader for sat_exam_spec_v2.json — the single source of truth for exam
// structure. Values are read from the JSON, never hardcoded elsewhere.
import specJson from "./spec.json";

export type Section = "RW" | "MATH";
export type DiffLabel = "easy" | "medium" | "hard";
export type Format = "mc" | "spr";

export interface Tier {
  tier: number;
  label: string;
  module1_correct_range: [number, number];
  difficulty_offset: number;
  mix: Record<DiffLabel, number>;
}

export interface RwBlock {
  order: number;
  type: string;
  domain: string;
  count: number;
  tolerance: number;
  subtypes?: Record<string, { share: number; topics: string[] }>;
}

export interface MathDomain {
  domain: string;
  count: number;
  tolerance: number;
  share_target: number;
  subtopics: Record<string, number>;
}

export interface SatSpec {
  meta: Record<string, unknown>;
  adaptive_routing: {
    reading_writing: { module_1_questions: number; tiers: Tier[] };
    math: { module_1_questions: number; tiers: Tier[] };
    module_1_rule: string;
  };
  reading_writing: {
    questions_per_module: number;
    time_minutes: number;
    passage_length_words: [number, number];
    blueprint: RwBlock[];
  };
  math: {
    questions_per_module: number;
    time_minutes: number;
    format: { multiple_choice_share: number; spr_share: number; spr_count: number; spr_tolerance: number };
    domain_counts_per_module: MathDomain[];
    difficulty_curve_module: { q: number; difficulty: number }[];
  };
  scoring_model: {
    per_section: {
      scale: [number, number];
      tier_multipliers: Record<string, number>;
      tier_caps: Record<string, number>;
    };
  };
}

export const SPEC = specJson as unknown as SatSpec;

export function tiersFor(section: Section): Tier[] {
  return section === "MATH"
    ? SPEC.adaptive_routing.math.tiers
    : SPEC.adaptive_routing.reading_writing.tiers;
}

export function tierByNumber(section: Section, tier: number): Tier {
  const t = tiersFor(section).find((x) => x.tier === tier);
  if (!t) throw new Error(`No tier ${tier} for ${section}`);
  return t;
}

export function questionsPerModule(section: Section): number {
  return section === "MATH"
    ? SPEC.math.questions_per_module
    : SPEC.reading_writing.questions_per_module;
}

export function timeMinutes(section: Section): number {
  return section === "MATH" ? SPEC.math.time_minutes : SPEC.reading_writing.time_minutes;
}

/** The tier-3 baseline difficulty curve (per math question). */
export function mathDifficultyCurve(): number[] {
  return SPEC.math.difficulty_curve_module.map((c) => c.difficulty);
}
