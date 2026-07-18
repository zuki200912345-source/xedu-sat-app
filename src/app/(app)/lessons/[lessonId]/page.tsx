import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowRight, Lightbulb, Target } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MathText } from "@/components/runner/math-text";
import { CompleteLessonButton } from "./complete-button";

export const metadata: Metadata = { title: "Lesson" };

interface LessonBody {
  concepts: { heading: string; body: string }[];
  strategies: string[];
  worked: { problem: string; solution: string };
  mistakes: string[];
  takeaway: string;
}

export default async function LessonPage({ params }: { params: { lessonId: string } }) {
  const session = await auth();
  const user = session!.user;

  const lesson = await prisma.lesson.findUnique({ where: { id: params.lessonId } });
  if (!lesson) notFound();

  const body = JSON.parse(lesson.body) as LessonBody;
  const isMath = lesson.section === "MATH";
  const Text = ({ children }: { children: string }) =>
    isMath ? <MathText>{children}</MathText> : <>{children}</>;

  const done = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
  });

  const drill = await prisma.test.findFirst({
    where: { kind: "TOPIC", skill: lesson.skill },
    select: { id: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href="/lessons" className="text-sm text-muted-foreground hover:text-foreground">
          ← All lessons
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{lesson.domain}</Badge>
          <Badge variant="secondary">{isMath ? "Math" : "Reading & Writing"}</Badge>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{lesson.title}</h1>
        <p className="mt-2 text-lg text-muted-foreground">{lesson.summary}</p>
      </div>

      {/* Concepts */}
      <section className="space-y-4">
        {body.concepts.map((c, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{c.heading}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              <Text>{c.body}</Text>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Strategies */}
      {body.strategies?.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Target className="h-5 w-5 text-primary" /> Strategies
          </h2>
          <ul className="space-y-2">
            {body.strategies.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span><Text>{s}</Text></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Worked example */}
      {body.worked && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Lightbulb className="h-5 w-5 text-primary" /> Worked example
          </h2>
          <Card className="bg-accent/40">
            <CardContent className="space-y-3 pt-6 text-sm">
              <p className="font-medium"><Text>{body.worked.problem}</Text></p>
              <div className="border-t pt-3 leading-relaxed text-muted-foreground">
                <Text>{body.worked.solution}</Text>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Mistakes */}
      {body.mistakes?.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Common mistakes
          </h2>
          <ul className="space-y-2">
            {body.mistakes.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span><Text>{m}</Text></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Takeaway */}
      {body.takeaway && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary">Key takeaway</div>
          <p className="mt-1 font-medium"><Text>{body.takeaway}</Text></p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        <CompleteLessonButton lessonId={lesson.id} alreadyDone={!!done} />
        {drill && (
          <Link
            href={`/session/${drill.id}`}
            className="inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Practice this skill <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
