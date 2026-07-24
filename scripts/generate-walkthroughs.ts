/**
 * Generates Thoth's guided-walkthrough teaching scripts (one per SAT question
 * type) via DeepSeek, committed to prisma/seed-data/walkthroughs.json so the
 * feature works offline. Content is Thoth's conversational teaching for each
 * skill; the 5 practice questions per walkthrough are drawn from the question
 * bank at runtime.
 *
 * Run: DEEPSEEK_API_KEY=... npx tsx scripts/generate-walkthroughs.ts
 */
import { writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { RW_DOMAINS, MATH_DOMAINS } from "../src/lib/enums";

const OUT = join(__dirname, "../prisma/seed-data/walkthroughs.json");
const API_KEY = process.env.DEEPSEEK_API_KEY;
const CONCURRENCY = 5;

interface Skill {
  section: "RW" | "MATH";
  domain: string;
  skill: string;
}

function allSkills(): Skill[] {
  const out: Skill[] = [];
  for (const [domain, skills] of Object.entries(RW_DOMAINS))
    for (const skill of skills as readonly string[]) out.push({ section: "RW", domain, skill });
  for (const [domain, skills] of Object.entries(MATH_DOMAINS))
    for (const skill of skills as readonly string[]) out.push({ section: "MATH", domain, skill });
  return out;
}

export interface WalkthroughScript {
  section: string;
  domain: string;
  skill: string;
  intro: string[];
  strategy: string[];
  teachIntro: string;
  soloIntro: string;
  encouragements: string[];
  retryNudge: string;
  explainIntro: string;
}

async function generate(s: Skill): Promise<WalkthroughScript | null> {
  const system =
    "You are Thoth, the friendly, encouraging AI study tutor on the xedu platform. " +
    "You speak in warm, short, conversational chat messages — never long walls of text. " +
    "You are teaching a student how to tackle a specific Digital SAT question type. " +
    "Respond with strict JSON only.";
  const user = `Write a guided-walkthrough teaching script for the SAT ${s.section === "MATH" ? "Math" : "Reading & Writing"} question type "${s.skill}" (domain: ${s.domain}).

Return JSON with these fields (each message is ONE short chat bubble, 1-2 sentences, Thoth's warm voice):
{
  "intro": [2-3 messages: greet the student, say what this question type tests and why it matters],
  "strategy": [3-5 messages: the step-by-step approach to solve it, and the common trap answers to watch for],
  "teachIntro": "one message transitioning into working through a couple of examples together",
  "soloIntro": "one message transitioning to the student trying a few on their own",
  "encouragements": [3 short varied praise messages for a correct answer],
  "retryNudge": "one gentle message when the first attempt is wrong, encouraging a second try",
  "explainIntro": "one message said right before Thoth explains the correct reasoning after a second wrong attempt"
}`;

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
      temperature: 0.8,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    const p = JSON.parse(content);
    if (!Array.isArray(p.intro) || !Array.isArray(p.strategy)) return null;
    return {
      section: s.section,
      domain: s.domain,
      skill: s.skill,
      intro: p.intro.slice(0, 3).map(String),
      strategy: p.strategy.slice(0, 5).map(String),
      teachIntro: String(p.teachIntro ?? "Let's work through a couple together."),
      soloIntro: String(p.soloIntro ?? "Your turn — try these on your own."),
      encouragements: (Array.isArray(p.encouragements) ? p.encouragements : ["Nice work!"]).slice(0, 3).map(String),
      retryNudge: String(p.retryNudge ?? "Not quite — take another look and try once more."),
      explainIntro: String(p.explainIntro ?? "No worries. Here's how to think about it:"),
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
  const skills = allSkills();
  const existing: Record<string, WalkthroughScript> = existsSync(OUT)
    ? JSON.parse(readFileSync(OUT, "utf8"))
    : {};
  const todo = skills.filter((s) => !existing[s.skill]);
  console.log(`Generating ${todo.length} walkthrough scripts (${Object.keys(existing).length} already done)…`);

  const queue = [...todo];
  async function worker() {
    while (queue.length) {
      const s = queue.shift()!;
      const script = await generate(s).catch(() => null);
      if (script) {
        existing[s.skill] = script;
        console.log(`  ✓ ${s.skill}`);
        writeFileSync(OUT, JSON.stringify(existing, null, 2));
      } else {
        console.log(`  ✗ ${s.skill} (failed)`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Done. ${Object.keys(existing).length} scripts in ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
