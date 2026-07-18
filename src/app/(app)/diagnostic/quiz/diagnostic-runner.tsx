"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Stimulus } from "@/components/runner/stimulus";
import { QuestionText } from "@/components/runner/math-text";
import type { RunnerQuestion } from "@/lib/serialize";
import {
  startDiagnostic,
  nextDiagnosticQuestion,
  submitDiagnostic,
} from "@/app/(app)/diagnostic/actions";

const LETTERS = ["A", "B", "C", "D"];

export function DiagnosticRunner() {
  const router = useRouter();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [question, setQuestion] = useState<RunnerQuestion | null>(null);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(20);
  const [response, setResponse] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  // Kick off the diagnostic once.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const id = await startDiagnostic();
        setAttemptId(id);
        const first = await nextDiagnosticQuestion({ attemptId: id, prev: null });
        if (!first.done) {
          setQuestion(first.question);
          setIndex(first.index);
          setTotal(first.total);
        }
      } catch {
        toast.error("Could not start the diagnostic");
      }
    })();
  }, []);

  const advance = useCallback(async () => {
    if (!attemptId || !question || busy) return;
    setBusy(true);
    try {
      const res = await nextDiagnosticQuestion({
        attemptId,
        prev: { questionId: question.id, response: response || null },
      });
      if (res.done) {
        const done = await submitDiagnostic(attemptId);
        router.push(`/diagnostic/result/${done.attemptId}`);
        return;
      }
      setQuestion(res.question);
      setIndex(res.index);
      setResponse("");
      setBusy(false);
    } catch {
      toast.error("Something went wrong — try again");
      setBusy(false);
    }
  }, [attemptId, question, response, busy, router]);

  if (!question) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Preparing your diagnostic…
      </div>
    );
  }

  const pct = Math.round(((index - 1) / total) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Question {index} of {total}
          </span>
          <Badge variant="secondary">{question.section === "MATH" ? "Math" : "Reading & Writing"}</Badge>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {question.passage && (
        <div className="rounded-lg border bg-card p-4">
          <Stimulus content={question.passage.content} graphSpec={question.passage.graphSpec} />
        </div>
      )}

      <p className="text-[15px] font-medium leading-relaxed">
        <QuestionText section={question.section}>{question.stem}</QuestionText>
      </p>

      {question.type === "MCQ" && question.choices ? (
        <div className="space-y-2.5">
          {question.choices.map((choice, i) => {
            const letter = LETTERS[i];
            const selected = response === letter;
            return (
              <button
                key={letter}
                onClick={() => setResponse(letter)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors",
                  selected ? "border-2 border-primary bg-primary/5" : "border hover:bg-accent/50",
                )}
              >
                <span className="font-medium">{letter}:</span>
                <QuestionText section={question.section}>{choice}</QuestionText>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="max-w-xs">
          <label htmlFor="dspr" className="mb-2 block text-sm font-medium">
            Enter your answer
          </label>
          <Input
            id="dspr"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="e.g. 8 or 3/4"
          />
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={advance} disabled={busy || response === ""}>
          {busy ? "Saving…" : index >= total ? "Finish diagnostic" : "Next question"}
        </Button>
      </div>
    </div>
  );
}
