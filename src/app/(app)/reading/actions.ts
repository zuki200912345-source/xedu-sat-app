"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { analyzeSummary, countWords, MIN_WORDS } from "@/lib/summary-analysis";
import { isArticleUnlocked } from "@/lib/reading";
import { awardXp, grantBadge, touchStreak } from "@/lib/gamification";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

const submitSchema = z.object({
  articleId: z.string().min(1).max(64),
  summary: z.string().min(1).max(4000),
});

/**
 * Submit a summary for an article: enforce the 50-word minimum, run AI analysis,
 * store the graded submission, and award progress. One submission per article.
 */
export async function submitSummary(
  input: z.infer<typeof submitSchema>,
): Promise<{ submissionId: string } | { error: string }> {
  const user = await requireUser();
  const { articleId, summary } = submitSchema.parse(input);

  // Throttle AI analyses per user (each may call an external LLM).
  const rl = rateLimit(`ai-summary:${user.id}`, LIMITS.aiSummary.limit, LIMITS.aiSummary.windowMs);
  if (!rl.ok) {
    return { error: "You've submitted a lot of summaries recently. Please try again later." };
  }

  const words = countWords(summary);
  if (words < MIN_WORDS) {
    return { error: `Your summary must be at least ${MIN_WORDS} words (you wrote ${words}).` };
  }

  const article = await prisma.readingArticle.findUnique({ where: { id: articleId } });
  if (!article) return { error: "Article not found." };

  // Sequential unlock: reject submissions for articles the user hasn't reached.
  if (!(await isArticleUnlocked(user.id, articleId))) {
    return { error: "This article is still locked — finish the previous one first." };
  }

  // One submission per article per user.
  const existing = await prisma.readingSubmission.findUnique({
    where: { userId_articleId: { userId: user.id, articleId } },
  });
  if (existing) return { submissionId: existing.id };

  const feedback = await analyzeSummary(article.content, article.modelSummary, summary);

  const submission = await prisma.readingSubmission.create({
    data: {
      userId: user.id,
      articleId,
      summary,
      wordCount: words,
      score: feedback.score,
      feedback: JSON.stringify(feedback),
    },
  });

  await awardXp(user.id, 15 + Math.round(feedback.score / 10));
  await touchStreak(user.id);
  const total = await prisma.readingSubmission.count({ where: { userId: user.id } });
  if (total >= 5) await grantBadge(user.id, "well_read");

  revalidatePath("/reading");
  revalidatePath("/dashboard");
  return { submissionId: submission.id };
}
