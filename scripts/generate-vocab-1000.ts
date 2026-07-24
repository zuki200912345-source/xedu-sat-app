/**
 * Expand the SAT vocab bank to 1,000 words.
 *
 * The WORD LIST is sourced from public most-common-SAT-word compilations
 * (frequency-ordered from real Digital SAT answer choices + PrepScholar's
 * curated 384), merged and filtered for triviality. Words are facts; the
 * DEFINITIONS and EXAMPLES are authored ORIGINAL by DeepSeek — no source
 * text is copied (same copyright-clean policy as the question bank).
 *
 * Existing 157 entries are kept untouched. New words get deck labels by
 * frequency band: "High-Frequency" (top of the list) or "Advanced".
 *
 * Run: DEEPSEEK_API_KEY=... NEW_WORDS=path npx tsx scripts/generate-vocab-1000.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const OUT = join(__dirname, "../prisma/seed-data/vocab.json");
const API_KEY = process.env.DEEPSEEK_API_KEY;
const NEW_WORDS = process.env.NEW_WORDS!;
const BATCH = 25;
const CONCURRENCY = 10;

interface VocabEntry {
  word: string;
  partOfSpeech: string;
  definition: string;
  example: string;
  deck: string;
}

const POS = new Set(["noun", "verb", "adjective", "adverb"]);

async function authorBatch(words: string[]): Promise<VocabEntry[]> {
  const prompt = `For each SAT vocabulary word below, write an ORIGINAL dictionary-style entry (do not copy any published dictionary).
Return STRICT JSON: {"entries":[{"word":string,"partOfSpeech":"noun"|"verb"|"adjective"|"adverb","definition":string,"example":string}]}
- definition: concise (max 14 words), the sense most tested on the SAT.
- example: one original sentence a high-schooler would find natural.
Words: ${words.join(", ")}`;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: "deepseek-v4-pro",
          messages: [
            { role: "system", content: "You are a precise lexicographer writing original, copyright-clean entries. Strict JSON only." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.6,
        }),
      });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as { entries?: Partial<VocabEntry>[] };
      const out: VocabEntry[] = [];
      for (const e of parsed.entries ?? []) {
        if (!e.word || !e.definition || !e.example) continue;
        const word = String(e.word).toLowerCase().trim();
        if (!words.includes(word)) continue;
        out.push({
          word,
          partOfSpeech: POS.has(String(e.partOfSpeech)) ? String(e.partOfSpeech) : "noun",
          definition: String(e.definition).trim(),
          example: String(e.example).trim(),
          deck: "", // set later by band
        });
      }
      if (out.length >= Math.floor(words.length * 0.8)) return out;
      throw new Error(`only ${out.length}/${words.length} usable`);
    } catch {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  return [];
}

async function main() {
  if (!API_KEY) {
    console.error("DEEPSEEK_API_KEY required");
    process.exit(1);
  }
  const existing = JSON.parse(readFileSync(OUT, "utf8")) as VocabEntry[];
  const newWords = JSON.parse(readFileSync(NEW_WORDS, "utf8")) as string[];
  console.log(`existing ${existing.length}, authoring ${newWords.length}…`);

  const batches: string[][] = [];
  for (let i = 0; i < newWords.length; i += BATCH) batches.push(newWords.slice(i, i + BATCH));

  const results: VocabEntry[] = [];
  let done = 0;
  const queue = [...batches];
  async function worker() {
    while (queue.length) {
      const b = queue.shift()!;
      const entries = await authorBatch(b);
      results.push(...entries);
      done++;
      if (done % 5 === 0) console.log(`  ${done}/${batches.length} batches · ${results.length} entries`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Deck by frequency band: position in the merged order.
  const order = new Map(newWords.map((w, i) => [w, i]));
  const seen = new Set(existing.map((e) => e.word.toLowerCase()));
  const fresh = results
    .filter((e) => !seen.has(e.word) && (seen.add(e.word), true))
    .sort((a, b) => (order.get(a.word) ?? 0) - (order.get(b.word) ?? 0))
    .map((e) => ({ ...e, deck: (order.get(e.word) ?? 999) < 450 ? "High-Frequency" : "Advanced" }));

  const all = [...existing, ...fresh];
  writeFileSync(OUT, JSON.stringify(all, null, 2));
  const decks = all.reduce<Record<string, number>>((m, e) => ((m[e.deck] = (m[e.deck] ?? 0) + 1), m), {});
  console.log(`Done. ${all.length} total (${fresh.length} new). Decks:`, decks);
  const missing = newWords.filter((w) => !all.some((e) => e.word === w));
  if (missing.length) console.log(`missing ${missing.length}:`, missing.slice(0, 10).join(", "));
}

main().catch((e) => { console.error(e); process.exit(1); });
