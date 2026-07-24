/**
 * Bulk article-library generator for Daily Reading.
 *
 * Authors ORIGINAL news-style articles via DeepSeek across ~20 categories with
 * deliberately varied lengths (quick reads → long features) and writes them to
 * prisma/seed-data/articles-library.json. The seed appends them AFTER the
 * existing articles.json set, preserving existing dayIndex values, so the
 * sequential-unlock chain simply gets longer.
 *
 * Articles are original content grounded in widely-known facts — never copies
 * of any published piece. Each carries a modelSummary used to ground the AI
 * feedback on student summaries.
 *
 * Run: DEEPSEEK_API_KEY=... npx tsx scripts/generate-articles-library.ts
 */
import { writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const OUT = join(__dirname, "../prisma/seed-data/articles-library.json");
const EXISTING = join(__dirname, "../prisma/seed-data/articles.json");
const API_KEY = process.env.DEEPSEEK_API_KEY;
const CONCURRENCY = Number(process.env.GEN_CONCURRENCY ?? 12);
const TARGET = Number(process.env.GEN_TARGET ?? 500);

const CATEGORIES = [
  "Science", "Technology", "Health", "Environment", "World Affairs",
  "Business & Economy", "Space & Astronomy", "Culture & Society",
  "History", "Psychology", "Sports", "Arts", "Education",
  "Energy", "Food & Agriculture", "Oceans & Wildlife", "Medicine",
  "AI & Computing", "Archaeology", "Urban Life",
];

// Length bands so the library genuinely varies: quick reads to long features.
const LENGTH_BANDS = [
  { label: "quick read", range: "150-250", weight: 25 },
  { label: "standard article", range: "300-450", weight: 35 },
  { label: "in-depth piece", range: "500-700", weight: 25 },
  { label: "long feature", range: "750-950", weight: 15 },
] as const;

// Angle rotation so articles within a category don't converge on one template.
const ANGLES = [
  "a recent research finding", "a long-running trend reaching a turning point",
  "a local story with global implications", "a debate between two credible camps",
  "an unexpected consequence of a well-known development", "a profile of a project or place",
  "a data-driven explainer", "a historical parallel to a current event",
];

interface Article {
  title: string;
  source: string;
  category: string;
  content: string;
  modelSummary: string;
}

function bandFor(i: number): (typeof LENGTH_BANDS)[number] {
  // Deterministic weighted rotation over the index.
  const total = LENGTH_BANDS.reduce((s, b) => s + b.weight, 0);
  let x = (i * 37) % total;
  for (const b of LENGTH_BANDS) {
    if (x < b.weight) return b;
    x -= b.weight;
  }
  return LENGTH_BANDS[1];
}

async function generateArticle(i: number): Promise<Article | null> {
  const category = CATEGORIES[i % CATEGORIES.length];
  const band = bandFor(i);
  const angle = ANGLES[(i * 13) % ANGLES.length];
  const system =
    "You are a professional journalist writing ORIGINAL, factual news-style articles for a " +
    "reading-comprehension platform. Write clear, engaging journalistic prose on real-world " +
    "topics. Do NOT copy any existing published article — invent an original piece grounded in " +
    "genuine, widely-known facts. Respond with strict JSON only.";
  const user = `Write one original news article in the "${category}" category, framed as ${angle}.
Length: a ${band.label} of ${band.range} words. Respect this range — it shapes the reading experience.
It must have a clear main idea, supporting details, and a nuance or implication a careful reader would catch.
Return JSON:
{
  "title": string,
  "source": string,          // a plausible outlet name, e.g. "Global Science Report"
  "content": string,         // the full article, ${band.range} words, plain-text paragraphs separated by \\n\\n
  "modelSummary": string     // a 60-word expert summary capturing main idea + key supporting points + the nuance
}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
          temperature: 1.15,
        }),
      });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("empty");
      const p = JSON.parse(content) as Partial<Article>;
      if (!p.title || !p.source || !p.content || !p.modelSummary) throw new Error("fields");
      const words = p.content.split(/\s+/).length;
      if (words < 120 || words > 1100) throw new Error(`length ${words}`);
      return { title: p.title, source: p.source, category, content: p.content, modelSummary: p.modelSummary };
    } catch {
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    }
  }
  return null;
}

async function main() {
  if (!API_KEY) {
    console.error("DEEPSEEK_API_KEY is required.");
    process.exit(1);
  }

  // Dedup titles against the base library and within this run.
  const seen = new Set<string>();
  if (existsSync(EXISTING)) {
    for (const a of JSON.parse(readFileSync(EXISTING, "utf8")) as Article[]) {
      seen.add(a.title.toLowerCase().trim());
    }
  }

  const accepted: Article[] = [];
  let processed = 0;
  let i = 0;

  async function worker() {
    while (accepted.length < TARGET) {
      const idx = i++;
      const a = await generateArticle(idx);
      processed++;
      if (a) {
        const key = a.title.toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          accepted.push(a);
        }
      }
      if (processed % 25 === 0) {
        console.log(`  ${processed} processed · ${accepted.length}/${TARGET} accepted`);
        writeFileSync(OUT, JSON.stringify(accepted, null, 2));
      }
    }
  }

  console.log(`Generating ${TARGET} articles with concurrency ${CONCURRENCY}…`);
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  writeFileSync(OUT, JSON.stringify(accepted.slice(0, TARGET), null, 2));

  const byBand: Record<string, number> = {};
  for (const a of accepted) {
    const w = a.content.split(/\s+/).length;
    const label = w < 280 ? "<280" : w < 480 ? "280-480" : w < 720 ? "480-720" : "720+";
    byBand[label] = (byBand[label] ?? 0) + 1;
  }
  console.log(`Done. ${Math.min(accepted.length, TARGET)} articles → ${OUT}`);
  console.log("Word-count spread:", byBand);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
