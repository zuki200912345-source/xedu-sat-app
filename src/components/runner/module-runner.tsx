"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, ChevronDown, Ellipsis, LogOut, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useFullscreenSession } from "@/lib/use-fullscreen";
import { useRunner, type AnswerState } from "@/lib/runner-store";
import type { RunnerQuestion } from "@/lib/serialize";
import { isValidSPRFormat } from "@/lib/scoring";
import { AnnotatablePassage } from "@/components/runner/annotatable-passage";
import { CalculatorPanel } from "@/components/runner/calculator";
import { ReferenceSheet } from "@/components/runner/reference-sheet";
import { DirectionsDialog } from "@/components/runner/directions";
import { QuestionText } from "@/components/runner/math-text";
import { Navigator } from "@/components/runner/navigator";
import {
  restartModuleAttempt,
  saveAnswer,
  saveModuleProgress,
} from "@/app/(app)/practice/actions";

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
  hasSavedProgress = false,
  initialSecondsLeft,
  initialQuestionIndex = 0,
  exitHref,
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
  hasSavedProgress?: boolean;
  initialSecondsLeft?: number | null;
  initialQuestionIndex?: number;
  exitHref: string;
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
  const [started, setStarted] = useState(false);
  const [resumeAvailable, setResumeAvailable] = useState(hasSavedProgress);
  const [secondsLeft, setSecondsLeft] = useState(
    initialSecondsLeft ?? durationMinutes * 60,
  );
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [exitStep, setExitStep] = useState<0 | 1 | 2>(0);
  const [calcOpen, setCalcOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [annotate, setAnnotate] = useState(false);

  // Tests & practice run in true browser fullscreen (distraction-free).
  useFullscreenSession();

  const isMath = section === "MATH";

  // Initialize the store once.
  const storageKey = `xedu-sat:runner:${moduleAttemptId}`;

  useEffect(() => {
    let restoredQuestion = initialQuestionIndex;
    if (hasSavedProgress) {
      try {
        const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null") as {
          version?: number;
          current?: number;
        } | null;
        if (stored?.version === 1 && Number.isInteger(stored.current)) {
          restoredQuestion = stored.current ?? initialQuestionIndex;
        }
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
    init(
      moduleAttemptId,
      questions,
      saved as Record<string, Partial<AnswerState>>,
      restoredQuestion,
    );
    setReady(true);
  }, [hasSavedProgress, init, initialQuestionIndex, moduleAttemptId, questions, saved, storageKey]);

  const q = questions[current];
  const a = q ? answers[q.id] : undefined;
  const secondsLeftRef = useRef(secondsLeft);

  useEffect(() => {
    secondsLeftRef.current = secondsLeft;
  }, [secondsLeft]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(storageKey, JSON.stringify({ version: 1, current }));
  }, [current, ready, storageKey]);

  // Once the module starts, warn on any attempt to leave/close the tab.
  useEffect(() => {
    if (!started || submitting) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [started, submitting]);

  // Persist the clock throughout the session so closing the tab loses at most
  // a few seconds. The explicit Exit flow performs a final awaited save.
  useEffect(() => {
    if (!started || submitting || exiting) return;
    const persist = () => {
      void saveModuleProgress({
        moduleAttemptId,
        secondsRemaining: secondsLeftRef.current,
      }).catch(() => {});
    };
    persist();
    const id = setInterval(persist, 10_000);
    return () => clearInterval(id);
  }, [exiting, moduleAttemptId, started, submitting]);

  // Per-second timer: count down module time, count up time-on-question.
  useEffect(() => {
    if (!ready || !started || !q) return;
    const id = setInterval(() => {
      tick(q.id);
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [ready, started, q, tick]);

  const flushAnswers = useCallback(
    () =>
      Promise.all(
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
      ),
    [moduleAttemptId, questions],
  );

  const submit = useCallback(async () => {
    setSubmitting(true);
    try {
      await flushAnswers();
      const res = await finishAction(attemptId);
      localStorage.removeItem(storageKey);
      if (res?.redirect) router.push(res.redirect);
      else router.refresh();
    } catch {
      toast.error("Could not submit — please try again");
      setSubmitting(false);
    }
  }, [attemptId, finishAction, flushAnswers, router, storageKey]);

  const beginSession = useCallback(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    setStarted(true);
  }, []);

  const restartSession = useCallback(async () => {
    setRestarting(true);
    try {
      await restartModuleAttempt(moduleAttemptId);
      localStorage.removeItem(storageKey);
      init(moduleAttemptId, questions, {}, 0);
      setSecondsLeft(durationMinutes * 60);
      setResumeAvailable(false);
      beginSession();
    } catch {
      toast.error("Could not restart the module");
    } finally {
      setRestarting(false);
    }
  }, [beginSession, durationMinutes, init, moduleAttemptId, questions, storageKey]);

  const leaveSession = useCallback(async () => {
    setExiting(true);
    try {
      await Promise.all([
        flushAnswers(),
        saveModuleProgress({
          moduleAttemptId,
          secondsRemaining: secondsLeftRef.current,
        }),
      ]);
      await document.exitFullscreen?.().catch(() => {});
      router.push(exitHref);
    } catch {
      setExiting(false);
      setExitStep(0);
      toast.error("Could not save your progress. Please try again.");
    }
  }, [exitHref, flushAnswers, moduleAttemptId, router]);

  // Auto-submit when time runs out.
  useEffect(() => {
    if (ready && started && secondsLeft === 0 && !submitting) {
      toast.info("Time's up — submitting your module");
      void submit();
    }
  }, [ready, secondsLeft, started, submitting, submit]);

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

  // ---- Pre-test lock screen: nothing is visible until the student commits ----
  if (!started) {
    const sessionName = heading ? "test" : "module";
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-white px-6 text-center text-[#0f172a]">
        <div className="max-w-md space-y-4">
          {heading ? (
            <>
              <h1 className="text-2xl font-bold">{heading.line1}</h1>
              <p className="text-muted-foreground">{heading.line2}</p>
            </>
          ) : (
            <h1 className="text-2xl font-bold">{section === "MATH" ? "Math" : "Reading & Writing"} module</h1>
          )}
          {resumeAvailable ? (
            <>
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-left text-sm leading-relaxed">
                <p className="font-semibold">Your timed {sessionName} is still in progress.</p>
                <p className="mt-2 text-muted-foreground">
                  Continue with {formatClock(secondsLeft)} remaining and all saved answers, or restart this module from the beginning.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={restartSession}
                  disabled={restarting}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  {restarting ? "Restarting…" : "Restart module"}
                </Button>
                <Button size="lg" onClick={beginSession} disabled={restarting}>
                  Continue where I left off
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl border bg-secondary/40 p-5 text-left text-sm leading-relaxed">
                <p className="font-semibold">Before you start:</p>
                <ul className="mt-2 list-disc space-y-1.5 pl-5">
                  <li>{questions.length} questions · {durationMinutes} minutes. The timer starts the moment you begin.</li>
                  <li>This is meant to be a timed test. Use the three-dot menu if you need to save and exit.</li>
                  <li>You may submit early to move to the next module here — but on the <strong>real Digital SAT you cannot skip modules or breaks</strong>, so practice with the full time.</li>
                </ul>
              </div>
              <Button size="lg" className="w-full" onClick={beginSession}>
                Start test
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex flex-col items-center gap-0.5 text-xs font-medium"
                aria-label="More test options"
              >
                <Ellipsis className="h-5 w-5" />
                More
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onSelect={() => setExitStep(1)}
                className="text-destructive focus:text-destructive"
              >
                <LogOut />
                Save and exit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
              {submitDialogBody ?? "You can't change answers after submitting."}{" "}
              Remember: on the real Digital SAT you can&apos;t skip modules or breaks.
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

      <Dialog open={exitStep === 1} onOpenChange={(open) => setExitStep(open ? 1 : 0)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave this timed test?</DialogTitle>
            <DialogDescription>
              This is meant to be completed under timed conditions. Leaving now will pause the timer and save your answers.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExitStep(0)}>
              Stay in test
            </Button>
            <Button variant="destructive" onClick={() => setExitStep(2)}>
              Continue to exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exitStep === 2} onOpenChange={(open) => setExitStep(open ? 2 : 0)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure you want to leave?</DialogTitle>
            <DialogDescription>
              Your remaining time and answers will be saved. When you return, you can continue from here or restart this module.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExitStep(1)} disabled={exiting}>
              Go back
            </Button>
            <Button variant="destructive" onClick={leaveSession} disabled={exiting}>
              {exiting ? "Saving…" : "Yes, save and exit"}
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
