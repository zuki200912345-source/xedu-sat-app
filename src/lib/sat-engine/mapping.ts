// Maps XeduSAT's content model (section/domain/skill/difficulty-label/type) to
// the spec's vocabulary (type/subtype/domain/format/continuous-difficulty).
import type { DiffLabel } from "./spec";
import { hashSeed } from "./rng";

// ---- R&W: skill -> { type, subtype, domain } --------------------------------
interface RwMap {
  type: string;
  subtype: string | null;
  domain: string;
}
const RW_SKILL_MAP: Record<string, RwMap> = {
  "Words in Context": { type: "words_in_context", subtype: null, domain: "Craft and Structure" },
  "Text Structure and Purpose": { type: "text_structure_and_purpose", subtype: null, domain: "Craft and Structure" },
  "Cross-Text Connections": { type: "cross_text_connections", subtype: null, domain: "Craft and Structure" },
  "Central Ideas and Details": { type: "central_ideas_and_details", subtype: null, domain: "Information and Ideas" },
  Inferences: { type: "inferences", subtype: null, domain: "Information and Ideas" },
  Boundaries: { type: "standard_english_conventions", subtype: "punctuation_boundaries", domain: "Standard English Conventions" },
  "Form, Structure, and Sense": { type: "standard_english_conventions", subtype: "grammar_form_structure_sense", domain: "Standard English Conventions" },
  Transitions: { type: "transitions", subtype: null, domain: "Expression of Ideas" },
  "Rhetorical Synthesis": { type: "rhetorical_synthesis", subtype: null, domain: "Expression of Ideas" },
  // "Command of Evidence" is resolved dynamically (textual vs quantitative).
};

// ---- Math: domain -> spec domain key ----------------------------------------
const MATH_DOMAIN_MAP: Record<string, string> = {
  Algebra: "algebra",
  "Advanced Math": "advanced_math",
  "Problem-Solving and Data Analysis": "problem_solving_and_data_analysis",
  "Geometry and Trigonometry": "geometry_and_trigonometry",
};

// ---- Math: skill -> spec subtopic -------------------------------------------
const MATH_SUBTOPIC_MAP: Record<string, string> = {
  "Linear Equations": "linear_equations_one_variable",
  "Linear Functions": "linear_functions",
  "Systems of Linear Equations": "linear_equations_two_variables_and_systems",
  "Linear Inequalities": "linear_inequalities",
  Quadratics: "nonlinear_functions_quadratic_exponential_polynomial_rational_absolute_value",
  Exponentials: "nonlinear_functions_quadratic_exponential_polynomial_rational_absolute_value",
  "Polynomials and Rational Expressions": "equivalent_expressions",
  "Radicals and Absolute Value": "nonlinear_functions_quadratic_exponential_polynomial_rational_absolute_value",
  "Function Notation and Transformations": "nonlinear_functions_quadratic_exponential_polynomial_rational_absolute_value",
  "Nonlinear Systems": "nonlinear_equations_and_systems",
  "Ratios and Rates": "ratios_rates_proportions_units",
  Percentages: "percentages",
  Statistics: "one_variable_data_center_and_spread",
  Probability: "probability_and_conditional_probability",
  "Two-Way Tables": "probability_and_conditional_probability",
  "Scatterplots and Line of Best Fit": "two_variable_data_models_and_scatterplots",
  "Area and Volume": "area_and_volume",
  "Angles and Lines": "lines_angles_triangles",
  Triangles: "lines_angles_triangles",
  Circles: "circles",
  "Right-Triangle Trigonometry": "right_triangles_and_trigonometry",
};

export interface DbQuestionShape {
  id: string;
  section: string;
  domain: string;
  skill: string;
  type: string; // MCQ | SPR
  hasGraph: boolean;
}

export interface SpecFields {
  type: string;
  subtype: string | null;
  domain: string;
}

/** Resolve spec type/subtype/domain for a DB question. */
export function toSpecFields(q: DbQuestionShape): SpecFields {
  if (q.section === "MATH") {
    return {
      type: MATH_DOMAIN_MAP[q.domain] ?? "algebra",
      subtype: MATH_SUBTOPIC_MAP[q.skill] ?? null,
      domain: MATH_DOMAIN_MAP[q.domain] ?? "algebra",
    };
  }
  if (q.skill === "Command of Evidence") {
    return {
      type: q.hasGraph ? "command_of_evidence_quantitative" : "command_of_evidence_textual",
      subtype: null,
      domain: "Information and Ideas",
    };
  }
  return RW_SKILL_MAP[q.skill] ?? { type: "words_in_context", subtype: null, domain: "Craft and Structure" };
}

// ---- Continuous difficulty <-> label ----------------------------------------
const BANDS: Record<DiffLabel, [number, number]> = {
  easy: [1.0, 1.6],
  medium: [1.65, 2.35],
  hard: [2.4, 3.0],
};

/** Deterministic continuous difficulty within a label's band, keyed by id. */
export function difficultyValueFor(label: string, key: string): number {
  const band = BANDS[(label as DiffLabel)] ?? BANDS.medium;
  const frac = (hashSeed(key) % 1000) / 1000; // stable 0..1
  const value = band[0] + frac * (band[1] - band[0]);
  return Math.round(value * 100) / 100;
}

/** Label a continuous difficulty back into easy/medium/hard. */
export function bandOf(difficulty: number): DiffLabel {
  if (difficulty < 1.625) return "easy";
  if (difficulty < 2.375) return "medium";
  return "hard";
}

export const MATH_DOMAIN_KEYS = Object.values(MATH_DOMAIN_MAP);
