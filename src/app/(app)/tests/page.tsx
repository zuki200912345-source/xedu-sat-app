import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Timer, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StartTestButton } from "@/components/tests/start-test-button";

export const metadata: Metadata = { title: "Full tests" };

export default async function TestsPage() {
  const session = await auth();
  const user = session!.user;

  const tests = await prisma.test.findMany({
    where: { kind: "FULL", isPublished: true },
    orderBy: { title: "asc" },
  });

  const attempts = await prisma.testAttempt.findMany({
    where: { userId: user.id, testId: { in: tests.map((t) => t.id) } },
    orderBy: { startedAt: "desc" },
  });
  const latestByTest = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) if (!latestByTest.has(a.testId)) latestByTest.set(a.testId, a);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Full adaptive tests</h1>
        <p className="mt-1 text-muted-foreground">
          Two sections, four modules, section-adaptive routing, and a real capped scaled
          score — the full Digital SAT experience.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {tests.map((test) => {
          const attempt = latestByTest.get(test.id);
          const inProgress =
            attempt && (attempt.status === "IN_PROGRESS" || attempt.status === "BREAK");
          const completed = attempt?.status === "COMPLETED";

          return (
            <Card key={test.id} className="flex flex-col">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                  <Timer className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">{test.title}</CardTitle>
                <CardDescription>{test.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" /> ~2h 14m
                  </Badge>
                  <Badge variant="secondary">98 questions</Badge>
                  <Badge variant="secondary">Section-adaptive</Badge>
                  {completed && attempt?.scaledTotal && (
                    <Badge className="gap-1">
                      <TrendingUp className="h-3 w-3" /> Scored {attempt.scaledTotal}
                    </Badge>
                  )}
                  {inProgress && <Badge variant="outline">In progress</Badge>}
                </div>
              </CardContent>
              <CardFooter className="gap-2">
                <StartTestButton
                  testId={test.id}
                  label={inProgress ? "Resume test" : completed ? "Retake test" : "Start test"}
                  className="flex-1"
                />
                {completed && attempt && (
                  <Button variant="outline" asChild>
                    <Link href={`/tests/report/${attempt.id}`}>View report</Link>
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
