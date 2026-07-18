"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, ChevronDown, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useRunner, type AnswerState } from "@/lib/runner-store";
import type { RunnerQuestion } from "@/lib/serialize";
import { isValidSPRFormat } from "@/lib/scoring";
import { AnnotatablePassage } from "@/components/runner/annotatable-passage";
import { CalculatorPanel } from "@/components/runner/calculator";
import { ReferenceSheet } from "@/components/runner/reference-sheet";
import { DirectionsDialog } from "@/components/runner/directions";
import { QuestionText } from "@/components/runner/math-text";
import { Navigator } from "@/components/runner/navigator";
import { saveAnswer } from "@/app/(app)/practice/actions";

const LETTERS = ["A", "B", "C", "D"];

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ModuleRunner({
  moduleAttemptId,
  attemptId,
  section,
  durationMinutes,
  questions,
  saved,
  finishAction,
  heading,
  submitLabel = "Review & submit",
  submitDialogTitle = "Submit this module?",
  submitDialogBody,
}: {
  moduleAttemptId: string;
  attemptId: string;
  section: string;
  durationMinutes: number;
  questions: RunnerQuestion[];
  saved: Record<string, Partial<AnswerState>>;
  /** Grades/advances server-side; may return a redirect target. */
  finishAction: (attemptId: string) => Promise<{ redirect?: string } | void>;
  /** Section/module label lines (full test only). Omit for standalone practice. */
  heading?: { line1: string; line2: string };
  submitLabel?: string;
  submitDialogTitle?: string;
  submitDialogBody?: string;
}) {
  const router = useRouter();
  const init = useRunner((s) => s.init);
  const current = useRunner((s) => s.current);
  const next = useRunner((s) => s.next);
  const prev = useRunner((s) => s.prev);
  const answers = useRunner((s) => s.answers);
  const setResponse = useRunner((s) => s.setResponse);
  const toggleFlag = useRunner((s) => s.toggleFlag);
  const toggleEliminated = useRunner((s) => s.toggleEliminated);
  const tick = useRunner((s) => s.tick);
  const timerHidden = useRunner((s) => s.timerHidden);
  const toggleTimer = useRunner((s) => s.toggleTimer);
  const markClean = useRunner((s) => s.markClean);

  const [ready, setReady] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [annotate, setAnnotate] = useState(false);

  const isMath = section === "MATH";

  // Initialize the store once.
  useEffect(() => {
    init(moduleAttemptId, questions, saved as Record<string, Partial<AnswerState>>);
    setReady(true);
  }, [init, moduleAttemptId, questions, saved]);

  const q = questions[current];
  const a = q ? answers[q.id] : undefined;

  // Per-second timer: count down module time, count up time-on-question.
  useEffect(() => {
    if (!ready || !q) return;
    const id = setInterval(() => {
      tick(q.id);
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [ready, q, tick]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    try {
      await Promise.all(
        questions.map((qq) => {
          const st = useRunner.getState().answers[qq.id];
          return saveAnswer({
            moduleAttemptId,
            questionId: qq.id,
            response: st?.response ?? null,
            secondsSpent: st?.secondsSpent ?? 0,
            flagged: st?.flagged ?? false,
            eliminated: st?.eliminated ?? [],
          });
        }),
      );
      const res = await finishAction(attemptId);
      if (res?.redirect) router.push(res.redirect);
      else router.refresh();
    } catch {
      toast.error("Could not submit — please try again");
      setSubmitting(false);
    }
  }, [attemptId, moduleAttemptId, questions, router, finishAction]);

  // Auto-submit when time runs out.
  useEffect(() => {
    if (ready && secondsLeft === 0 && !submitting) {
      toast.info("Time's up — submitting your module");
      void submit();
    }
  }, [ready, secondsLeft, submitting, submit]);

  // Debounced autosave of dirty answers.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const state = useRunner.getState();
      Array.from(state.dirty).forEach((qid) => {
        const st = state.answers[qid];
        if (!st) return;
        void saveAnswer({
          moduleAttemptId,
          questionId: qid,
          response: st.response,
          secondsSpent: st.secondsSpent,
          flagged: st.flagged,
          eliminated: st.eliminated,
        })
          .then(() => markClean(qid))
          .catch(() => {});
      });
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [answers, ready, moduleAttemptId, markClean]);

  // Keyboard navigation.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (q && ["a", "b", "c", "d"].includes(e.key.toLowerCase()) && q.type === "MCQ") {
        setResponse(q.id, e.key.toUpperCase());
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, next, prev, setResponse]);

  if (!ready || !q) return null;

  const answeredCount = questions.filter(
    (qq) => answers[qq.id]?.response != null && answers[qq.id]?.response !== "",
  ).length;
  const sprInvalid = q.type === "SPR" && !!a?.response && !isValidSPRFormat(a.response);
  const lowTime = secondsLeft <= 60;
  const isLast = current === questions.length - 1;

  return (
    <div className="flex h-screen flex-col bg-white text-[#0f172a]">
      {/* ---- Top bar ---- */}
      <header className="relative flex items-start justify-between px-6 pb-2 pt-3">
        <div className="bluebook-notch" aria-hidden />

        {/* Left: section/module + directions */}
        <div className="flex flex-col gap-0.5 text-[15px]">
          {heading && (
            <>
              <span className="font-bold leading-tight">{heading.line1}</span>
              <span className="font-bold leading-tight">{heading.line2}</span>
            </>
          )}
          <button
            onClick={() => setDirectionsOpen(true)}
            className="mt-0.5 flex items-center gap-1 text-sm font-medium hover:underline"
          >
            Directions <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* Center: timer + hide */}
        <div className="flex flex-col items-center gap-1 pt-1">
          <span
            className={cn(
              "text-2xl font-bold tabular-nums",
              timerHidden && "opacity-0",
              lowTime && !timerHidden && "text-red-600",
            )}
            aria-hidden={timerHidden}
          >
            {formatClock(secondsLeft)}
          </span>
          <button
            onClick={toggleTimer}
            className="rounded-full border border-[#0f172a]/40 px-4 py-0.5 text-sm font-medium hover:bg-muted"
          >
            {timerHidden ? "Show" : "Hide"}
          </button>
        </div>

        {/* Right: tools */}
        <div className="flex items-start gap-6 pt-1">
          {isMath ? (
            <>
              <button
                onClick={() => setCalcOpen((o) => !o)}
                className="flex flex-col items-center gap-0.5 text-xs font-medium"
                aria-pressed={calcOpen}
              >
                <CalcGlyph />
                Calculator
              </button>
              <button
                onClick={() => setRefOpen(true)}
                className="flex flex-col items-center gap-0.5 text-xs font-medium"
              >
                <span className="font-serif text-lg italic leading-none">
                  x<sup className="text-xs">2</sup>
                </span>
                Reference
              </button>
            </>
          ) : (
            <button
              onClick={() => setAnnotate((v) => !v)}
              className={cn(
                "flex flex-col items-center gap-0.5 text-xs font-medium",
                annotate && "text-primary",
              )}
              aria-pressed={annotate}
            >
              <Pencil className="h-5 w-5" />
              Annotate
            </button>
          )}
        </div>
      </header>

      <div className="bluebook-divider" />

      {/* ---- Body ---- */}
      <div className="flex-1 overflow-hidden">
        <div
          className={cn(
            "mx-auto grid h-full max-w-6xl gap-0",
            q.passage ? "md:grid-cols-2" : "grid-cols-1",
          )}
        >
          {q.passage && (
            <div className="overflow-y-auto border-r px-6 py-6" key={`p-${q.id}`}>
              <AnnotatablePassage
                content={q.passage.content}
                graphSpec={q.passage.graphSpec}
                active={annotate}
              />
            </div>
          )}

          <div className={cn("overflow-y-auto px-6 py-6", !q.passage && "mx-auto max-w-2xl")}>
            {/* Mark-for-review bar */}
            <div className="mb-5 flex items-center gap-3 border-b border-dashed border-muted-foreground/40 bg-muted/40 px-2 py-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-[#0f172a] text-sm font-bold text-white">
                {current + 1}
              </span>
              <button
                onClick={() => toggleFlag(q.id)}
                aria-pressed={a?.flagged}
                className="flex items-center gap-1.5 text-sm font-medium"
              >
                <Bookmark
                  className={cn(
                    "h-4 w-4",
                    a?.flagged ? "fill-red-500 text-red-500" : "text-[#0f172a]",
                  )}
                />
                Mark for Review
              </button>
            </div>

            <p className="mb-5 text-[15px] leading-relaxed">
              <QuestionText section={section}>{q.stem}</QuestionText>
            </p>

            {q.type === "MCQ" && q.choices ? (
              <ul className="space-y-3" role="radiogroup" aria-label="Answer choices">
                {q.choices.map((choice, i) => {
                  const letter = LETTERS[i];
                  const selected = a?.response === letter;
                  const struck = a?.eliminated.includes(letter);
                  return (
                    <li key={letter} className="flex items-center gap-2.5">
                      <button
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setResponse(q.id, letter)}
                        className={cn(
                          "flex-1 rounded-xl border px-4 py-3 text-left text-[15px] transition-colors",
                          selected
                            ? "border-2 border-primary bg-primary/5"
                            : "border border-[#0f172a]/25 hover:bg-muted/50",
                          struck && "opacity-45",
                        )}
                      >
                        <span className={cn(struck && "line-through")}>
                          <span className="font-medium">{letter}: </span>
                          <QuestionText section={section}>{choice}</QuestionText>
                        </span>
                      </button>
                      <button
                        onClick={() => toggleEliminated(q.id, letter)}
                        aria-label={`Eliminate choice ${letter}`}
                        aria-pressed={struck}
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm",
                          struck ? "text-primary" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <EliminateGlyph letter={letter} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="max-w-sm">
                <label htmlFor="spr" className="mb-2 block text-sm font-medium">
                  Enter your answer
                </label>
                <Input
                  id="spr"
                  inputMode="text"
                  autoComplete="off"
                  value={a?.response ?? ""}
                  onChange={(e) => setResponse(q.id, e.target.value)}
                  placeholder="e.g. 8 or 3/4 or 0.5"
                  aria-invalid={sprInvalid}
                  className={cn("text-base", sprInvalid && "border-destructive")}
                />
                {a?.response && !sprInvalid && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Answer preview: <span className="font-mono font-semibold text-foreground">{a.response}</span>
                  </p>
                )}
                {sprInvalid ? (
                  <p className="mt-1.5 text-xs text-destructive">
                    Enter a whole number, decimal, or fraction (e.g. 12, 0.5, 3/4).
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Grid-in: numbers, one decimal point or fraction slash.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bluebook-divider" />

      {/* ---- Bottom bar ---- */}
      <footer className="relative flex items-center justify-center px-6 py-3">
        <Navigator>
          <button className="flex items-center gap-2 rounded-md bg-[#0f172a] px-4 py-2 text-sm font-medium text-white">
            Question {current + 1} of {questions.length}
            <ChevronDown className="h-4 w-4" />
          </button>
        </Navigator>

        <div className="absolute right-6 flex items-center gap-2">
          <Button
            onClick={prev}
            disabled={current === 0}
            className="rounded-full bg-primary/15 px-6 font-semibold text-primary hover:bg-primary/25 disabled:opacity-40"
          >
            Back
          </Button>
          <Button
            onClick={() => (isLast ? setSubmitOpen(true) : next())}
            className="rounded-full bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {isLast ? submitLabel : "Next"}
          </Button>
        </div>
      </footer>

      {/* ---- Overlays ---- */}
      {calcOpen && <CalculatorPanel onClose={() => setCalcOpen(false)} />}
      <ReferenceSheet open={refOpen} onOpenChange={setRefOpen} />
      <DirectionsDialog open={directionsOpen} onOpenChange={setDirectionsOpen} section={section} />

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{submitDialogTitle}</DialogTitle>
            <DialogDescription>
              You&apos;ve answered {answeredCount} of {questions.length} questions.
              {answeredCount < questions.length &&
                " Unanswered questions will be marked incorrect."}{" "}
              {submitDialogBody ?? "You can't change answers after submitting."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>
              Keep working
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit module"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Small calculator glyph for the top-bar tool button. */
function CalcGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="11" x2="8" y2="11" />
      <line x1="12" y1="11" x2="12" y2="11" />
      <line x1="16" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="8" y2="15" />
      <line x1="12" y1="15" x2="12" y2="15" />
      <line x1="16" y1="15" x2="16" y2="19" />
    </svg>
  );
}

/** The "eliminate" glyph: the letter with a strike through it. */
function EliminateGlyph({ letter }: { letter: string }) {
  return (
    <span className="relative inline-flex items-center justify-center font-semibold">
      {letter}
      <span className="absolute left-1/2 top-1/2 h-[1.5px] w-5 -translate-x-1/2 -translate-y-1/2 rotate-[-15deg] bg-current" />
    </span>
  );
}
