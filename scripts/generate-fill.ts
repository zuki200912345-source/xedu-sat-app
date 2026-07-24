/**
 * Targeted coverage fill-ins: brings thin (section, skill, difficulty) cells up
 * to a minimum so the 5-tier generator has real variety in every cell — most
 * importantly quantitative Command-of-Evidence items (which need a data table).
 * Writes to prisma/seed-data/generated-fill.json.
 *
 * Run: DEEPSEEK_API_KEY=... npx tsx scripts/generate-fill.ts
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { rwQuestions } from "../prisma/seed-data/rw-questions";
import { mathQuestions } from "../prisma/seed-data/math-questions";
import type { SeedQuestion } from "../prisma/seed-data/types";
import { RW_DOMAINS, MATH_DOMAINS } from "../src/lib/enums";
import { similarityGate } from "./generate-questions";

const OUT = join(__dirname, "../prisma/seed-data/generated-fill.json");
const API_KEY = process.env.DEEPSEEK_API_KEY;
const CONCURRENCY = 6;
const TARGET_PER_CELL = 4;
type Band = "easy" | "medium" | "hard";
const BANDS: Band[] = ["easy", "medium", "hard"];

interface Cell {
  section: "RW" | "MATH";
  domain: string;
  skill: string;
  difficulty: Band;
  quant?: boolean; // Command of Evidence quantitative (needs a table)
}

function loadExisting(): SeedQuestion[] {
  const all = [...rwQuestions, ...mathQuestions];
  for (const f of ["generated-bank.json", "generated-fill.json"]) {
    const p = join(__dirname, "../prisma/seed-data/", f);
    if (existsSync(p)) all.push(...(JSON.parse(readFileSync(p, "utf8")) as SeedQuestion[]));
  }
  return all;
}

function cellKey(c: Cell): string {
  return `${c.section}|${c.domain}|${c.skill}|${c.difficulty}|${c.quant ? "Q" : ""}`;
}

/** Count existing items per cell (Command of Evidence split by table presence). */
function countCells(items: SeedQuestion[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const q of items) {
    const quant = q.skill === "Command of Evidence" ? !!q.graphSpec : undefined;
    const key = cellKey({ section: q.section as "RW" | "MATH", domain: q.domain, skill: q.skill, difficulty: q.difficulty as Band, quant });
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return m;
}

/** Cells we care about, from the blueprint taxonomy. */
function targetCells(): Cell[] {
  const cells: Cell[] = [];
  for (const [domain, skills] of Object.entries(RW_DOMAINS)) {
    for (const skill of skills) {
      for (const d of BANDS) {
        if (skill === "Command of Evidence") {
          cells.push({ section: "RW", domain, skill, difficulty: d, quant: true });
          cells.push({ section: "RW", domain, skill, difficulty: d, quant: false });
        } else {
          cells.push({ section: "RW", domain, skill, difficulty: d });
        }
      }
    }
  }
  for (const [domain, skills] of Object.entries(MATH_DOMAINS)) {
    for (const skill of skills) for (const d of BANDS) cells.push({ section: "MATH", domain, skill, difficulty: d });
  }
  return cells;
}

async function generateItem(cell: Cell): Promise<SeedQuestion | null> {
  const isMath = cell.section === "MATH";
  const quant = cell.quant === true;
  const system = isMath
    ? "You are a Digital SAT Math item writer producing ORIGINAL, copyright-clean questions. Use plain text math only (x^2, sqrt(), 1/2, pi) — never LaTeX. Exactly one correct answer. Respond with strict JSON only."
    : "You are a Digital SAT Reading & Writing item writer producing ORIGINAL, copyright-clean questions. Invent new content; never copy real passages. Exactly one correct choice. Respond with strict JSON only.";

  const user = isMath
    ? `Write one original ${cell.difficulty} Math question. Domain: ${cell.domain}. Skill: ${cell.skill}.
Return JSON: {"type":"MCQ","stem":string,"choices":[string,string,string,string],"correctAnswer":"A"|"B"|"C"|"D","explanation":string}`
    : quant
      ? `Write one original ${cell.difficulty} Reading & Writing "Command of Evidence (quantitative)" question. It must include a small DATA TABLE and a short passage that makes a claim; the correct choice cites data that supports the claim.
Return JSON: {"type":"MCQ","passageContent":string,"graphSpec":{"type":"table","title":string,"headers":[string,...],"rows":[[string|number,...],...]},"stem":string,"choices":[string,string,string,string],"correctAnswer":"A"|"B"|"C"|"D","explanation":string}`
      : `Write one original ${cell.difficulty} Reading & Writing question. Domain: ${cell.domain}. Skill: ${cell.skill}. Include a short original passage (25-150 words).
Return JSON: {"type":"MCQ","passageContent":string,"stem":string,"choices":[string,string,string,string],"correctAnswer":"A"|"B"|"C"|"D","explanation":string}`;

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: "deepseek-v4-pro",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
      temperature: 1.05,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    const p = JSON.parse(content);
    if (!p.stem || !p.correctAnswer || !p.explanation) return null;
    if (!Array.isArray(p.choices) || p.choices.length !== 4) return null;
    if (!["A", "B", "C", "D"].includes(p.correctAnswer)) return null;
    const text = `${p.passageContent ?? ""} ${p.stem} ${p.choices.join(" ")}`;
    if (/\\[a-z(]|\$\$|\\\[|\\begin/i.test(text)) return null;
    return {
      section: cell.section,
      domain: cell.domain,
      skill: cell.skill,
      difficulty: cell.difficulty,
      type: "MCQ",
      passageText: isMath ? undefined : p.passageContent,
      graphSpec: quant ? p.graphSpec : undefined,
      stem: p.stem,
      choices: p.choices,
      correctAnswer: p.correctAnswer,
      explanation: p.explanation,
    };
  } catch {
    return null;
  }
}

async function main() {
  if (!API_KEY) {
    console.error("DEEPSEEK_API_KEY required.");
    process.exit(1);
  }
  const existing = loadExisting();
  const counts = countCells(existing);
  const accepted: SeedQuestion[] = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, "utf8")) as SeedQuestion[]) : [];

  // Build the job list from deficits.
  const jobs: Cell[] = [];
  for (const cell of targetCells()) {
    const have = counts.get(cellKey(cell)) ?? 0;
    for (let i = have; i < TARGET_PER_CELL; i++) jobs.push(cell);
  }
  console.log(`Filling ${jobs.length} deficit slots to reach ${TARGET_PER_CELL}/cell…`);

  const refs = existing.map((q) => `${q.passageText ?? ""} ${q.stem}`);
  accepted.forEach((q) => refs.push(`${q.passageText ?? ""} ${q.stem}`));

  let done = 0, kept = 0;
  const queue = [...jobs];
  async function worker() {
    while (queue.length) {
      const cell = queue.shift()!;
      const item = await generateItem(cell).catch(() => null);
      done++;
      if (item) {
        const gate = similarityGate(`${item.passageText ?? ""} ${item.stem}`, refs);
        if (gate.ok) {
          accepted.push(item);
          refs.push(`${item.passageText ?? ""} ${item.stem}`);
          kept++;
        }
      }
      if (done % 15 === 0) {
        console.log(`  ${done}/${jobs.length} processed · ${kept} kept`);
        writeFileSync(OUT, JSON.stringify(accepted, null, 2));
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  writeFileSync(OUT, JSON.stringify(accepted, null, 2));
  console.log(`Done. ${accepted.length} fill-in items in ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
