/**
 * Generates ~150 original SAT vocabulary entries via DeepSeek and writes them
 * to prisma/seed-data/vocab.json (committed) for deterministic offline seeding.
 *
 * Run: DEEPSEEK_API_KEY=... npx tsx scripts/generate-vocab.ts
 */
import { writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const OUT = join(__dirname, "../prisma/seed-data/vocab.json");
const API_KEY = process.env.DEEPSEEK_API_KEY;
const TARGET = 150;
const BATCH = 25;

interface Word {
  word: string;
  partOfSpeech: string;
  definition: string;
  example: string;
  deck: string;
}

async function fetchBatch(exclude: string[]): Promise<Word[]> {
  const system =
    "You produce high-utility SAT vocabulary as strict JSON. Each entry has a word, " +
    "part of speech, a concise definition, and an original example sentence that uses the word naturally.";
  const user = `Return JSON {"words": [ {"word": string, "partOfSpeech": string, "definition": string, "example": string}, ... ]} with exactly ${BATCH} distinct, commonly-tested SAT vocabulary words. Avoid these already-used words: ${exclude.slice(-120).join(", ") || "none"}.`;

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
      temperature: 0.9,
    }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return [];
  try {
    const p = JSON.parse(content) as { words?: Word[] };
    return (p.words ?? [])
      .filter((w) => w.word && w.definition && w.example && w.partOfSpeech)
      .map((w) => ({ ...w, deck: "Core SAT" }));
  } catch {
    return [];
  }
}

async function main() {
  if (!API_KEY) {
    console.error("DEEPSEEK_API_KEY required.");
    process.exit(1);
  }
  const words: Word[] = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, "utf8")) as Word[]) : [];
  const seen = new Set(words.map((w) => w.word.toLowerCase()));

  while (words.length < TARGET) {
    const batch = await fetchBatch([...seen]);
    let added = 0;
    for (const w of batch) {
      const key = w.word.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        words.push(w);
        added++;
      }
    }
    console.log(`  +${added} → ${words.length}/${TARGET}`);
    writeFileSync(OUT, JSON.stringify(words, null, 2));
    if (added === 0) break;
  }
  console.log(`Done. ${words.length} vocab words written to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
