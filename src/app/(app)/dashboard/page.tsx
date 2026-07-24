import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, BookOpenCheck, BookText, Dumbbell, Flame, MessagesSquare, Newspaper, Stethoscope, Timer, Zap } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNextArticle } from "@/lib/reading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHero } from "@/components/xedu/page-hero";
import { StatCard } from "@/components/xedu/stat-card";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  const user = session!.user;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { streak: true, xp: true },
  });
  const attemptCount = await prisma.testAttempt.count({
    where: { userId: user.id, status: "COMPLETED" },
  });

  // The user's next unlocked article in the sequential reading chain.
  const nextArticle = await getNextArticle(user.id);

  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="XeduSAT · Prep"
        title={`Welcome back, ${firstName}`}
        subtitle="Everything due, your practice, and your progress — all in one place."
        actions={
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white">
            {(dbUser?.xp ?? 0)} XP
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Study streak" value={`${dbUser?.streak ?? 0}`} hint="days in a row" icon={<Flame className="h-5 w-5" />} accent="amber" />
        <StatCard label="XP earned" value={dbUser?.xp ?? 0} icon={<Zap className="h-5 w-5" />} accent="purple" />
        <StatCard label="Tests completed" value={attemptCount} icon={<Timer className="h-5 w-5" />} accent="blue" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-primary/30 bg-accent/30">
          <CardHeader>
            <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Stethoscope className="h-5 w-5" />
            </div>
            <CardTitle>Start with the diagnostic</CardTitle>
            <CardDescription>
              20 adaptive questions, under 30 minutes. Get your starting score band and a
              prioritized study plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="rounded-full">
              <Link href="/diagnostic">Take the diagnostic</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-violet-100 text-violet-600">
              <MessagesSquare className="h-5 w-5" />
            </div>
            <CardTitle>Learn with Thoth</CardTitle>
            <CardDescription>
              Guided, chat-style walkthroughs for every question type — Thoth teaches you the
              strategy, then you try it yourself.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild className="rounded-full">
              <Link href="/walkthroughs">Open walkthroughs</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Daily Reading: the next article in the sequential chain */}
      {nextArticle && (
        <Card className="border-primary/30 bg-accent/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Newspaper className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Next up in Daily Reading</span>
                  <Badge variant="secondary">Article #{nextArticle.dayIndex + 1}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{nextArticle.title}</p>
              </div>
            </div>
            <Button asChild className="rounded-full">
              <Link href={`/reading/${nextArticle.id}`}>Read & summarize</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Explore */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Explore</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/tests", label: "Full tests", body: "10 adaptive mocks", icon: Timer, chip: "bg-blue-100 text-blue-600" },
            { href: "/practice", label: "Practice drills", body: "Target any skill", icon: Dumbbell, chip: "bg-violet-100 text-violet-600" },
            { href: "/flashcards", label: "Flashcards", body: "150+ SAT words", icon: BookOpenCheck, chip: "bg-amber-100 text-amber-600" },
            { href: "/analytics", label: "Analytics", body: "Track progress", icon: BarChart3, chip: "bg-emerald-100 text-emerald-600" },
            { href: "/lessons", label: "Lessons", body: "Learn every skill", icon: BookText, chip: "bg-blue-100 text-blue-600" },
            { href: "/notebook", label: "Mistake notebook", body: "Conquer misses", icon: BookText, chip: "bg-rose-100 text-rose-600" },
          ].map((l) => (
            <Link key={l.href} href={l.href}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent className="flex items-center gap-3 py-5">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full ${l.chip}`}>
                    <l.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">{l.label}</div>
                    <div className="text-xs text-muted-foreground">{l.body}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
