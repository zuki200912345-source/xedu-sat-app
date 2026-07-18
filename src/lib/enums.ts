import { z } from "zod";

// SQLite doesn't support Prisma enums, so enum-like columns are Strings.
// These Zod schemas are the single source of truth — validate at every boundary.

export const Role = z.enum(["STUDENT", "TUTOR", "ADMIN"]);
export type Role = z.infer<typeof Role>;

export const Tier = z.enum(["FREE", "PLUS", "PREMIUM"]);
export type Tier = z.infer<typeof Tier>;

export const Section = z.enum(["RW", "MATH"]);
export type Section = z.infer<typeof Section>;

export const Difficulty = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof Difficulty>;

export const QuestionType = z.enum(["MCQ", "SPR"]);
export type QuestionType = z.infer<typeof QuestionType>;

// Module 1 is "BASE" (baseline tier 3); Module 2 variants are "TIER1".."TIER5".
export const ModulePath = z.enum(["BASE", "TIER1", "TIER2", "TIER3", "TIER4", "TIER5"]);
export type ModulePath = z.infer<typeof ModulePath>;

export const AttemptStatus = z.enum(["IN_PROGRESS", "BREAK", "COMPLETED", "ABANDONED"]);
export type AttemptStatus = z.infer<typeof AttemptStatus>;

export const VocabGrade = z.enum(["AGAIN", "HARD", "GOOD", "EASY"]);
export type VocabGrade = z.infer<typeof VocabGrade>;

export const RW_DOMAINS = {
  "Craft and Structure": [
    "Words in Context",
    "Text Structure and Purpose",
    "Cross-Text Connections",
  ],
  "Information and Ideas": [
    "Central Ideas and Details",
    "Command of Evidence",
    "Inferences",
  ],
  "Standard English Conventions": ["Boundaries", "Form, Structure, and Sense"],
  "Expression of Ideas": ["Rhetorical Synthesis", "Transitions"],
} as const;

export const MATH_DOMAINS = {
  Algebra: [
    "Linear Equations",
    "Linear Inequalities",
    "Systems of Linear Equations",
    "Linear Functions",
  ],
  "Advanced Math": [
    "Quadratics",
    "Exponentials",
    "Polynomials and Rational Expressions",
    "Radicals and Absolute Value",
    "Function Notation and Transformations",
    "Nonlinear Systems",
  ],
  "Problem-Solving and Data Analysis": [
    "Ratios and Rates",
    "Percentages",
    "Statistics",
    "Probability",
    "Two-Way Tables",
    "Scatterplots and Line of Best Fit",
  ],
  "Geometry and Trigonometry": [
    "Area and Volume",
    "Angles and Lines",
    "Triangles",
    "Circles",
    "Right-Triangle Trigonometry",
  ],
} as const;
