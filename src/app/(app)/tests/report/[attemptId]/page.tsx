import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Info } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isResponseCorrect } from "@/lib/scoring";
import { SPEC, tierByNumber, questionsPerModule, type Section } from "@/lib/sat-engine/spec";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReportReview, type SectionReview } from "@/components/review/report-review";
import type { ReviewItem } from "@/components/review/question-review";

export const metadata: Metadata = { title: "Score report" };

const SECTIONS: { key: Section; label: string }[] = [
  { key: "RW", label: "Reading & Writing" },
  { key: "MATH", label: "Math" },
];

function tierFromPath(path: string): number {
  const n = parseInt(path.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 3;
}

interface SectionScore {
  raw: number;
  max: number;
  tier: number;
  tierLabel: string;
  tierRange: [number, number];
  tierCap: number;
  m1Correct: number;
  m1Total: number;
  scaled: number;
}

type Accuracy = Map<string, { correct: number; total: number }>;
function tally(map: Accuracy, key: string, correct: boolean) {
  const e = map.get(key) ?? { correct: 0, total: 0 };
  e.total++;
  if (correct) e.correct++;
  map.set(key, e);
}

export default async function ReportPage({ params }: { params: { attemptId: string } }) {
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
  if (attempt.status !== "COMPLETED") notFound();

  const sectionReviews: SectionReview[] = [];
  const sectionScores: Record<string, SectionScore> = {};
  const byDomain: Accuracy = new Map();
  const bySkill: Accuracy = new Map();

  for (const { key, label } of SECTIONS) {
    const mAttempts = attempt.moduleAttempts
      .filter((ma) => ma.module.section === key)
      .sort((a, b) => a.module.order - b.module.order);

    const raw = mAttempts.reduce((s, ma) => s + (ma.rawCorrect ?? 0), 0);
    const perModule = questionsPerModule(key);
    const m1 = mAttempts.find((ma) => ma.module.order === 1);
    const m2 = mAttempts.find((ma) => ma.module.order === 2);
    const tier = tierFromPath(m2?.module.path ?? "TIER3");
    const tierInfo = tierByNumber(key, tier);
    const scaled = key === "RW" ? attempt.rwScaled : attempt.mathScaled;

    sectionScores[key] = {
      raw,
      max: perModule * 2,
      tier,
      tierLabel: tierInfo.label.replace(/_/g, " "),
      tierRange: tierInfo.module1_correct_range,
      tierCap: SPEC.scoring_model.per_section.tier_caps[String(tier)] ?? 800,
      m1Correct: m1?.rawCorrect ?? 0,
      m1Total: perModule,
      scaled: scaled ?? 200,
    };

    const modules = mAttempts.map((ma) => {
      const answerByQ = new Map(ma.answers.map((a) => [a.questionId, a]));
      let idx = 0;
      const items: ReviewItem[] = ma.module.questions.map((mq) => {
        const q = mq.question;
        const ans = answerByQ.get(q.id);
        idx++;
        const correct = isResponseCorrect(q.type, q.correctAnswer, ans?.response ?? null);
        tally(byDomain, `${key}:${q.domain}`, correct);
        tally(bySkill, `${key}:${q.skill}`, correct);
        return {
          id: q.id,
          index: idx,
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
            ? { content: q.passage.content, graphSpec: q.passage.graphSpec ? JSON.parse(q.passage.graphSpec) : null }
            : null,
          response: ans?.response ?? null,
          secondsSpent: ans?.secondsSpent ?? 0,
        };
      });
      const t = ma.module.order === 2 ? tierFromPath(ma.module.path) : 0;
      return {
        title:
          ma.module.order === 2
            ? `Module 2 · Tier ${t} (${tierByNumber(key, t).label.replace(/_/g, " ")})`
            : "Module 1 (baseline)",
        items,
      };
    });

    sectionReviews.push({ section: key, label, modules });
  }

  const total = attempt.scaledTotal ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/tests" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to tests
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{attempt.test.title} — Score Report</h1>
      </div>

      {/* Total score hero */}
      <Card className="border-primary/40 bg-gradient-to-br from-accent/60 to-background">
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Total scaled score
          </span>
          <div className="text-6xl font-bold text-primary">{total}</div>
          <span className="text-sm text-muted-foreground">out of 1600</span>
        </CardContent>
      </Card>

      {/* Section breakdown with tier + routing explanation */}
      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map(({ key, label }) => {
          const s = sectionScores[key];
          return (
            <Card key={key}>
              <CardContent className="space-y-2 pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{label}</span>
                  <Badge variant={s.tier >= 4 ? "default" : "secondary"} className="capitalize">
                    Tier {s.tier} · {s.tierLabel}
                  </Badge>
                </div>
                <div className="text-4xl font-bold">{s.scaled}</div>
                <div className="text-sm text-muted-foreground">
                  {s.raw}/{s.max} correct · scale 200–800
                </div>
                <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  Module 1: <strong>{s.m1Correct}/{s.m1Total}</strong> correct → routed to{" "}
                  <strong className="capitalize">Tier {s.tier} ({s.tierLabel})</strong>{" "}
                  (range {s.tierRange[0]}–{s.tierRange[1]}). This tier caps the section at{" "}
                  <strong>{s.tierCap}</strong>.
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Accuracy breakdowns */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AccuracyCard title="Accuracy by domain" data={byDomain} />
        <AccuracyCard title="Accuracy by question type" data={bySkill} />
      </div>

      {/* Honesty note (spec meta.note + prompt §6) */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          The <strong>5-tier</strong> adaptive routing and the tier-capped scoring shown here are
          approximations built for focused practice. The real Digital SAT routes to only{" "}
          <strong>two</strong> Module 2 variants and uses a proprietary IRT scoring model, so your
          official score may differ.
        </p>
      </div>

      {/* Full review */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Question review</h2>
        <ReportReview sections={sectionReviews} />
      </div>

      <div className="flex justify-center gap-3">
        <Button variant="outline" asChild>
          <Link href="/analytics">See analytics</Link>
        </Button>
        <Button asChild>
          <Link href="/tests">Back to tests</Link>
        </Button>
      </div>
    </div>
  );
}

function AccuracyCard({ title, data }: { title: string; data: Accuracy }) {
  const rows = [...data.entries()]
    .map(([k, v]) => ({ label: k.split(":")[1], section: k.split(":")[0], ...v }))
    .sort((a, b) => a.correct / a.total - b.correct / b.total);
  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="mb-3 text-sm font-semibold">{title}</h3>
        <div className="space-y-2.5">
          {rows.map((r) => {
            const pct = Math.round((r.correct / r.total) * 100);
            return (
              <div key={r.section + r.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    <span className="text-muted-foreground">{r.section === "MATH" ? "Math" : "R&W"}</span>{" "}
                    {r.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {r.correct}/{r.total} · {pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={pct >= 70 ? "h-full bg-primary" : pct >= 40 ? "h-full bg-amber-500" : "h-full bg-destructive"}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
