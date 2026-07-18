import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookText, Dumbbell, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Diagnostic results" };

export default async function DiagnosticResultPage({ params }: { params: { attemptId: string } }) {
  const user = await requireUser();

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: params.attemptId },
    include: { moduleAttempts: { include: { answers: { include: { question: true } } } } },
  });
  if (!attempt || attempt.userId !== user.id || attempt.status !== "COMPLETED") notFound();

  const answers = attempt.moduleAttempts[0].answers;

  // Weakest skills: those with the lowest accuracy in this diagnostic.
  const bySkill = new Map<string, { section: string; domain: string; attempts: number; correct: number }>();
  for (const a of answers) {
    const k = a.question.skill;
    const e = bySkill.get(k) ?? { section: a.question.section, domain: a.question.domain, attempts: 0, correct: 0 };
    e.attempts++;
    if (a.isCorrect) e.correct++;
    bySkill.set(k, e);
  }
  const weak = [...bySkill.entries()]
    .map(([skill, d]) => ({ skill, ...d, acc: d.correct / d.attempts }))
    .sort((a, b) => a.acc - b.acc)
    .slice(0, 5);

  // Look up lessons + topic drills for the weak skills.
  const lessons = await prisma.lesson.findMany({
    where: { skill: { in: weak.map((w) => w.skill) } },
    select: { id: true, skill: true },
  });
  const drills = await prisma.test.findMany({
    where: { kind: "TOPIC", skill: { in: weak.map((w) => w.skill) } },
    select: { id: true, skill: true, difficulty: true },
  });
  const lessonBySkill = new Map(lessons.map((l) => [l.skill, l.id]));
  const drillBySkill = new Map<string, string>();
  for (const d of drills) if (!drillBySkill.has(d.skill!)) drillBySkill.set(d.skill!, d.id);

  const rw = attempt.rwScaled ?? 0;
  const math = attempt.mathScaled ?? 0;
  const total = rw + math;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Your diagnostic results</h1>
        <p className="mt-1 text-muted-foreground">An estimated starting point and where to focus next.</p>
      </div>

      {/* Estimated bands */}
      <Card className="border-primary/40 bg-gradient-to-br from-accent/60 to-background">
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Estimated total
          </span>
          <div className="text-5xl font-bold text-primary">
            {Math.max(400, total - 40)}–{Math.min(1600, total + 40)}
          </div>
          <div className="mt-2 flex gap-6 text-sm">
            <span>
              R&amp;W <strong>{rw}</strong>
            </span>
            <span>
              Math <strong>{math}</strong>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Study plan */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <TrendingUp className="h-5 w-5 text-primary" /> Your prioritized study plan
        </h2>
        <div className="space-y-3">
          {weak.map((w, i) => (
            <Card key={w.skill}>
              <CardContent className="flex flex-wrap items-center gap-3 pt-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{w.skill}</span>
                    <Badge variant="outline" className="text-xs">
                      {w.domain}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {w.correct}/{w.attempts} correct on the diagnostic
                  </div>
                </div>
                <div className="flex gap-2">
                  {lessonBySkill.has(w.skill) && (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/lessons/${lessonBySkill.get(w.skill)}`}>
                        <BookText className="mr-1 h-3.5 w-3.5" /> Learn
                      </Link>
                    </Button>
                  )}
                  {drillBySkill.has(w.skill) && (
                    <Button size="sm" asChild>
                      <Link href={`/session/${drillBySkill.get(w.skill)}`}>
                        <Dumbbell className="mr-1 h-3.5 w-3.5" /> Practice
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="flex justify-center gap-3">
        <Button variant="outline" asChild>
          <Link href="/practice">
            Start practicing <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
