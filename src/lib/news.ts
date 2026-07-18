// News source adapter for Daily Reading. Isolates the (optional) live news API
// behind a single function so the rest of the app never touches it. When
// NEWS_API_KEY is absent, the app uses the seeded original-article library, so
// the feature works fully offline.

export function newsConfigured(): boolean {
  return Boolean(process.env.NEWS_API_KEY);
}

export interface LiveArticle {
  title: string;
  source: string;
  category: string;
  content: string;
  url: string;
}

/**
 * Fetch recent real news articles (NewsAPI-compatible). Returns [] on any
 * failure so callers cleanly fall back to the seeded library. NewsAPI's free
 * tier returns article descriptions rather than full bodies, which is why the
 * seeded originals are the default reading source.
 */
export async function fetchLiveArticles(pageSize = 10): Promise<LiveArticle[]> {
  if (!newsConfigured()) return [];
  try {
    const res = await fetch(
      `https://newsapi.org/v2/top-headlines?language=en&pageSize=${pageSize}&apiKey=${process.env.NEWS_API_KEY}`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      articles?: { title?: string; description?: string; content?: string; url?: string; source?: { name?: string } }[];
    };
    return (data.articles ?? [])
      .filter((a) => a.title && (a.content || a.description))
      .map((a) => ({
        title: a.title!,
        source: a.source?.name ?? "News",
        category: "World Affairs",
        content: `${a.description ?? ""}\n\n${a.content ?? ""}`.trim(),
        url: a.url ?? "",
      }));
  } catch {
    return [];
  }
}
