import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookMarked, CheckCircle2, Flame, Lock, Newspaper, Star } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNextArticle } from "@/lib/reading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Daily Reading" };

/** Rough minutes-to-read from word count (200 wpm, min 1). */
function readMinutes(content: string): number {
  return Math.max(1, Math.round(content.split(/\s+/).length / 200));
}

export default async function ReadingPage() {
  const session = await auth();
  const uid = session!.user.id;

  const [next, articles, submissions] = await Promise.all([
    getNextArticle(uid),
    prisma.readingArticle.findMany({ orderBy: { dayIndex: "asc" } }),
    prisma.readingSubmission.findMany({ where: { userId: uid } }),
  ]);

  const submittedIds = new Set(submissions.map((s) => s.articleId));
  const avgScore = submissions.length
    ? Math.round(submissions.reduce((s, x) => s + x.score, 0) / submissions.length)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Daily Reading</h1>
        <p className="mt-1 text-muted-foreground">
          Read each article and write a 50–100 word summary — the next article unlocks once you
          finish the one before it. Our AI coach tells you what you understood well and what you
          may have missed.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Articles completed" value={`${submissions.length} / ${articles.length}`} icon={<BookMarked className="h-4 w-4 text-primary" />} />
        <Stat label="Avg comprehension" value={submissions.length ? `${avgScore}%` : "—"} icon={<Star className="h-4 w-4 text-primary" />} />
        <Stat label="Up next" value={next ? `#${next.dayIndex + 1}` : "All done!"} icon={<Flame className="h-4 w-4 text-primary" />} />
      </div>

      {/* The frontier: the one article currently unlocked to read */}
      {next && (
        <Card className="border-primary/40 bg-accent/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge>Up next — article #{next.dayIndex + 1}</Badge>
              <Badge variant="outline">{next.category}</Badge>
              <Badge variant="secondary">{readMinutes(next.content)} min read</Badge>
            </div>
            <CardTitle className="pt-1">{next.title}</CardTitle>
            <CardDescription>{next.source}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/reading/${next.id}`}>
                Read & summarize
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Library */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Article library</h2>
          <Badge variant="secondary">
            {submissions.length} of {articles.length} unlocked & done
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => {
            const done = submittedIds.has(a.id);
            const isNext = next?.id === a.id;
            const locked = !done && !isNext;
            const card = (
              <Card
                className={cn(
                  "h-full transition-colors",
                  locked ? "opacity-55" : "hover:border-primary/50",
                  isNext && "border-primary/50",
                )}
              >
                <CardHeader className="pb-2">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs">
                        #{a.dayIndex + 1}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {a.category}
                      </Badge>
                    </div>
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : locked ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : null}
                  </div>
                  <CardTitle className="text-sm leading-snug">{a.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  {a.source} · {readMinutes(a.content)} min
                </CardContent>
              </Card>
            );
            return locked ? (
              <div key={a.id} aria-disabled className="cursor-not-allowed" title="Finish the previous article to unlock">
                {card}
              </div>
            ) : (
              <Link key={a.id} href={`/reading/${a.id}`}>
                {card}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
