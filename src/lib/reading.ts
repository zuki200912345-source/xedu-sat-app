import { prisma } from "@/lib/prisma";

/**
 * Daily Reading progresses SEQUENTIALLY: articles are ordered by dayIndex and
 * the next article unlocks only once every earlier one has a submitted summary.
 * The "frontier" is the lowest-dayIndex article the user hasn't completed —
 * it's the only unlocked-but-unread article at any time.
 */

/** The user's next required article (their frontier), or null when caught up. */
export async function getNextArticle(userId: string) {
  const done = await prisma.readingSubmission.findMany({
    where: { userId },
    select: { articleId: true },
  });
  return prisma.readingArticle.findFirst({
    where: { id: { notIn: done.map((d) => d.articleId) } },
    orderBy: { dayIndex: "asc" },
  });
}

/**
 * Whether the given article is readable for this user: already submitted
 * (review) or exactly at the frontier. Enforced server-side on the article
 * page and the submit action.
 */
export async function isArticleUnlocked(userId: string, articleId: string): Promise<boolean> {
  const article = await prisma.readingArticle.findUnique({
    where: { id: articleId },
    select: { id: true, dayIndex: true },
  });
  if (!article) return false;

  const submitted = await prisma.readingSubmission.findUnique({
    where: { userId_articleId: { userId, articleId } },
    select: { id: true },
  });
  if (submitted) return true;

  // Unlocked iff every earlier article already has a submission.
  const earlierCount = await prisma.readingArticle.count({
    where: { dayIndex: { lt: article.dayIndex } },
  });
  if (earlierCount === 0) return true;
  const earlierDone = await prisma.readingSubmission.count({
    where: { userId, article: { dayIndex: { lt: article.dayIndex } } },
  });
  return earlierDone >= earlierCount;
}
