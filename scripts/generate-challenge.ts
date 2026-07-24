/**
 * Challenge-set generator — a small batch of the HARDEST original items, pinned
 * to the top of the difficulty scale (difficultyValue ~2.95) so they are the
 * toughest questions in the bank and surface in hard modules / hard drills.
 *
 * These target the most discriminating Digital SAT skills and demand genuine
 * multi-step reasoning, while keeping a single, verifiable correct answer and
 * staying original (copyright-clean). Plain-text math only.
 *
 * Run: DEEPSEEK_API_KEY=... npx tsx scripts/generate-challenge.ts
 */
import { writeFileSync } from "fs";
import { join } from "path";
import type { SeedQuestion } from "../prisma/seed-data/types";
import { mathUnsafe, remapExplanation } from "./remap-letters";

const OUT = join(__dirname, "../prisma/seed-data/challenge-bank.json");
const API_KEY = process.env.DEEPSEEK_API_KEY;
const PIN = 2.95; // top of the hard band [2.4, 3.0]

interface Spec {
  section: "RW" | "MATH";
  domain: string;
  skill: string; // must exist in mapping.ts
  subtopic: string;
  wantSPR?: boolean;
  brief: string; // what makes this item genuinely hard
}

const SPECS: Spec[] = [
  {
    section: "RW",
    domain: "Information and Ideas",
    skill: "Inferences",
    subtopic: "logical_completion",
    brief:
      "A dense science/economics passage with a subtle logical structure; the correct inference requires combining two premises, and every distractor is a tempting near-miss.",
  },
  {
    section: "RW",
    domain: "Craft and Structure",
    skill: "Cross-Text Connections",
    subtopic: "compare_viewpoints",
    brief:
      "Two scholarly texts that partially agree; the question asks how Author 2 would nuance a SPECIFIC qualifying claim from Text 1 — not a simple agree/disagree.",
  },
  {
    section: "RW",
    domain: "Expression of Ideas",
    skill: "Rhetorical Synthesis",
    subtopic: "synthesize_notes",
    brief:
      "6 bulleted notes with overlapping facts; the goal demands selecting the two that jointly satisfy a precise rhetorical purpose, with distractors that each satisfy only half.",
  },
  {
    section: "RW",
    domain: "Information and Ideas",
    skill: "Command of Evidence",
    subtopic: "textual_evidence",
    brief:
      "An experimental result where the correct choice must both support the hypothesis AND rule out a confound; distractors support it but ignore the confound.",
  },
  {
    section: "MATH",
    domain: "Advanced Math",
    skill: "Quadratics",
    subtopic: "quadratic_features",
    brief:
      "A parameterized quadratic where a discriminant-zero or vertex condition yields a value of an unknown constant; a single well-defined positive answer.",
    wantSPR: true,
  },
  {
    section: "MATH",
    domain: "Advanced Math",
    skill: "Exponentials",
    subtopic: "exponential_growth_decay",
    brief:
      "An exponential growth/decay model where a stated later value pins the rate or time; solve with logs or clean integer exponents for one exact value.",
    wantSPR: true,
  },
  {
    section: "MATH",
    domain: "Advanced Math",
    skill: "Function Notation and Transformations",
    subtopic: "evaluate_and_compose",
    brief:
      "A linear/quadratic f given explicitly, then a composition like g(x)=f(ax+b)+c with one output constraint pinning a constant; careful but unambiguous.",
    wantSPR: true,
  },
  {
    section: "MATH",
    domain: "Advanced Math",
    skill: "Polynomials and Rational Expressions",
    subtopic: "equivalent_expressions",
    brief:
      "Matching coefficients between an expanded product and a target polynomial to solve for an unknown constant; one exact value.",
    wantSPR: true,
  },
  {
    section: "MATH",
    domain: "Problem-Solving and Data Analysis",
    skill: "Percentages",
    subtopic: "percent_change",
    brief:
      "Successive percent changes plus a mixture/weighted step that resolves to one exact numeric answer; multi-step but fully determined.",
    wantSPR: true,
  },
  {
    section: "MATH",
    domain: "Geometry and Trigonometry",
    skill: "Right-Triangle Trigonometry",
    subtopic: "sohcahtoa",
    brief:
      "A SINGLE right triangle: given one trig ratio and one side, find another side. Do NOT use multiple triangles or collinear-point constructions.",
    wantSPR: true,
  },
];

const RW_SYSTEM =
  "You are a Digital SAT Reading & Writing item writer producing ORIGINAL, copyright-clean questions at the HARDEST difficulty level. " +
  "Invent entirely new content; never reproduce any real passage. Exactly one choice is defensibly correct; distractors must be genuinely tempting. Respond with strict JSON only.";
const MATH_SYSTEM =
  "You are a Digital SAT Math item writer producing ORIGINAL, copyright-clean questions at the HARDEST difficulty level. " +
  "Use plain text math only (x^2, sqrt(), 1/2, pi) — NEVER LaTeX, backslashes, or dollar signs. " +
  "The item must require multi-step reasoning yet have a single, numerically verifiable answer. Respond with strict JSON only.";

function prompt(s: Spec): string {
  if (s.section === "RW") {
    const two = s.skill === "Cross-Text Connections";
    const synth = s.skill === "Rhetorical Synthesis";
    return `Write ONE very hard, original Digital SAT Reading & Writing question.
Skill: ${s.skill}
What makes it hard: ${s.brief}
${two ? 'Use two labeled texts ("Text 1:" then "Text 2:") in "passageContent".' : ""}
${synth ? 'Make "passageContent" 6 bulleted notes (each line starts with "- "), then a precise goal in the stem.' : ""}
Provide exactly 4 choices; exactly one correct; distractors must reflect real high-scorer mistakes.
Return JSON: {"type":"MCQ","passageContent":string,"stem":string,"choices":[string,string,string,string],"correctAnswer":"A"|"B"|"C"|"D","explanation":string}`;
  }
  return `Write ONE very hard, original Digital SAT Math question.
Skill: ${s.skill}
What makes it hard: ${s.brief}
Format: ${s.wantSPR ? "Student-Produced Response (grid-in, no choices)" : "multiple choice with 4 options"}
Plain text math only. Fully self-contained, single correct answer, requires multiple steps.
${
  s.wantSPR
    ? 'Return JSON: {"type":"SPR","stem":string,"choices":null,"correctAnswer":string,"explanation":string} (join multiple accepted forms with "|").'
    : 'Return JSON: {"type":"MCQ","stem":string,"choices":[string,string,string,string],"correctAnswer":"A"|"B"|"C"|"D","explanation":string}'
}
Keep the explanation to the key steps.`;
}

async function chat(system: string, user: string, temperature: number): Promise<string> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: "deepseek-v4-pro",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature,
    }),
  });
  if (!res.ok) throw new Error(`http ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("empty");
  return content;
}

function normNum(s: string): number | null {
  const t = s.trim().replace(/\s+/g, "");
  if (/^-?\d+\/\d+$/.test(t)) {
    const [a, b] = t.split("/").map(Number);
    return b === 0 ? null : a / b;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function numEq(a: string, b: string): boolean {
  if (a.trim() === b.trim()) return true;
  const na = normNum(a);
  const nb = normNum(b);
  return na != null && nb != null && Math.abs(na - nb) < 1e-6;
}

const SOLVER_SYS =
  "You are a meticulous math solver. Solve exactly. If the problem is contradictory, " +
  "over-constrained, or otherwise ill-posed, set well_posed=false. Return strict JSON only.";

async function solveSPR(stem: string, temperature: number): Promise<{ answer: string; well_posed: boolean } | null> {
  try {
    const out = await chat(
      SOLVER_SYS,
      `Solve step by step and give the final numeric value.\n${stem}\nReturn JSON: {"answer": string, "well_posed": boolean}`,
      temperature,
    );
    const j = JSON.parse(out) as { answer?: string; well_posed?: boolean };
    if (j.answer == null) return null;
    return { answer: String(j.answer), well_posed: j.well_posed !== false };
  } catch {
    return null;
  }
}

/**
 * Correctness gate. For grid-in math, TWO independent solvers must both find the
 * item well-posed and agree with each other AND the stated answer — this catches
 * over-constrained/contradictory setups a single solver rationalizes past. RW
 * items are checked by an independent answer-picker.
 */
async function verify(item: SeedQuestion): Promise<boolean> {
  try {
    if (item.section === "MATH" && item.type === "SPR") {
      const accepted = item.correctAnswer.split("|");
      const [a, b] = await Promise.all([solveSPR(item.stem, 0.1), solveSPR(item.stem, 0.4)]);
      if (!a || !b || !a.well_posed || !b.well_posed) return false;
      if (!numEq(a.answer, b.answer)) return false; // solvers must agree with each other
      return accepted.some((acc) => numEq(acc, a.answer)); // and with the stated key
    }
    // RW MCQ: independent solver picks the letter it believes is correct.
    const out = await chat(
      "You are a careful SAT Reading & Writing solver. Choose the single best answer. If no choice is defensibly correct, set well_posed=false. Return strict JSON only.",
      `${item.passageText ? item.passageText + "\n\n" : ""}${item.stem}\n${(item.choices ?? [])
        .map((c, i) => `${"ABCD"[i]}) ${c}`)
        .join("\n")}\nReturn JSON: {"choice":"A"|"B"|"C"|"D","well_posed":boolean}`,
      0.1,
    );
    const j = JSON.parse(out) as { choice?: string; well_posed?: boolean };
    if (j.well_posed === false) return false;
    return j.choice === item.correctAnswer;
  } catch {
    return false;
  }
}

async function author(s: Spec): Promise<SeedQuestion | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const content = await chat(s.section === "RW" ? RW_SYSTEM : MATH_SYSTEM, prompt(s), 0.9);
      const p = JSON.parse(content) as Partial<SeedQuestion> & { passageContent?: string };
      if (!p.stem || p.correctAnswer == null || !p.explanation) throw new Error("missing fields");
      const type = p.type === "SPR" ? "SPR" : "MCQ";
      const text = `${p.passageContent ?? ""} ${p.stem} ${(p.choices ?? []).join(" ")}`;
      if (/\\[a-z(]|\$\$|\\\[|\\begin/i.test(text)) throw new Error("latex leak");
      if (type === "MCQ") {
        if (!Array.isArray(p.choices) || p.choices.length !== 4) throw new Error("choices");
        if (new Set(p.choices.map((c) => String(c).trim())).size !== 4) throw new Error("dup choices");
        if (!["A", "B", "C", "D"].includes(String(p.correctAnswer))) throw new Error("key");
        // SAT-01: shuffle at authoring time so the key position is uniform.
        const letters = ["A", "B", "C", "D"];
        const order = [0, 1, 2, 3];
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }
        const oldIdx = letters.indexOf(String(p.correctAnswer));
        p.choices = order.map((i) => (p.choices as string[])[i]) as typeof p.choices;
        p.correctAnswer = letters[order.indexOf(oldIdx)];
        // Remap any letter references in the explanation through the permutation
        // (skip when MATH letters could be geometry labels/variables — rare in
        // fresh authoring, and the item text itself is still valid unshuffled refs
        // are not introduced by generation in that case).
        const perm = [0, 1, 2, 3].map((o) => order.indexOf(o));
        const sec = s.section;
        if (p.explanation && !(sec === "MATH" && mathUnsafe(p.explanation))) {
          p.explanation = remapExplanation(p.explanation, sec as "RW" | "MATH", perm);
        }
      }
      const item: SeedQuestion = {
        section: s.section,
        domain: s.domain,
        skill: s.skill,
        subtopic: s.subtopic,
        difficulty: "hard",
        difficultyValue: PIN,
        type,
        passageText: s.section === "RW" ? p.passageContent ?? undefined : undefined,
        stem: p.stem,
        choices: type === "MCQ" ? (p.choices as [string, string, string, string]) : undefined,
        correctAnswer: String(p.correctAnswer),
        explanation: p.explanation,
      };
      // Adversarial correctness gate: an independent solver must agree.
      if (await verify(item)) return item;
      console.log(`  ✗ ${s.skill}: failed verification (attempt ${attempt + 1}), regenerating`);
    } catch {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  console.log(`  ⚠ ${s.skill}: could not produce a verified item`);
  return null;
}

async function main() {
  if (!API_KEY) {
    console.error("DEEPSEEK_API_KEY is required.");
    process.exit(1);
  }
  console.log(`Authoring ${SPECS.length} challenge items (pinned difficultyValue ${PIN})…`);
  const results = await Promise.all(SPECS.map(author));
  const items = results.filter((x): x is SeedQuestion => x !== null);
  writeFileSync(OUT, JSON.stringify(items, null, 2));
  console.log(`Done. ${items.length}/${SPECS.length} authored → ${OUT}`);
  console.log(
    "Sections:",
    Object.entries(
      items.reduce<Record<string, number>>((m, q) => ((m[q.section] = (m[q.section] ?? 0) + 1), m), {}),
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
