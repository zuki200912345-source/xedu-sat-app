/**
 * Generates a library of original, news-style reading articles via DeepSeek and
 * writes them to prisma/seed-data/articles.json (committed) so the Daily Reading
 * feature works offline and deterministically. Articles are ORIGINAL content on
 * real-world topics — not copies of any published article.
 *
 * For genuinely live news, set NEWS_API_KEY and the app's news adapter will pull
 * real articles instead (see src/lib/news.ts).
 *
 * Run: DEEPSEEK_API_KEY=... npx tsx scripts/generate-articles.ts
 */
import { writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const OUT = join(__dirname, "../prisma/seed-data/articles.json");
const API_KEY = process.env.DEEPSEEK_API_KEY;
const CONCURRENCY = 5;
const TARGET = 30;

const CATEGORIES = [
  "Science", "Technology", "Health", "Environment", "World Affairs",
  "Business & Economy", "Space & Astronomy", "Culture & Society",
];

interface Article {
  title: string;
  source: string;
  category: string;
  content: string;
  modelSummary: string;
}

async function generateArticle(category: string, i: number): Promise<Article | null> {
  const system =
    "You are a professional journalist writing ORIGINAL, factual news-style articles for a " +
    "reading-comprehension platform. Write in clear, engaging journalistic prose on real-world " +
    "topics. Do NOT copy any existing published article — invent an original piece grounded in " +
    "genuine, widely-known facts. Respond with strict JSON only.";
  const user = `Write one original news article in the "${category}" category, 320–480 words, suitable for high-school reading practice. It should have a clear main idea, supporting details, and a nuance or implication that a careful reader would catch.
Return JSON:
{
  "title": string,
  "source": string,          // a plausible outlet name, e.g. "Global Science Report"
  "content": string,         // the full article, 320-480 words, plain text paragraphs separated by \\n\\n
  "modelSummary": string     // a 60-word expert summary capturing main idea + key supporting points + the nuance
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
      temperature: 0.9,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    const p = JSON.parse(content);
    if (!p.title || !p.content || !p.modelSummary) return null;
    return {
      title: p.title,
      source: p.source ?? "XeduSAT Reading Desk",
      category,
      content: p.content,
      modelSummary: p.modelSummary,
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
  const done: Article[] = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, "utf8")) as Article[]) : [];
  const jobs: { category: string; i: number }[] = [];
  for (let i = done.length; i < TARGET; i++) {
    jobs.push({ category: CATEGORIES[i % CATEGORIES.length], i });
  }
  console.log(`Generating ${jobs.length} articles (${done.length} already done)…`);

  const queue = [...jobs];
  async function worker() {
    while (queue.length) {
      const job = queue.shift()!;
      const article = await generateArticle(job.category, job.i);
      if (article) {
        done.push(article);
        console.log(`  ✓ [${article.category}] ${article.title}`);
        writeFileSync(OUT, JSON.stringify(done, null, 2));
      } else {
        console.log(`  ✗ ${job.category} (failed)`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Done. ${done.length} articles written to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
