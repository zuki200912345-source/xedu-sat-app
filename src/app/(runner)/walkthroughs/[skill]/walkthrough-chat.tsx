"use client";

/**
 * Thoth guided walkthrough — USER-PACED chat.
 *
 * Every Thoth bubble is gated behind the student pressing "Next": nothing
 * auto-plays. The first questions are TEACH mode — Thoth solves the exact
 * question step by step (DeepSeek-generated for THIS question, with the
 * stored explanation as fallback). The remaining questions are SOLO — a
 * wrong answer earns a retry nudge, and a second miss gets a
 * question-specific breakdown of the student's actual mistake.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ThothAvatar } from "@/components/thoth-avatar";
import { Button } from "@/components/ui/button";
import { Stimulus } from "@/components/runner/stimulus";
import { QuestionText } from "@/components/runner/math-text";
import type { WalkthroughScript } from "@/lib/walkthroughs";
import {
  recordWalkthroughAnswer, completeWalkthrough, startWalkthrough, thothTeachQuestion,
} from "@/app/(app)/walkthroughs/actions";

export interface WalkQuestion {
  id: string;
  section: string;
  type: string;
  stem: string;
  choices: string[] | null;
  correctAnswer: string;
  explanation: string;
  passage: { content: string; graphSpec: unknown | null } | null;
}

type Msg = { from: "thoth" | "you"; text: string };
/** What pressing Next does when the bubble queue is empty. */
type Stage =
  | "show-question"   // reveal the current question card
  | "teach-steps"     // fetch DeepSeek steps for this question (teach mode)
  | "teach-reveal"    // highlight the key after the steps
  | "advance"         // move to the next question (or finish)
  | "await-answer"    // solo: waiting on a choice click (no Next button)
  | "done";
const LETTERS = ["A", "B", "C", "D"];

export function WalkthroughChat({
  skill,
  script,
  questions,
}: {
  skill: string;
  script: WalkthroughScript;
  questions: WalkQuestion[];
}) {
  const teachCount = Math.min(2, Math.max(1, questions.length - 1));

  const [messages, setMessages] = useState<Msg[]>([]);
  const [queue, setQueue] = useState<string[]>([...script.intro, ...script.strategy, script.teachIntro]);
  const [stage, setStage] = useState<Stage>("show-question");
  const [qi, setQi] = useState(0);
  const [showQ, setShowQ] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [revealed, setRevealed] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startWalkthrough(skill).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, showQ, revealed, thinking, done]);

  const q = questions[qi] ?? null;
  const isTeach = qi < teachCount;

  function say(text: string) {
    setMessages((m) => [...m, { from: "thoth", text }]);
  }

  /** The single pacing control: reveal one bubble, or run the queued stage. */
  async function next() {
    if (thinking) return;
    // 1) Bubbles first, one per press.
    if (queue.length > 0) {
      const [head, ...rest] = queue;
      say(head);
      setQueue(rest);
      return;
    }
    // 2) Queue empty → act on the stage.
    if (stage === "show-question") {
      setShowQ(true);
      setSelected(null);
      setAttempt(1);
      setRevealed(false);
      setStage(isTeach ? "teach-steps" : "await-answer");
      return;
    }
    if (stage === "teach-steps" && q) {
      setThinking(true);
      try {
        const { steps } = await thothTeachQuestion({ questionId: q.id, mode: "teach" });
        setQueue(steps);
        setStage("teach-reveal");
      } finally {
        setThinking(false);
      }
      return;
    }
    if (stage === "teach-reveal") {
      setRevealed(true);
      setStage("advance");
      return;
    }
    if (stage === "advance") {
      advance();
      return;
    }
  }

  function advance() {
    const nextIndex = qi + 1;
    setShowQ(false);
    setRevealed(false);
    if (nextIndex >= questions.length) {
      setDone(true);
      setStage("done");
      say("That's the walkthrough done — great work! These question types should feel much more familiar now. 🎉");
      void completeWalkthrough(skill).catch(() => {});
      return;
    }
    if (nextIndex === teachCount) setQueue((p) => [...p, script.soloIntro]);
    setQi(nextIndex);
    setStage("show-question");
  }

  /** Solo-mode answer click. */
  async function answer(letter: string) {
    if (!q || revealed || isTeach || thinking) return;
    const correct = letter === q.correctAnswer;
    setSelected(letter);
    setMessages((m) => [...m, { from: "you", text: `I'll go with ${letter}.` }]);

    if (correct) {
      setRevealed(true);
      const enc = script.encouragements[Math.floor(Math.random() * script.encouragements.length)];
      say(enc ?? "Nice work!");
      setStage("advance");
      void recordWalkthroughAnswer({ skill, questionId: q.id, correct: true, response: letter, isFinalAttempt: true }).catch(() => {});
      return;
    }
    if (attempt === 1) {
      say(script.retryNudge);
      setSelected(null);
      setAttempt(2);
      return;
    }
    // Second miss → Thoth breaks down THIS mistake, step by step, Next-paced.
    setRevealed(true);
    setThinking(true);
    try {
      const { steps } = await thothTeachQuestion({ questionId: q.id, mode: "mistake", chosen: letter });
      setQueue([script.explainIntro, ...steps]);
      setStage("advance");
    } finally {
      setThinking(false);
    }
    void recordWalkthroughAnswer({ skill, questionId: q.id, correct: false, response: letter, isFinalAttempt: true }).catch(() => {});
  }

  const progressPct = Math.round(((done ? questions.length : qi) / questions.length) * 100);
  // The Next button shows whenever a press would do something.
  const showNext =
    !done && !thinking && (queue.length > 0 || stage === "show-question" || stage === "teach-steps" || stage === "teach-reveal" || stage === "advance");
  const nextLabel =
    queue.length > 0 ? "Next" :
    stage === "show-question" ? (qi === 0 ? "Show me the first question" : "Show me the next question") :
    stage === "teach-steps" ? "Walk me through it" :
    stage === "teach-reveal" ? "Reveal the answer" :
    stage === "advance" ? (qi + 1 >= questions.length ? "Finish" : "Next question") : "Next";

  return (
    <div className="flex h-screen flex-col bg-secondary/40">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <ThothAvatar className="h-9 w-9" />
          <div>
            <div className="text-sm font-semibold leading-tight">Thoth · {skill}</div>
            <div className="text-xs text-muted-foreground">Guided walkthrough</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/walkthroughs">Exit</Link>
        </Button>
      </header>
      <div className="h-1 bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Chat log */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-2.5", m.from === "you" && "flex-row-reverse")}>
              {m.from === "thoth" && <ThothAvatar className="h-8 w-8 shrink-0" />}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                  m.from === "thoth"
                    ? "rounded-tl-sm bg-background shadow-sm"
                    : "rounded-tr-sm bg-primary text-primary-foreground",
                )}
              >
                <QuestionText section={q?.section ?? "RW"}>{m.text}</QuestionText>
              </div>
            </div>
          ))}

          {thinking && (
            <div className="flex gap-2.5">
              <ThothAvatar className="h-8 w-8 shrink-0" />
              <div className="rounded-2xl rounded-tl-sm bg-background px-4 py-3 shadow-sm">
                <span className="flex gap-1">
                  <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
                </span>
              </div>
            </div>
          )}

          {/* Active question card */}
          {showQ && q && (
            <div className="rounded-2xl border bg-background p-4 shadow-sm">
              {q.passage && (
                <div className="mb-3 rounded-lg bg-muted/50 p-3 text-sm">
                  <Stimulus content={q.passage.content} graphSpec={q.passage.graphSpec} />
                </div>
              )}
              <p className="mb-3 font-medium">
                <QuestionText section={q.section}>{q.stem}</QuestionText>
              </p>
              <div className="space-y-2">
                {q.choices?.map((choice, idx) => {
                  const letter = LETTERS[idx];
                  const isCorrect = letter === q.correctAnswer;
                  const isChosen = letter === selected;
                  return (
                    <button
                      key={letter}
                      disabled={revealed || isTeach || thinking}
                      onClick={() => void answer(letter)}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors",
                        revealed && isCorrect && "border-green-500 bg-green-50",
                        revealed && isChosen && !isCorrect && "border-red-500 bg-red-50",
                        !revealed && !isTeach && "hover:border-primary/50 hover:bg-accent/40",
                        isTeach && !revealed && "opacity-80",
                      )}
                    >
                      <span className="font-semibold">{letter}.</span>
                      <QuestionText section={q.section}>{choice}</QuestionText>
                    </button>
                  );
                })}
              </div>
              {isTeach && !revealed && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Teach mode — Thoth walks this one; you take over on the solo questions.
                </p>
              )}
            </div>
          )}

          {done && (
            <div className="rounded-2xl border border-green-300 bg-green-50/50 p-5 text-center">
              <p className="font-semibold">Walkthrough complete 🎉</p>
              <div className="mt-3 flex justify-center gap-2">
                <Button variant="outline" asChild>
                  <Link href="/walkthroughs">More walkthroughs</Link>
                </Button>
                <Button asChild>
                  <Link href="/practice">Practice this skill</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pacing control — the student drives every step */}
      {showNext && (
        <footer className="border-t bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl justify-end">
            <Button onClick={() => void next()}>{nextLabel}</Button>
          </div>
        </footer>
      )}
    </div>
  );
}

function Dot({ delay }: { delay?: string }) {
  return (
    <span
      className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40"
      style={{ animationDelay: delay }}
    />
  );
}
