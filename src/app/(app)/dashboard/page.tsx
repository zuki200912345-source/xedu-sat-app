import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, BookOpenCheck, BookText, Dumbbell, Flame, Newspaper, Sparkles, Stethoscope, Timer, Zap } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodaysArticle } from "@/lib/reading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

  // Daily Reading status: is today's required article done?
  const todaysArticle = await getTodaysArticle();
  const todayReadingDone = todaysArticle
    ? (await prisma.readingSubmission.count({
        where: { userId: user.id, articleId: todaysArticle.id },
      })) > 0
    : true;

  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Here&apos;s where your prep stands today.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {(dbUser?.xp ?? 0)} XP
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Study streak
            </CardTitle>
            <Flame className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dbUser?.streak ?? 0} days</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              XP earned
            </CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dbUser?.xp ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tests completed
            </CardTitle>
            <Timer className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{attemptCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-primary/40 bg-accent/40">
          <CardHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Stethoscope className="h-5 w-5" />
            </div>
            <CardTitle>Start with the diagnostic</CardTitle>
            <CardDescription>
              20 adaptive questions, under 30 minutes. Get your starting score band
              and a prioritized study plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/diagnostic">Take the diagnostic</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <Dumbbell className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>Quick drill</CardTitle>
            <CardDescription>
              Build a focused practice set by section, domain, skill, and difficulty —
              or let Weakness Conqueror pick for you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/practice">Build a drill</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Daily Reading requirement */}
      {todaysArticle && (
        <Card className={todayReadingDone ? "border-green-300 bg-green-50/40" : "border-primary/40 bg-accent/40"}>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Newspaper className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Today&apos;s required reading</span>
                  <Badge variant={todayReadingDone ? "default" : "secondary"}>
                    {todayReadingDone ? "Done ✓" : "Pending"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{todaysArticle.title}</p>
              </div>
            </div>
            <Button variant={todayReadingDone ? "outline" : "default"} asChild>
              <Link href={`/reading/${todaysArticle.id}`}>
                {todayReadingDone ? "Review feedback" : "Read & summarize"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick links to the rest of the platform */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Explore</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/tests", label: "Full tests", body: "10 adaptive mocks", icon: Timer },
            { href: "/lessons", label: "Lessons", body: "Learn every skill", icon: BookText },
            { href: "/flashcards", label: "Flashcards", body: "150+ SAT words", icon: BookOpenCheck },
            { href: "/analytics", label: "Analytics", body: "Track progress", icon: BarChart3 },
          ].map((l) => (
            <Link key={l.href} href={l.href}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent className="flex items-center gap-3 py-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                    <l.icon className="h-5 w-5 text-primary" />
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
