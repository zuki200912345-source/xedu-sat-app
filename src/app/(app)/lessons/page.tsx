import type { Metadata } from "next";
import Link from "next/link";
import { BookText, Check } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Lessons" };

export default async function LessonsPage() {
  const session = await auth();
  const user = session!.user;

  const lessons = await prisma.lesson.findMany({ orderBy: [{ section: "asc" }, { order: "asc" }] });
  const completed = new Set(
    (await prisma.lessonProgress.findMany({ where: { userId: user.id }, select: { lessonId: true } })).map(
      (p) => p.lessonId,
    ),
  );

  const bySection = {
    RW: lessons.filter((l) => l.section === "RW"),
    MATH: lessons.filter((l) => l.section === "MATH"),
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lessons</h1>
        <p className="mt-1 text-muted-foreground">
          Clear, original lessons on every Digital SAT skill — concepts, strategies, a worked
          example, and the mistakes to avoid.
        </p>
      </div>

      {(["RW", "MATH"] as const).map((sec) => (
        <section key={sec} className="space-y-3">
          <h2 className="text-lg font-semibold">
            {sec === "RW" ? "Reading & Writing" : "Math"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bySection[sec].map((lesson) => {
              const done = completed.has(lesson.id);
              return (
                <Link key={lesson.id} href={`/lessons/${lesson.id}`}>
                  <Card className="h-full transition-colors hover:border-primary/50">
                    <CardHeader className="pb-2">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                          <BookText className="h-4 w-4 text-primary" />
                        </div>
                        {done && (
                          <Badge variant="secondary" className="gap-1 text-green-700">
                            <Check className="h-3 w-3" /> Done
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-sm">{lesson.skill}</CardTitle>
                      <CardDescription className="line-clamp-2 text-xs">
                        {lesson.summary}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <span className="text-xs text-muted-foreground">{lesson.domain}</span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
