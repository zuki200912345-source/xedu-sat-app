import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { SummaryFeedback } from "@/lib/summary-analysis";
import { SummaryForm } from "./summary-form";
import { FeedbackPanel } from "./feedback-panel";

export const metadata: Metadata = { title: "Reading" };

export default async function ArticlePage({ params }: { params: { articleId: string } }) {
  const user = await requireUser();

  const article = await prisma.readingArticle.findUnique({ where: { id: params.articleId } });
  if (!article) notFound();

  const submission = await prisma.readingSubmission.findUnique({
    where: { userId_articleId: { userId: user.id, articleId: article.id } },
  });
  const feedback = submission ? (JSON.parse(submission.feedback) as SummaryFeedback) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/reading" className="text-sm text-muted-foreground hover:text-foreground">
        ← Daily Reading
      </Link>

      {/* Article */}
      <article className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{article.category}</Badge>
          <span className="text-sm text-muted-foreground">{article.source}</span>
          {article.url && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Original <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <h1 className="text-3xl font-bold leading-tight tracking-tight">{article.title}</h1>
        <Card>
          <CardContent className="prose prose-sm max-w-none whitespace-pre-line pt-6 text-[15px] leading-relaxed">
            {article.content}
          </CardContent>
        </Card>
      </article>

      {/* Summary form or feedback */}
      {submission && feedback ? (
        <FeedbackPanel summary={submission.summary} wordCount={submission.wordCount} feedback={feedback} />
      ) : (
        <SummaryForm articleId={article.id} />
      )}
    </div>
  );
}
