import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QuestionReview } from "@/components/review/question-review";

export const metadata: Metadata = { title: "Module review" };

export default async function ReviewPage({
  params,
}: {
  params: { attemptId: string };
}) {
  const user = await requireUser();

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: params.attemptId },
    include: {
      test: true,
      moduleAttempts: {
        include: {
          module: {
            include: {
              questions: {
                orderBy: { order: "asc" },
                include: { question: { include: { passage: true } } },
              },
            },
          },
          answers: true,
        },
      },
    },
  });

  if (!attempt || attempt.userId !== user.id) notFound();

  const ma = attempt.moduleAttempts[0];
  const answerByQ = new Map(ma.answers.map((a) => [a.questionId, a]));
  const items = ma.module.questions.map((mq) => mq.question);
  const total = items.length;
  const correct = ma.rawCorrect ?? 0;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const totalSeconds = ma.answers.reduce((s, a) => s + a.secondsSpent, 0);
  const isMath = ma.module.section === "MATH";

  return (
    <div className="space-y-8">
      <div>
        <Link href="/practice" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to practice
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{attempt.test.title} — Review</h1>
      </div>

      {/* Score summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Raw score</div>
            <div className="mt-1 text-3xl font-bold">
              {correct}
              <span className="text-lg text-muted-foreground">/{total}</span>
            </div>
            <div className="mt-1 text-sm text-primary">{pct}% correct</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Time spent</div>
            <div className="mt-1 text-3xl font-bold">
              {Math.floor(totalSeconds / 60)}
              <span className="text-lg text-muted-foreground"> min</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {total ? Math.round(totalSeconds / total) : 0}s / question
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Section</div>
            <div className="mt-1 text-3xl font-bold">
              {isMath ? "Math" : "R&W"}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">Fixed practice module</div>
          </CardContent>
        </Card>
      </div>

      {/* Per-question review */}
      <div className="space-y-4">
        {items.map((q, i) => {
          const ans = answerByQ.get(q.id);
          return (
            <QuestionReview
              key={q.id}
              item={{
                id: q.id,
                index: i + 1,
                section: q.section,
                domain: q.domain,
                skill: q.skill,
                difficulty: q.difficulty,
                type: q.type,
                stem: q.stem,
                choices: q.choices ? (JSON.parse(q.choices) as string[]) : null,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation,
                passage: q.passage
                  ? {
                      content: q.passage.content,
                      graphSpec: q.passage.graphSpec ? JSON.parse(q.passage.graphSpec) : null,
                    }
                  : null,
                response: ans?.response ?? null,
                secondsSpent: ans?.secondsSpent ?? 0,
              }}
            />
          );
        })}
      </div>

      <div className="flex justify-center gap-3">
        <Button variant="outline" asChild>
          <Link href="/practice">Back to practice</Link>
        </Button>
        <Button asChild>
          <Link href={`/session/${attempt.testId}`}>Retake module</Link>
        </Button>
      </div>
    </div>
  );
}
