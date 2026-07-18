// AI analysis of a reader's article summary. Uses DeepSeek when configured,
// with a deterministic heuristic fallback so the feature works without a key.

export interface SummaryFeedback {
  score: number; // 0–100 comprehension estimate
  understood: string[]; // points the reader captured well
  missed: string[]; // key points missed or misunderstood
  overall: string; // one short paragraph of encouragement + guidance
  provider: "deepseek" | "heuristic";
}

const STOPWORDS = new Set(
  "the a an and or but of to in on for with as at by from is are was were be been being this that these those it its their his her they them he she we you i not no also has have had will would can could may might more most than then so such into over under about after before between during".split(
    " ",
  ),
);

function keyTerms(text: string, limit = 25): Set<string> {
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)) {
    if (raw.length < 4 || STOPWORDS.has(raw)) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  return new Set(
    [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([w]) => w),
  );
}

/** Heuristic fallback: overlap of key terms between the summary and the article. */
function heuristicFeedback(article: string, modelSummary: string, summary: string): SummaryFeedback {
  const articleTerms = keyTerms(`${article} ${modelSummary}`, 30);
  const summaryTerms = keyTerms(summary, 40);

  const captured = [...articleTerms].filter((t) => summaryTerms.has(t));
  const missed = [...articleTerms].filter((t) => !summaryTerms.has(t)).slice(0, 6);
  const coverage = articleTerms.size ? captured.length / articleTerms.size : 0;
  const score = Math.max(30, Math.min(95, Math.round(coverage * 120)));

  return {
    score,
    understood: captured.length
      ? [`You referenced key ideas such as ${captured.slice(0, 5).join(", ")}.`]
      : ["You wrote a summary, but it didn't clearly connect to the article's main terms."],
    missed: missed.length
      ? [`Consider whether you addressed: ${missed.join(", ")}.`]
      : ["You covered the main points well."],
    overall:
      coverage >= 0.5
        ? "Solid comprehension — your summary captures much of the article's substance. Tighten it by naming the central claim in your first sentence."
        : "You're on the right track. Focus your next summary on the article's main argument and its most important supporting detail.",
    provider: "heuristic",
  };
}

/** Analyze a reader's summary against the article, returning structured feedback. */
export async function analyzeSummary(
  articleContent: string,
  modelSummary: string,
  summary: string,
): Promise<SummaryFeedback> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return heuristicFeedback(articleContent, modelSummary, summary);

  const system =
    "You are a reading-comprehension coach. A student read an article and wrote a summary. " +
    "Judge how well the summary reflects understanding of the article's main idea, key supporting " +
    "details, and any nuance. Be specific, fair, and encouraging. Respond with strict JSON only.";
  const user = `ARTICLE:\n${articleContent}\n\nEXPERT SUMMARY (reference):\n${modelSummary}\n\nSTUDENT SUMMARY:\n${summary}\n\nReturn JSON:
{
  "score": number,               // 0-100 comprehension
  "understood": [string, ...],   // 2-4 specific things the student clearly understood
  "missed": [string, ...],       // 2-4 specific key points missed, misunderstood, or worth adding
  "overall": string              // 2-3 sentences of encouraging, actionable feedback
}`;

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
    });
    if (!res.ok) return heuristicFeedback(articleContent, modelSummary, summary);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return heuristicFeedback(articleContent, modelSummary, summary);
    const p = JSON.parse(content) as Partial<SummaryFeedback>;
    return {
      score: Math.max(0, Math.min(100, Math.round(Number(p.score) || 0))),
      understood: Array.isArray(p.understood) ? p.understood.slice(0, 5) : [],
      missed: Array.isArray(p.missed) ? p.missed.slice(0, 5) : [],
      overall: typeof p.overall === "string" ? p.overall : "",
      provider: "deepseek",
    };
  } catch {
    return heuristicFeedback(articleContent, modelSummary, summary);
  }
}

/** Count words the same way client and server do (for the 50-word minimum). */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export const MIN_WORDS = 50;
export const MAX_WORDS = 100;
