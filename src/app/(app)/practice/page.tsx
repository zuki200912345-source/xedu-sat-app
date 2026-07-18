import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Calculator, Dumbbell, Sparkles, Swords } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DrillBuilder } from "./drill-builder";
import { WeaknessButton } from "./weakness-button";

export const metadata: Metadata = { title: "Practice drills" };

export default async function PracticePage() {
  const [modules, topicDrills] = await Promise.all([
    prisma.test.findMany({
      where: { kind: "DRILL", isPublished: true, title: { startsWith: "Practice Module" } },
      include: { modules: { include: { _count: { select: { questions: true } } } } },
      orderBy: { title: "asc" },
    }),
    prisma.test.findMany({
      where: { kind: "TOPIC", isPublished: true },
      include: { modules: { include: { _count: { select: { questions: true } } } } },
      orderBy: [{ section: "asc" }, { skill: "asc" }, { title: "asc" }],
    }),
  ]);

  // Group topic drills by domain for a browsable library.
  const byDomain = new Map<string, typeof topicDrills>();
  for (const t of topicDrills) {
    const key = `${t.section === "MATH" ? "Math" : "Reading & Writing"} · ${t.domain}`;
    if (!byDomain.has(key)) byDomain.set(key, []);
    byDomain.get(key)!.push(t);
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Practice drills</h1>
        <p className="mt-1 text-muted-foreground">
          Build a custom drill, let us target your weak spots, or pick a topic from the library.
        </p>
      </div>

      {/* Weakness Conqueror + custom builder */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-primary/40 bg-accent/40">
          <CardHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Swords className="h-5 w-5" />
            </div>
            <CardTitle>Weakness Conqueror</CardTitle>
            <CardDescription>
              We analyze your history and auto-build a drill from your weakest skills. New here?
              You&apos;ll get a broad warm-up to find your baseline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WeaknessButton />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <Dumbbell className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>Custom drill builder</CardTitle>
            <CardDescription>Pick a section, skill, difficulty, and length.</CardDescription>
          </CardHeader>
          <CardContent>
            <DrillBuilder />
          </CardContent>
        </Card>
      </div>

      {/* Full practice modules */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Full practice modules</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {modules.map((test) => {
            const mod = test.modules[0];
            const isMath = mod?.section === "MATH";
            return (
              <Card key={test.id} className="flex flex-col">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                    {isMath ? (
                      <Calculator className="h-5 w-5 text-primary" />
                    ) : (
                      <BookOpen className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <CardTitle className="text-base">{test.title}</CardTitle>
                  <CardDescription>{test.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto flex items-center justify-between">
                  <Badge variant="secondary">{mod?._count.questions ?? 0} questions</Badge>
                  <Button asChild>
                    <Link href={`/session/${test.id}`}>Start module</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Topic library */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Topic library</h2>
          <Badge variant="secondary">{topicDrills.length} drills</Badge>
        </div>
        {[...byDomain.entries()].map(([domain, drills]) => (
          <div key={domain} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">{domain}</h3>
            <div className="flex flex-wrap gap-2">
              {drills.map((d) => (
                <Link
                  key={d.id}
                  href={`/session/${d.id}`}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm hover:border-primary/50 hover:bg-accent"
                >
                  {d.title}
                  <Badge variant="secondary" className="text-[10px]">
                    {d.modules[0]?._count.questions ?? 0}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
