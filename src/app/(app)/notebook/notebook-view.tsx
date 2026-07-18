"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, NotebookPen, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Stimulus } from "@/components/runner/stimulus";
import { QuestionText } from "@/components/runner/math-text";
import { reattemptMistake } from "./actions";

const LETTERS = ["A", "B", "C", "D"];

export interface ActiveEntry {
  id: string;
  skill: string;
  section: string;
  type: string;
  stem: string;
  choices: string[] | null;
  passage: { content: string; graphSpec: unknown | null } | null;
  source: string;
  userResponse: string | null;
}
export interface ConqueredEntry {
  id: string;
  skill: string;
  section: string;
  stem: string;
  choices: string[] | null;
  correctAnswer: string;
  explanation: string;
}

export function NotebookView({
  active,
  conquered,
}: {
  active: ActiveEntry[];
  conquered: ConqueredEntry[];
}) {
  const skills = useMemo(
    () => Array.from(new Set([...active, ...conquered].map((e) => e.skill))).sort(),
    [active, conquered],
  );
  const [filter, setFilter] = useState<string>("all");

  const shownActive = active.filter((e) => filter === "all" || e.skill === filter);
  const shownConquered = conquered.filter((e) => filter === "all" || e.skill === filter);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <NotebookPen className="h-6 w-6 text-primary" /> Mistake notebook
          </h1>
          <p className="mt-1 text-muted-foreground">
            Every question you&apos;ve missed — from practice, tests, and walkthroughs. Re-attempt
            them to conquer each one.
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="all">All question types</option>
          {skills.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {active.length === 0 && conquered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No mistakes yet — nice! As you practice, anything you miss lands here to review.
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">
              To review{" "}
              <span className="text-sm font-normal text-muted-foreground">({shownActive.length})</span>
            </h2>
            {shownActive.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing to review here. 🎉</p>
            ) : (
              shownActive.map((e) => <ActiveCard key={e.id} entry={e} />)
            )}
          </section>

          {shownConquered.length > 0 && (
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <CheckCircle2 className="h-5 w-5 text-green-600" /> Conquered{" "}
                <span className="text-sm font-normal text-muted-foreground">({shownConquered.length})</span>
              </h2>
              {shownConquered.map((e) => (
                <Card key={e.id} className="border-green-200 bg-green-50/30">
                  <CardContent className="pt-6">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="secondary">{e.skill}</Badge>
                      <Badge className="bg-green-600 hover:bg-green-600">Conquered</Badge>
                    </div>
                    <p className="mb-2 text-sm font-medium">
                      <QuestionText section={e.section}>{e.stem}</QuestionText>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Answer: <span className="font-mono font-semibold">{e.correctAnswer}</span> — {e.explanation}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ActiveCard({ entry }: { entry: ActiveEntry }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<{ correct: boolean; correctAnswer: string; explanation: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function attempt(letter: string) {
    if (busy || result?.correct) return;
    setSelected(letter);
    setBusy(true);
    const res = await reattemptMistake({ questionId: entry.id, response: letter }).catch(() => null);
    setBusy(false);
    if (res && "correct" in res) setResult(res);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{entry.skill}</Badge>
          <Badge variant="outline" className="capitalize">
            from {entry.source}
          </Badge>
        </div>
        {entry.passage && (
          <div className="mb-3 rounded-lg bg-muted/50 p-3 text-sm">
            <Stimulus content={entry.passage.content} graphSpec={entry.passage.graphSpec} />
          </div>
        )}
        <p className="mb-3 font-medium">
          <QuestionText section={entry.section}>{entry.stem}</QuestionText>
        </p>

        {entry.choices ? (
          <div className="space-y-2">
            {entry.choices.map((choice, idx) => {
              const letter = LETTERS[idx];
              const isKey = result && letter === result.correctAnswer;
              const isChosen = letter === selected;
              return (
                <button
                  key={letter}
                  disabled={!!result?.correct || busy}
                  onClick={() => attempt(letter)}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors",
                    result && isKey && "border-green-500 bg-green-50",
                    result && isChosen && !isKey && "border-red-500 bg-red-50",
                    !result && "hover:border-primary/50 hover:bg-accent/40",
                  )}
                >
                  <span className="font-semibold">{letter}.</span>
                  <QuestionText section={entry.section}>{choice}</QuestionText>
                </button>
              );
            })}
          </div>
        ) : (
          <SprReattempt entry={entry} onResult={setResult} result={result} />
        )}

        {result && (
          <div
            className={cn(
              "mt-3 rounded-lg p-3 text-sm",
              result.correct ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800",
            )}
          >
            {result.correct ? (
              <p className="font-medium">Conquered! ✓ Nicely done — this one&apos;s resolved.</p>
            ) : (
              <p>
                <span className="font-medium">Not quite.</span> Correct answer:{" "}
                <span className="font-mono font-semibold">{result.correctAnswer}</span>. {result.explanation}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SprReattempt({
  entry,
  onResult,
  result,
}: {
  entry: ActiveEntry;
  onResult: (r: { correct: boolean; correctAnswer: string; explanation: string }) => void;
  result: { correct: boolean } | null;
}) {
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Your answer"
        disabled={!!result?.correct}
        className="w-40 rounded-md border border-input px-3 py-2 text-sm"
      />
      <Button
        size="sm"
        disabled={busy || !val || !!result?.correct}
        onClick={async () => {
          setBusy(true);
          const res = await reattemptMistake({ questionId: entry.id, response: val }).catch(() => null);
          setBusy(false);
          if (res && "correct" in res) onResult(res);
        }}
      >
        <RotateCcw className="mr-1.5 h-4 w-4" /> Check
      </Button>
    </div>
  );
}

