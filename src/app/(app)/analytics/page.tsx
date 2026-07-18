import type { Metadata } from "next";
import Link from "next/link";
import { Award, Flame, Target, Zap } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BADGES, levelForXp } from "@/lib/gamification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsCharts } from "./analytics-charts";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const session = await auth();
  const uid = session!.user.id;

  const [dbUser, fullAttempts, mastery, answers, earnedBadges] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: uid }, select: { xp: true, streak: true } }),
    prisma.testAttempt.findMany({
      where: { userId: uid, status: "COMPLETED", test: { kind: "FULL" } },
      orderBy: { completedAt: "asc" },
      select: { completedAt: true, scaledTotal: true, rwScaled: true, mathScaled: true },
    }),
    prisma.skillMastery.findMany({ where: { userId: uid } }),
    prisma.answer.findMany({
      where: { moduleAttempt: { attempt: { userId: uid } } },
      select: { isCorrect: true, secondsSpent: true, question: { select: { difficulty: true, skill: true, section: true } } },
    }),
    prisma.badge.findMany({ where: { userId: uid } }),
  ]);

  const level = levelForXp(dbUser.xp);

  // Score trend
  const trend = fullAttempts.map((a, i) => ({
    name: `Test ${i + 1}`,
    total: a.scaledTotal ?? 0,
    rw: a.rwScaled ?? 0,
    math: a.mathScaled ?? 0,
  }));

  // Accuracy by difficulty
  const diffAgg: Record<string, { correct: number; total: number }> = {
    easy: { correct: 0, total: 0 },
    medium: { correct: 0, total: 0 },
    hard: { correct: 0, total: 0 },
  };
  for (const a of answers) {
    const d = a.question.difficulty;
    if (diffAgg[d]) {
      diffAgg[d].total++;
      if (a.isCorrect) diffAgg[d].correct++;
    }
  }
  const byDifficulty = Object.entries(diffAgg).map(([difficulty, v]) => ({
    difficulty: difficulty[0].toUpperCase() + difficulty.slice(1),
    accuracy: v.total ? Math.round((v.correct / v.total) * 100) : 0,
  }));

  // Skill mastery heatmap data
  const masteryData = mastery
    .map((m) => ({
      skill: m.skill,
      section: m.section,
      accuracy: m.attempts ? Math.round((m.correct / m.attempts) * 100) : 0,
      attempts: m.attempts,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  // Pacing
  const timed = answers.filter((a) => a.secondsSpent > 0);
  const avgPace = timed.length
    ? Math.round(timed.reduce((s, a) => s + a.secondsSpent, 0) / timed.length)
    : 0;

  // Mistake log grouped by skill
  const mistakeMap = new Map<string, number>();
  for (const a of answers) if (a.isCorrect === false) mistakeMap.set(a.question.skill, (mistakeMap.get(a.question.skill) ?? 0) + 1);
  const mistakes = [...mistakeMap.entries()].map(([skill, count]) => ({ skill, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  // Predicted band
  const overall = answers.length ? answers.filter((a) => a.isCorrect).length / answers.length : 0;
  const predicted =
    fullAttempts.at(-1)?.scaledTotal ?? Math.round((400 + overall * 1200) / 10) * 10;

  const hasData = answers.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-muted-foreground">Track your progress, spot weak spots, and stay motivated.</p>
      </div>

      {/* Gamification row */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Level" value={level.level} icon={<Award className="h-4 w-4 text-primary" />} hint={`${level.into}/${level.toNext} XP`} />
        <StatCard label="Total XP" value={dbUser.xp} icon={<Zap className="h-4 w-4 text-primary" />} />
        <StatCard label="Day streak" value={dbUser.streak} icon={<Flame className="h-4 w-4 text-primary" />} />
        <StatCard label="Predicted score" value={predicted} icon={<Target className="h-4 w-4 text-primary" />} hint="Based on your work" />
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-muted-foreground">No data yet. Take the diagnostic or a drill to see your analytics.</p>
            <div className="flex gap-3">
              <Button asChild>
                <Link href="/diagnostic">Take the diagnostic</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/practice">Practice</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <AnalyticsCharts
          trend={trend}
          byDifficulty={byDifficulty}
          mastery={masteryData}
          mistakes={mistakes}
          avgPace={avgPace}
        />
      )}

      {/* Badges */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Badges</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(BADGES).map(([key, b]) => {
            const earned = earnedBadges.some((e) => e.key === key);
            return (
              <Card key={key} className={earned ? "border-primary/40" : "opacity-50"}>
                <CardContent className="flex flex-col items-center gap-1 py-5 text-center">
                  <span className="text-3xl">{b.emoji}</span>
                  <div className="text-sm font-semibold">{b.title}</div>
                  <div className="text-xs text-muted-foreground">{b.description}</div>
                  {earned && <Badge className="mt-1">Earned</Badge>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, icon, hint }: { label: string; value: React.ReactNode; icon: React.ReactNode; hint?: string }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
