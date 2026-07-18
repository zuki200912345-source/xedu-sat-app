import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Compass, ListChecks, Target } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Diagnostic" };

export default async function DiagnosticPage() {
  const session = await auth();
  const user = session!.user;

  const lastCompleted = await prisma.testAttempt.findFirst({
    where: { userId: user.id, test: { kind: "DIAGNOSTIC" }, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Compass className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Adaptive Diagnostic</h1>
        <p className="mt-2 text-muted-foreground">
          Twenty questions that adjust to your level, in under 30 minutes. Get an estimated score
          band for each section and a prioritized study plan.
        </p>
      </div>

      {lastCompleted && (
        <Card className="border-primary/40 bg-accent/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Your last diagnostic</p>
              <p className="text-lg font-semibold">
                Estimated {(lastCompleted.rwScaled ?? 0) + (lastCompleted.mathScaled ?? 0)} · R&amp;W{" "}
                {lastCompleted.rwScaled}, Math {lastCompleted.mathScaled}
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href={`/diagnostic/result/${lastCompleted.id}`}>View study plan</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Feature icon={<ListChecks className="h-5 w-5 text-primary" />} title="20 questions" body="10 Reading & Writing, 10 Math" />
        <Feature icon={<Clock className="h-5 w-5 text-primary" />} title="~25 minutes" body="No time pressure" />
        <Feature icon={<Target className="h-5 w-5 text-primary" />} title="Study plan" body="Targets your weak spots" />
      </div>

      <div className="flex justify-center">
        <Button size="lg" asChild>
          <Link href="/diagnostic/quiz">{lastCompleted ? "Retake diagnostic" : "Start diagnostic"}</Link>
        </Button>
      </div>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-1 py-5 text-center">
        {icon}
        <div className="mt-1 font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{body}</div>
      </CardContent>
    </Card>
  );
}
