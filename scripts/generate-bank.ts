/**
 * Bulk question-bank generator for the two full adaptive mock tests.
 *
 * Authors ORIGINAL items with DeepSeek from attribute buckets (section/domain/
 * skill/difficulty), runs each through similarityGate(), and writes the
 * survivors to prisma/seed-data/generated-bank.json so that `npm run seed`
 * stays deterministic and offline (no API key needed to seed a fresh clone).
 *
 * The prompt passes ONLY attribute metadata — never copyrighted source text —
 * and requires plain-text math (no LaTeX) so items render in the runner.
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
const CONCURRENCY = 8;

// R&W skills by domain and Math skills by domain (blueprint).
const RW = {
  "Craft and Structure": ["Words in Context", "Text Structure and Purpose", "Cross-Text Connections"],
  "Information and Ideas": ["Central Ideas and Details", "Command of Evidence", "Inferences"],
  "Standard English Conventions": ["Boundaries", "Form, Structure, and Sense"],
  "Expression of Ideas": ["Transitions", "Rhetorical Synthesis"],
} as const;
const MATH = {
  Algebra: ["Linear Equations", "Linear Functions", "Systems of Linear Equations", "Linear Inequalities"],
  "Advanced Math": ["Quadratics", "Exponentials", "Polynomials and Rational Expressions", "Function Notation and Transformations", "Nonlinear Systems"],
  "Problem-Solving and Data Analysis": ["Ratios and Rates", "Percentages", "Statistics", "Probability", "Two-Way Tables"],
  "Geometry and Trigonometry": ["Area and Volume", "Triangles", "Circles", "Right-Triangle Trigonometry"],
} as const;

type Diff = "easy" | "medium" | "hard";
interface Job {
  section: "RW" | "MATH";
  domain: string;
  skill: string;
  difficulty: Diff;
  wantSPR: boolean;
}

/** Build the list of generation jobs to hit the pool targets per difficulty. */
function buildJobs(): Job[] {
  const jobs: Job[] = [];
  // Per-difficulty pool targets (large enough to assemble 2 distinct tests).
  const rwTargets: Record<Diff, number> = { easy: 34, medium: 46, hard: 34 };
  const mathTargets: Record<Diff, number> = { easy: 30, medium: 40, hard: 30 };

  const rwPairs = Object.entries(RW).flatMap(([domain, skills]) =>
    skills.map((skill) => ({ domain, skill })),
  );
  const mathPairs = Object.entries(MATH).flatMap(([domain, skills]) =>
    skills.map((skill) => ({ domain, skill })),
  );

  (["easy", "medium", "hard"] as Diff[]).forEach((difficulty) => {
    for (let i = 0; i < rwTargets[difficulty]; i++) {
      const p = rwPairs[i % rwPairs.length];
      jobs.push({ section: "RW", ...p, difficulty, wantSPR: false });
    }
    for (let i = 0; i < mathTargets[difficulty]; i++) {
      const p = mathPairs[i % mathPairs.length];
      // ~28% of math items are SPR, biased to Algebra/Advanced/PSDA skills.
      const wantSPR = i % 7 < 2 && p.domain !== "Geometry and Trigonometry";
      jobs.push({ section: "MATH", ...p, difficulty, wantSPR });
    }
  });
  return jobs;
}

const RW_SYSTEM =
  "You are a Digital SAT Reading & Writing item writer producing ORIGINAL, copyright-clean questions. " +
  "Invent entirely new content; never reproduce any real or published passage or question. " +
  "Exactly one of the four choices must be unambiguously correct. Respond with strict JSON only.";
const MATH_SYSTEM =
  "You are a Digital SAT Math item writer producing ORIGINAL, copyright-clean questions. " +
  "Use plain text math only (e.g. x^2, sqrt(), 1/2, pi) — NEVER LaTeX or backslashes. " +
  "Exactly one answer must be correct and numerically verifiable. Respond with strict JSON only.";

function rwPrompt(j: Job): string {
  return `Write one original ${j.difficulty} Reading & Writing question.
Domain: ${j.domain}
Skill: ${j.skill}

Requirements:
- Include an original short passage of 25-150 words in "passageContent".
- ${j.skill === "Cross-Text Connections" ? 'Use two short labeled texts ("Text 1:" and "Text 2:") in the passage.' : ""}
- The stem must be a standard SAT R&W prompt for this skill.
- Provide exactly 4 answer choices; one clearly correct.
Return JSON: {"type":"MCQ","passageContent":string,"stem":string,"choices":[string,string,string,string],"correctAnswer":"A"|"B"|"C"|"D","explanation":string}`;
}

function mathPrompt(j: Job): string {
  return `Write one original ${j.difficulty} Math question.
Domain: ${j.domain}
Skill: ${j.skill}
Format: ${j.wantSPR ? "Student-Produced Response (grid-in, no choices)" : "multiple choice with 4 options"}

Requirements:
- Plain text math only (x^2, sqrt(), fractions like 3/4). No LaTeX, no backslashes, no dollar signs.
- The question must be fully self-contained and have a single correct numeric answer.
${
  j.wantSPR
    ? '- Return JSON: {"type":"SPR","stem":string,"choices":null,"correctAnswer":string,"explanation":string} where correctAnswer is the exact numeric value (e.g. "8" or "3/4" or "0.5").'
    : '- Return JSON: {"type":"MCQ","stem":string,"choices":[string,string,string,string],"correctAnswer":"A"|"B"|"C"|"D","explanation":string}'
}`;
}

async function callDeepSeek(j: Job): Promise<SeedQuestion | null> {
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
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const p = JSON.parse(content) as Partial<SeedQuestion> & { passageContent?: string };
    if (!p.stem || !p.correctAnswer || !p.explanation) return null;

    const type = p.type === "SPR" ? "SPR" : "MCQ";
    // Reject LaTeX leakage or malformed choices.
    const text = `${p.passageContent ?? ""} ${p.stem} ${(p.choices ?? []).join(" ")}`;
    if (/\\[a-z(]|\$\$|\\\[|\\begin/i.test(text)) return null;
    if (type === "MCQ") {
      if (!Array.isArray(p.choices) || p.choices.length !== 4) return null;
      if (new Set(p.choices.map((c) => c.trim())).size !== 4) return null;
      if (!["A", "B", "C", "D"].includes(p.correctAnswer)) return null;
    }
    return {
      section: j.section,
      domain: j.domain,
      skill: j.skill,
      difficulty: j.difficulty,
      type,
      passageText: j.section === "RW" ? p.passageContent ?? undefined : undefined,
      stem: p.stem,
      choices: type === "MCQ" ? (p.choices as [string, string, string, string]) : undefined,
      correctAnswer: p.correctAnswer,
      explanation: p.explanation,
    };
  } catch {
    return null;
  }
}

async function main() {
  if (!API_KEY) {
    console.error("DEEPSEEK_API_KEY is required to generate the bank.");
    process.exit(1);
  }

  const jobs = buildJobs();
  console.log(`Generating ${jobs.length} items with concurrency ${CONCURRENCY}…`);

  // Similarity references: hand-authored bank + anything accepted so far.
  const referenceTexts: string[] = [...rwQuestions, ...mathQuestions].map((q) =>
    `${q.passageText ?? ""} ${q.stem}`,
  );
  const accepted: SeedQuestion[] = existsSync(OUT)
    ? (JSON.parse(readFileSync(OUT, "utf8")) as SeedQuestion[])
    : [];
  accepted.forEach((q) => referenceTexts.push(`${q.passageText ?? ""} ${q.stem}`));

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
          const gate = similarityGate(`${item.passageText ?? ""} ${item.stem}`, referenceTexts);
          if (!gate.ok) {
            rejected++;
          } else {
            accepted.push(item);
            referenceTexts.push(`${item.passageText ?? ""} ${item.stem}`);
          }
        }
        if (done % 10 === 0) {
          console.log(`  ${done}/${jobs.length} processed · ${accepted.length} accepted · ${rejected} rejected`);
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
  console.log(`\nDone. ${accepted.length} accepted, ${rejected} rejected.`);
  console.log("By bucket:", Object.fromEntries([...byBucket].sort()));
  console.log(`Wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
