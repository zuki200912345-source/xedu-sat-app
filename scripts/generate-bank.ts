/**
 * Bulk question-bank generator for the adaptive mock tests + practice pools.
 *
 * Authors ORIGINAL items with DeepSeek from attribute buckets
 * (section/domain/skill/SUBTOPIC/difficulty), runs each through
 * similarityGate(), and writes the survivors to
 * prisma/seed-data/generated-bank.json so that `npm run seed` stays
 * deterministic and offline (no API key needed to seed a fresh clone).
 *
 * The prompt passes ONLY attribute metadata and calibrated *style* guidance
 * distilled from official practice tests — never any copyrighted source text.
 * Every math item is plain-text (no LaTeX) so it renders in the runner.
 *
 * Taxonomy is the official Digital SAT blueprint: 4 R&W domains + 4 Math
 * domains, each broken into the skills and subtopics College Board publishes.
 * Each (skill, subtopic) is generated across easy/medium/hard to build deep,
 * even pools the engine and practice drills can draw from.
 *
 * Run: DEEPSEEK_API_KEY=... npx tsx scripts/generate-bank.ts
 */
import { writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { similarityGate } from "./generate-questions";
import { rwQuestions } from "../prisma/seed-data/rw-questions";
import { mathQuestions } from "../prisma/seed-data/math-questions";
import type { SeedQuestion } from "../prisma/seed-data/types";

const OUT = join(__dirname, "../prisma/seed-data/generated-bank.json");
const API_KEY = process.env.DEEPSEEK_API_KEY;
const CONCURRENCY = Number(process.env.GEN_CONCURRENCY ?? 10);
// Items to author per (subtopic × difficulty) bucket before similarity gating.
const PER_BUCKET = Number(process.env.GEN_PER_BUCKET ?? 18);
const MAX_RETRIES = 3;

type Diff = "easy" | "medium" | "hard";

interface Subtopic {
  key: string; // stored on each item; snake_case
  focus: string; // what the item should test (guides the model)
}
interface SkillDef {
  domain: string;
  skill: string; // MUST exist in mapping.ts so spec subtype resolves
  stem: string; // calibrated canonical SAT stem for this skill
  quantitative?: boolean; // include a small data table (graphSpec)
  subtopics: Subtopic[];
}

// ---------------------------------------------------------------------------
// READING & WRITING taxonomy (skill names match RW_SKILL_MAP in mapping.ts)
// ---------------------------------------------------------------------------
const RW_SKILLS: SkillDef[] = [
  {
    domain: "Craft and Structure",
    skill: "Words in Context",
    stem: "Which choice completes the text with the most logical and precise word or phrase?",
    subtopics: [
      { key: "single_word_choice", focus: "choosing the single most precise word for a blank" },
      { key: "phrase_in_context", focus: "choosing the most logical short phrase for a blank" },
    ],
  },
  {
    domain: "Craft and Structure",
    skill: "Text Structure and Purpose",
    stem: "Which choice best describes the function of the underlined portion in the text as a whole?",
    subtopics: [
      { key: "function_of_a_portion", focus: "the rhetorical function of an underlined sentence/portion" },
      { key: "overall_structure", focus: "the overall structure or main purpose of the whole text" },
    ],
  },
  {
    domain: "Craft and Structure",
    skill: "Cross-Text Connections",
    stem: "Based on the texts, how would the author of Text 2 most likely respond to the view presented in Text 1?",
    subtopics: [
      { key: "compare_viewpoints", focus: "how one author would respond to or evaluate the other's claim" },
    ],
  },
  {
    domain: "Information and Ideas",
    skill: "Central Ideas and Details",
    stem: "Which choice best states the main idea of the text?",
    subtopics: [
      { key: "main_idea", focus: "the central idea of the passage" },
      { key: "supporting_detail", focus: "a specific detail stated in the passage" },
    ],
  },
  {
    domain: "Information and Ideas",
    skill: "Command of Evidence",
    stem: "Which finding, if true, would most directly support the researcher's claim in the text?",
    subtopics: [
      { key: "textual_evidence", focus: "which statement would most support/weaken the claim" },
    ],
  },
  {
    domain: "Information and Ideas",
    skill: "Command of Evidence",
    quantitative: true,
    stem: "Which choice most effectively uses data from the table to support the claim?",
    subtopics: [
      { key: "quantitative_evidence", focus: "reading a small data table to support a claim" },
    ],
  },
  {
    domain: "Information and Ideas",
    skill: "Inferences",
    stem: "Which choice most logically completes the text?",
    subtopics: [
      { key: "logical_completion", focus: "the inference that most logically completes the passage" },
    ],
  },
  {
    domain: "Standard English Conventions",
    skill: "Boundaries",
    stem: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    subtopics: [
      { key: "end_punctuation_and_semicolons", focus: "sentence boundaries: periods vs semicolons vs comma splices" },
      { key: "commas", focus: "comma use: items in a series, nonrestrictive elements, after intro phrases" },
      { key: "colons_and_dashes", focus: "colons and dashes introducing or setting off information" },
      { key: "parenthetical_and_supplementary", focus: "punctuating supplementary/parenthetical elements consistently" },
    ],
  },
  {
    domain: "Standard English Conventions",
    skill: "Form, Structure, and Sense",
    stem: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    subtopics: [
      { key: "subject_verb_agreement", focus: "subject-verb agreement, including tricky intervening phrases" },
      { key: "verb_tense_and_form", focus: "verb tense, aspect, and form consistency" },
      { key: "pronoun_agreement", focus: "pronoun-antecedent agreement and clear reference" },
      { key: "modifier_placement", focus: "logical placement of modifiers / avoiding dangling modifiers" },
      { key: "plural_and_possessive", focus: "plural vs possessive nouns and apostrophe use" },
    ],
  },
  {
    domain: "Expression of Ideas",
    skill: "Transitions",
    stem: "Which choice completes the text with the most logical transition?",
    subtopics: [
      { key: "transition_logic", focus: "the transition word/phrase that fits the logical relationship" },
    ],
  },
  {
    domain: "Expression of Ideas",
    skill: "Rhetorical Synthesis",
    stem: "The student wants to accomplish a specific goal. Which choice most effectively uses relevant information from the notes to accomplish the goal?",
    subtopics: [
      { key: "synthesize_notes", focus: "using bulleted study notes to meet a stated rhetorical goal" },
    ],
  },
];

// ---------------------------------------------------------------------------
// MATH taxonomy (skill names match MATH_SUBTOPIC_MAP in mapping.ts)
// ---------------------------------------------------------------------------
const MATH_SKILLS: SkillDef[] = [
  {
    domain: "Algebra",
    skill: "Linear Equations",
    stem: "",
    subtopics: [
      { key: "one_variable_linear_equation", focus: "solving a linear equation in one variable" },
      { key: "linear_equation_word_problem", focus: "modeling a real-world situation with a linear equation" },
    ],
  },
  {
    domain: "Algebra",
    skill: "Linear Functions",
    stem: "",
    subtopics: [
      { key: "slope_and_intercept", focus: "slope, intercepts, and equations of lines" },
      { key: "interpret_linear_model", focus: "interpreting slope/intercept of a linear model in context" },
    ],
  },
  {
    domain: "Algebra",
    skill: "Systems of Linear Equations",
    stem: "",
    subtopics: [
      { key: "solve_linear_system", focus: "solving a system of two linear equations" },
      { key: "system_word_problem", focus: "setting up and solving a system from a word problem" },
    ],
  },
  {
    domain: "Algebra",
    skill: "Linear Inequalities",
    stem: "",
    subtopics: [
      { key: "one_variable_inequality", focus: "solving/interpreting a one-variable linear inequality" },
      { key: "system_of_inequalities", focus: "systems of linear inequalities and feasible regions" },
    ],
  },
  {
    domain: "Advanced Math",
    skill: "Quadratics",
    stem: "",
    subtopics: [
      { key: "solve_quadratic", focus: "solving quadratic equations (factoring, formula, completing square)" },
      { key: "quadratic_features", focus: "vertex, roots, and graph features of a parabola" },
    ],
  },
  {
    domain: "Advanced Math",
    skill: "Exponentials",
    stem: "",
    subtopics: [
      { key: "exponential_growth_decay", focus: "exponential growth/decay models and their parameters" },
    ],
  },
  {
    domain: "Advanced Math",
    skill: "Polynomials and Rational Expressions",
    stem: "",
    subtopics: [
      { key: "equivalent_expressions", focus: "rewriting polynomial expressions in equivalent form" },
      { key: "rational_expressions", focus: "operations with rational expressions and their restrictions" },
    ],
  },
  {
    domain: "Advanced Math",
    skill: "Function Notation and Transformations",
    stem: "",
    subtopics: [
      { key: "evaluate_and_compose", focus: "evaluating and composing functions in function notation" },
      { key: "transformations", focus: "shifts, reflections, and scalings of a function's graph" },
    ],
  },
  {
    domain: "Advanced Math",
    skill: "Nonlinear Systems",
    stem: "",
    subtopics: [
      { key: "nonlinear_system", focus: "solving a system with a line and a nonlinear curve" },
    ],
  },
  {
    domain: "Advanced Math",
    skill: "Radicals and Absolute Value",
    stem: "",
    subtopics: [
      { key: "radical_equations", focus: "equations involving square roots / radicals" },
      { key: "absolute_value", focus: "absolute-value equations and their solutions" },
    ],
  },
  {
    domain: "Problem-Solving and Data Analysis",
    skill: "Ratios and Rates",
    stem: "",
    subtopics: [
      { key: "ratios_and_proportions", focus: "solving proportions and ratio relationships" },
      { key: "rates_and_units", focus: "unit rates and unit conversions" },
    ],
  },
  {
    domain: "Problem-Solving and Data Analysis",
    skill: "Percentages",
    stem: "",
    subtopics: [
      { key: "percent_of_a_quantity", focus: "finding a percent of a quantity / reverse percent" },
      { key: "percent_change", focus: "percent increase/decrease and successive changes" },
    ],
  },
  {
    domain: "Problem-Solving and Data Analysis",
    skill: "Statistics",
    stem: "",
    subtopics: [
      { key: "measures_of_center", focus: "mean, median, and mode of a data set" },
      { key: "measures_of_spread", focus: "range and standard-deviation comparisons" },
    ],
  },
  {
    domain: "Problem-Solving and Data Analysis",
    skill: "Probability",
    stem: "",
    subtopics: [
      { key: "simple_probability", focus: "probability of a single event" },
      { key: "conditional_probability", focus: "conditional probability from a described scenario" },
    ],
  },
  {
    domain: "Problem-Solving and Data Analysis",
    skill: "Two-Way Tables",
    quantitative: true,
    stem: "",
    subtopics: [
      { key: "two_way_frequency", focus: "reading a two-way frequency table to find a probability or count" },
    ],
  },
  {
    domain: "Problem-Solving and Data Analysis",
    skill: "Scatterplots and Line of Best Fit",
    stem: "",
    subtopics: [
      { key: "line_of_best_fit", focus: "interpreting/estimating from a line of best fit" },
    ],
  },
  {
    domain: "Geometry and Trigonometry",
    skill: "Area and Volume",
    stem: "",
    subtopics: [
      { key: "area_and_perimeter", focus: "area and perimeter of 2-D figures" },
      { key: "volume_of_solids", focus: "volume and surface area of 3-D solids" },
    ],
  },
  {
    domain: "Geometry and Trigonometry",
    skill: "Angles and Lines",
    stem: "",
    subtopics: [
      { key: "parallel_lines_and_angles", focus: "angle relationships from parallel lines and transversals" },
    ],
  },
  {
    domain: "Geometry and Trigonometry",
    skill: "Triangles",
    stem: "",
    subtopics: [
      { key: "triangle_properties", focus: "angle sums, the Pythagorean theorem, and triangle side relationships" },
      { key: "similar_triangles", focus: "similarity and proportional sides in triangles" },
    ],
  },
  {
    domain: "Geometry and Trigonometry",
    skill: "Circles",
    stem: "",
    subtopics: [
      { key: "circle_equations", focus: "equations of circles in the xy-plane" },
      { key: "arcs_and_sectors", focus: "arc length, sector area, and central/inscribed angles" },
    ],
  },
  {
    domain: "Geometry and Trigonometry",
    skill: "Right-Triangle Trigonometry",
    stem: "",
    subtopics: [
      { key: "sohcahtoa", focus: "sine, cosine, and tangent ratios in right triangles" },
      { key: "special_right_triangles", focus: "30-60-90 and 45-45-90 special right triangles" },
    ],
  },
];

// Context themes injected per item so passages/stems within one bucket vary in
// subject matter — this mirrors the real test's topic range and keeps generated
// items distinct enough to clear the similarity gate.
const RW_THEMES = [
  "a historical event or figure", "a scientific discovery", "an ecology/environment topic",
  "a work of literature or an author", "a visual or performing artist", "an economics or business idea",
  "an archaeology or anthropology finding", "a technology or engineering advance", "astronomy or space",
  "a public-health or medicine topic", "a linguistics or language topic", "a psychology study",
  "a geology or earth-science topic", "a sports or games topic", "a music or dance tradition",
  "a civics or government topic", "a food or agriculture topic", "a marine-biology topic",
  "an architecture or design topic", "a folklore or mythology tradition",
];
const MATH_THEMES = [
  "sports statistics", "cooking or recipes", "personal finance", "a science experiment",
  "population or demographics", "manufacturing or production", "travel and distance",
  "gardening or agriculture", "retail pricing and discounts", "temperature or weather",
  "construction or architecture", "fitness and health", "music or media streaming",
  "school or classroom data", "wildlife or ecology counts", "fuel or energy use",
  "a gaming or app scenario", "shipping and logistics", "art or crafting supplies", "a fundraising drive",
];
function pickTheme(section: "RW" | "MATH"): string {
  const list = section === "RW" ? RW_THEMES : MATH_THEMES;
  return list[Math.floor(Math.random() * list.length)];
}

interface Job {
  section: "RW" | "MATH";
  def: SkillDef;
  subtopic: Subtopic;
  difficulty: Diff;
  wantSPR: boolean;
  theme: string;
}

/** Enumerate every (skill, subtopic, difficulty) bucket PER_BUCKET times. */
function buildJobs(): Job[] {
  const jobs: Job[] = [];
  const diffs: Diff[] = ["easy", "medium", "hard"];
  let mathSeq = 0;
  for (const def of RW_SKILLS) {
    for (const subtopic of def.subtopics) {
      for (const difficulty of diffs) {
        for (let i = 0; i < PER_BUCKET; i++) {
          jobs.push({ section: "RW", def, subtopic, difficulty, wantSPR: false, theme: pickTheme("RW") });
        }
      }
    }
  }
  for (const def of MATH_SKILLS) {
    for (const subtopic of def.subtopics) {
      for (const difficulty of diffs) {
        for (let i = 0; i < PER_BUCKET; i++) {
          // ~26% of math items are SPR, biased away from Geometry/quantitative.
          const sprEligible = def.domain !== "Geometry and Trigonometry" && !def.quantitative;
          const wantSPR = sprEligible && mathSeq % 4 === 0;
          mathSeq++;
          jobs.push({ section: "MATH", def, subtopic, difficulty, wantSPR, theme: pickTheme("MATH") });
        }
      }
    }
  }
  return jobs;
}

const RW_SYSTEM =
  "You are a Digital SAT Reading & Writing item writer producing ORIGINAL, copyright-clean questions. " +
  "Invent entirely new content; never reproduce any real or published passage or question. " +
  "Match the concise, formal style of the official Digital SAT. " +
  "Exactly one of the four choices must be unambiguously correct. Respond with strict JSON only.";
const MATH_SYSTEM =
  "You are a Digital SAT Math item writer producing ORIGINAL, copyright-clean questions. " +
  "Use plain text math only (e.g. x^2, sqrt(), 1/2, pi) — NEVER LaTeX or backslashes or dollar signs. " +
  "Keep stems concise like the real Digital SAT. " +
  "Exactly one answer must be correct and numerically verifiable. Respond with strict JSON only.";

const DIFF_GUIDE: Record<Diff, string> = {
  easy: "Easy: one direct step, friendly numbers, no traps.",
  medium: "Medium: two steps or a modeling step; a plausible distractor.",
  hard: "Hard: multi-step reasoning or an abstract setup; distractors reflect real mistakes.",
};

function rwPrompt(j: Job): string {
  const twoTexts = j.def.skill === "Cross-Text Connections";
  const synthesis = j.def.skill === "Rhetorical Synthesis";
  const quant = j.def.quantitative;
  return `Write one original ${j.difficulty} Reading & Writing question.
Domain: ${j.def.domain}
Skill: ${j.def.skill}
Subtopic focus: ${j.subtopic.focus}
Subject matter: build the passage around ${j.theme} (invent the specifics).
${DIFF_GUIDE[j.difficulty]}

Requirements:
- Put the stimulus in "passageContent".
${twoTexts ? '- Use two short labeled texts ("Text 1:" then "Text 2:"), 40-80 words each, expressing related but distinct views.' : ""}
${synthesis ? '- The passage must be 4-6 short bulleted notes (start each line with "- "), then the stem states the student\'s goal.' : ""}
${quant ? '- Include a 2-4 row data table described in words inside the passage, AND return a "graphSpec" object: {"type":"table","title":string,"headers":[string,...],"rows":[[...],...]}.' : ""}
${!twoTexts && !synthesis ? "- The passage is an original 25-120 word paragraph." : ""}
- Use this exact stem (or a close variant): "${j.def.stem}"
- Provide exactly 4 answer choices; exactly one clearly correct.
- Keep the explanation to 1-3 sentences saying why the key is right.
Return JSON: {"type":"MCQ","passageContent":string,${quant ? '"graphSpec":object,' : ""}"stem":string,"choices":[string,string,string,string],"correctAnswer":"A"|"B"|"C"|"D","explanation":string}`;
}

function mathPrompt(j: Job): string {
  const quant = j.def.quantitative;
  return `Write one original ${j.difficulty} Math question.
Domain: ${j.def.domain}
Skill: ${j.def.skill}
Subtopic focus: ${j.subtopic.focus}
Variety hint: if a word problem fits this skill naturally, set it around ${j.theme}; otherwise keep it purely abstract. Vary the numbers.
Format: ${j.wantSPR ? "Student-Produced Response (grid-in, no choices)" : "multiple choice with 4 options"}
${DIFF_GUIDE[j.difficulty]}

Requirements:
- Plain text math only (x^2, sqrt(), fractions like 3/4). No LaTeX, no backslashes, no dollar signs.
- The question must be fully self-contained and have a single correct answer.
${quant ? '- Base the question on a 2-4 row data table AND return a "graphSpec": {"type":"table","title":string,"headers":[string,...],"rows":[[...],...]}. Describe the table in the stem too.' : ""}
${
  j.wantSPR
    ? '- Return JSON: {"type":"SPR",' + (quant ? '"graphSpec":object,' : "") + '"stem":string,"choices":null,"correctAnswer":string,"explanation":string} where correctAnswer is the exact value (e.g. "8" or "3/4" or "0.5"). If more than one form is acceptable, join them with "|" (e.g. "3/4|0.75").'
    : '- Return JSON: {"type":"MCQ",' + (quant ? '"graphSpec":object,' : "") + '"stem":string,"choices":[string,string,string,string],"correctAnswer":"A"|"B"|"C"|"D","explanation":string}'
}
- Keep the explanation to 1-3 sentences with the key steps.`;
}

interface GraphSpec {
  type: "table";
  title: string;
  headers: string[];
  rows: (string | number)[][];
}
function validGraphSpec(g: unknown): GraphSpec | undefined {
  if (!g || typeof g !== "object") return undefined;
  const o = g as Record<string, unknown>;
  if (o.type !== "table" || !Array.isArray(o.headers) || !Array.isArray(o.rows)) return undefined;
  if (!o.headers.every((h) => typeof h === "string")) return undefined;
  if (!o.rows.every((r) => Array.isArray(r))) return undefined;
  return {
    type: "table",
    title: typeof o.title === "string" ? o.title : "",
    headers: o.headers as string[],
    rows: o.rows as (string | number)[][],
  };
}

async function callOnce(j: Job): Promise<SeedQuestion | null> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: j.section === "RW" ? RW_SYSTEM : MATH_SYSTEM },
        { role: "user", content: j.section === "RW" ? rwPrompt(j) : mathPrompt(j) },
      ],
      response_format: { type: "json_object" },
      temperature: 1.1,
    }),
  });
  if (!res.ok) {
    if (res.status === 429 || res.status >= 500) throw new Error(`retryable ${res.status}`);
    return null;
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  const p = JSON.parse(content) as Partial<SeedQuestion> & {
    passageContent?: string;
    graphSpec?: unknown;
  };
  if (!p.stem || p.correctAnswer == null || !p.explanation) return null;

  const type = p.type === "SPR" ? "SPR" : "MCQ";
  const graphSpec = validGraphSpec(p.graphSpec);
  // Reject LaTeX leakage or malformed choices.
  const text = `${p.passageContent ?? ""} ${p.stem} ${(p.choices ?? []).join(" ")}`;
  if (/\\[a-z(]|\$\$|\\\[|\\begin/i.test(text)) return null;
  if (type === "MCQ") {
    if (!Array.isArray(p.choices) || p.choices.length !== 4) return null;
    if (new Set(p.choices.map((c) => String(c).trim())).size !== 4) return null;
    if (!["A", "B", "C", "D"].includes(String(p.correctAnswer))) return null;
  }
  return {
    section: j.section,
    domain: j.def.domain,
    skill: j.def.skill,
    subtopic: j.subtopic.key,
    difficulty: j.difficulty,
    type,
    passageText: j.section === "RW" ? p.passageContent ?? undefined : undefined,
    graphSpec: graphSpec,
    stem: p.stem,
    choices: type === "MCQ" ? (p.choices as [string, string, string, string]) : undefined,
    correctAnswer: String(p.correctAnswer),
    explanation: p.explanation,
  };
}

async function callDeepSeek(j: Job): Promise<SeedQuestion | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await callOnce(j);
    } catch {
      // exponential backoff on retryable errors / transient parse failures
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    }
  }
  return null;
}

async function main() {
  if (!API_KEY) {
    console.error("DEEPSEEK_API_KEY is required to generate the bank.");
    process.exit(1);
  }

  const jobs = buildJobs();
  console.log(
    `Generating up to ${jobs.length} items (PER_BUCKET=${PER_BUCKET}) with concurrency ${CONCURRENCY}…`,
  );

  // Text used for similarity gating: the UNIQUE part of an item. R&W buckets
  // deliberately share one canonical stem, so gating on the stem would flag
  // every item in a bucket as a duplicate — gate on the passage instead. Math
  // stems vary per item, so gate on the stem.
  const gateText = (q: { section: "RW" | "MATH"; passageText?: string; stem: string }): string =>
    q.section === "RW" ? q.passageText || q.stem : q.stem;

  // Similarity references: hand-authored bank + anything accepted so far.
  const referenceTexts: string[] = [...rwQuestions, ...mathQuestions].map((q) =>
    q.passageText || q.stem,
  );
  // Fresh bank each run so PER_BUCKET controls the size deterministically.
  const accepted: SeedQuestion[] = [];

  let done = 0;
  let rejected = 0;
  const queue = [...jobs];

  async function worker() {
    while (queue.length) {
      const job = queue.pop()!;
      try {
        const item = await callDeepSeek(job);
        done++;
        if (!item) {
          rejected++;
        } else {
          const gt = gateText(item);
          const gate = similarityGate(gt, referenceTexts);
          if (!gate.ok) {
            rejected++;
          } else {
            accepted.push(item);
            referenceTexts.push(gt);
          }
        }
        if (done % 25 === 0) {
          console.log(
            `  ${done}/${jobs.length} processed · ${accepted.length} accepted · ${rejected} rejected`,
          );
          writeFileSync(OUT, JSON.stringify(accepted, null, 2));
        }
      } catch {
        done++;
        rejected++;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  writeFileSync(OUT, JSON.stringify(accepted, null, 2));

  const byBucket = new Map<string, number>();
  for (const q of accepted) {
    const k = `${q.section} ${q.difficulty}`;
    byBucket.set(k, (byBucket.get(k) ?? 0) + 1);
  }
  const subtopics = new Set(accepted.map((q) => `${q.section}/${q.skill}/${q.subtopic}`));
  console.log(`\nDone. ${accepted.length} accepted, ${rejected} rejected.`);
  console.log("By bucket:", Object.fromEntries([...byBucket].sort()));
  console.log(`Distinct subtopics covered: ${subtopics.size}`);
  console.log(`Wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
