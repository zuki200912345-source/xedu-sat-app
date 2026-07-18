import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookMarked, CheckCircle2, Flame, Newspaper, Star } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodaysArticle } from "@/lib/reading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Daily Reading" };

export default async function ReadingPage() {
  const session = await auth();
  const uid = session!.user.id;

  const [today, articles, submissions] = await Promise.all([
    getTodaysArticle(),
    prisma.readingArticle.findMany({ orderBy: { dayIndex: "asc" } }),
    prisma.readingSubmission.findMany({ where: { userId: uid } }),
  ]);

  const submittedIds = new Set(submissions.map((s) => s.articleId));
  const todayDone = today ? submittedIds.has(today.id) : false;
  const avgScore = submissions.length
    ? Math.round(submissions.reduce((s, x) => s + x.score, 0) / submissions.length)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Daily Reading</h1>
        <p className="mt-1 text-muted-foreground">
          Read one article a day and write a 50–100 word summary. Our AI coach tells you what you
          understood well and what you may have missed.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Articles read" value={submissions.length} icon={<BookMarked className="h-4 w-4 text-primary" />} />
        <Stat label="Avg comprehension" value={submissions.length ? `${avgScore}%` : "—"} icon={<Star className="h-4 w-4 text-primary" />} />
        <Stat label="Today" value={todayDone ? "Done ✓" : "Pending"} icon={<Flame className="h-4 w-4 text-primary" />} />
      </div>

      {/* Required today */}
      {today && (
        <Card className={todayDone ? "border-green-300 bg-green-50/40" : "border-primary/40 bg-accent/40"}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge className={todayDone ? "bg-green-600 hover:bg-green-600" : ""}>
                {todayDone ? "Completed today" : "Required today"}
              </Badge>
              <Badge variant="outline">{today.category}</Badge>
            </div>
            <CardTitle className="pt-1">{today.title}</CardTitle>
            <CardDescription>{today.source}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/reading/${today.id}`}>
                {todayDone ? "Review your feedback" : "Read & summarize"}
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
          <Badge variant="secondary">{articles.length}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => {
            const done = submittedIds.has(a.id);
            return (
              <Link key={a.id} href={`/reading/${a.id}`}>
                <Card className="h-full transition-colors hover:border-primary/50">
                  <CardHeader className="pb-2">
                    <div className="mb-1 flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {a.category}
                      </Badge>
                      {done && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    </div>
                    <CardTitle className="text-sm leading-snug">{a.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-muted-foreground">{a.source}</CardContent>
                </Card>
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
