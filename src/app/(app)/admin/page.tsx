import type { Metadata } from "next";
import Link from "next/link";
import { BookText, FileQuestion, Layers, Lock, ShieldAlert, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireRole("ADMIN");

  const [users, questions, tests, lessons, corpus, drafts] = await Promise.all([
    prisma.user.count(),
    prisma.question.count({ where: { status: "PUBLISHED" } }),
    prisma.test.count(),
    prisma.lesson.count(),
    prisma.referenceCorpusItem.count(),
    prisma.question.count({ where: { status: "DRAFT" } }),
  ]);

  // ---- Platform impact: is the product actually helping? -------------------
  // Computed from real user work (the same events feed the training export).
  const [trainingEvents, completedAttempts, walkthroughsDone, readingSubs, answers] = await Promise.all([
    prisma.trainingEvent.count(),
    prisma.testAttempt.findMany({
      where: { status: "COMPLETED", scaledTotal: { not: null } },
      orderBy: { completedAt: "asc" },
      select: { userId: true, scaledTotal: true },
    }),
    prisma.walkthroughProgress.count({ where: { status: "COMPLETED" } }),
    prisma.readingSubmission.findMany({ orderBy: { submittedAt: "asc" }, select: { userId: true, score: true } }),
    prisma.answer.count({ where: { isCorrect: { not: null } } }),
  ]);
  // Score improvement: mean(last scaled − first scaled) across users with 2+ scored tests.
  const byUser = new Map<string, number[]>();
  for (const a of completedAttempts) {
    byUser.set(a.userId, [...(byUser.get(a.userId) ?? []), a.scaledTotal!]);
  }
  const deltas = [...byUser.values()].filter((v) => v.length >= 2).map((v) => v[v.length - 1] - v[0]);
  const avgScoreDelta = deltas.length ? Math.round(deltas.reduce((s, d) => s + d, 0) / deltas.length) : null;
  // Reading trajectory: mean(first summary score) vs mean(latest) across users with 2+.
  const rByUser = new Map<string, number[]>();
  for (const r of readingSubs) rByUser.set(r.userId, [...(rByUser.get(r.userId) ?? []), r.score]);
  const rPairs = [...rByUser.values()].filter((v) => v.length >= 2);
  const readingDelta = rPairs.length
    ? Math.round(rPairs.reduce((s, v) => s + (v[v.length - 1] - v[0]), 0) / rPairs.length)
    : null;

  const stats = [
    { label: "Users", value: users, href: "/admin/users", icon: Users },
    { label: "Published questions", value: questions, href: "/admin/questions", icon: FileQuestion },
    { label: "Tests & drills", value: tests, href: "/tests", icon: Layers },
    { label: "Lessons", value: lessons, href: "/lessons", icon: BookText },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin panel</h1>
        <p className="mt-1 text-muted-foreground">Manage content, users, and internal tooling.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:border-primary/50">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <s.icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Platform impact</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Longitudinal signals from real student work — the honest answer to &ldquo;is this
          actually helping?&rdquo;. The raw corpus feeds model training.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-2xl font-bold">{avgScoreDelta != null ? (avgScoreDelta >= 0 ? `+${avgScoreDelta}` : avgScoreDelta) : "—"}</div>
            <p className="text-xs text-muted-foreground">Avg scaled-score change, first → latest full test (users with 2+)</p>
          </div>
          <div>
            <div className="text-2xl font-bold">{readingDelta != null ? (readingDelta >= 0 ? `+${readingDelta}%` : `${readingDelta}%`) : "—"}</div>
            <p className="text-xs text-muted-foreground">Avg reading-comprehension change, first → latest summary</p>
          </div>
          <div>
            <div className="text-2xl font-bold">{walkthroughsDone}</div>
            <p className="text-xs text-muted-foreground">Thoth walkthroughs completed</p>
          </div>
          <div>
            <div className="text-2xl font-bold">{answers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Graded responses captured</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 border-t pt-4">
          <span className="text-sm text-muted-foreground">{trainingEvents.toLocaleString()} training events stored</span>
          <a
            href="/api/admin/training-export"
            className="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            Export training corpus (JSONL)
          </a>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/questions">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileQuestion className="h-5 w-5 text-primary" /> Question bank
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Browse the bank and author new original items with the built-in similarity check.
              {drafts > 0 && <span className="ml-1 font-medium text-amber-600">{drafts} draft(s) awaiting review.</span>}
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/users">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-primary" /> Users
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Manage roles and subscription tiers.
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/reference" className="md:col-span-2">
          <Card className="h-full border-amber-300/60 bg-amber-50/40 transition-colors hover:border-amber-400">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-5 w-5 text-amber-600" /> Internal reference corpus
                <Lock className="h-4 w-4 text-amber-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {corpus} attribute rows. Admin-only structural notes used to guide authoring — never
              exposed to students and never containing copyrighted text.
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
