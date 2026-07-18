"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ThothAvatar } from "@/components/thoth-avatar";
import { Button } from "@/components/ui/button";
import { Stimulus } from "@/components/runner/stimulus";
import { QuestionText } from "@/components/runner/math-text";
import type { WalkthroughScript } from "@/lib/walkthroughs";
import { recordWalkthroughAnswer, completeWalkthrough, startWalkthrough } from "@/app/(app)/walkthroughs/actions";

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
  const [pending, setPending] = useState<string[]>([
    ...script.intro,
    ...script.strategy,
    script.teachIntro,
  ]);
  const [qi, setQi] = useState(0);
  const [activeQ, setActiveQ] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startWalkthrough(skill).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Type out pending Thoth bubbles one at a time.
  useEffect(() => {
    if (pending.length === 0) return;
    const t = setTimeout(() => {
      setMessages((m) => [...m, { from: "thoth", text: pending[0] }]);
      setPending((p) => p.slice(1));
    }, 650);
    return () => clearTimeout(t);
  }, [pending]);

  // Reveal the current question once Thoth finishes talking.
  useEffect(() => {
    if (pending.length === 0 && activeQ === null && !done && qi < questions.length) {
      setActiveQ(qi);
      setSelected(null);
      setAttempt(1);
      setRevealed(false);
    }
  }, [pending, activeQ, qi, done, questions.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, activeQ, revealed]);

  const q = activeQ !== null ? questions[activeQ] : null;
  const isTeach = activeQ !== null && activeQ < teachCount;

  function say(text: string) {
    setMessages((m) => [...m, { from: "thoth", text }]);
  }

  function answer(letter: string) {
    if (!q || revealed) return;
    const correct = letter === q.correctAnswer;
    setSelected(letter);
    setMessages((m) => [...m, { from: "you", text: `I'll go with ${letter}.` }]);

    if (isTeach) {
      // Teach mode: always reveal the reasoning.
      setRevealed(true);
      say(`The answer is ${q.correctAnswer}. ${q.explanation}`);
      return;
    }

    // Solo mode
    if (correct) {
      setRevealed(true);
      const enc = script.encouragements[Math.floor(Math.random() * script.encouragements.length)];
      say(enc ?? "Nice work!");
      void recordWalkthroughAnswer({ skill, questionId: q.id, correct: true, response: letter, isFinalAttempt: true }).catch(() => {});
    } else if (attempt === 1) {
      say(script.retryNudge);
      setSelected(null);
      setAttempt(2);
    } else {
      setRevealed(true);
      say(`${script.explainIntro} ${q.explanation}`);
      void recordWalkthroughAnswer({ skill, questionId: q.id, correct: false, response: letter, isFinalAttempt: true }).catch(() => {});
    }
  }

  function next() {
    const nextIndex = qi + 1;
    setActiveQ(null);
    setRevealed(false);
    if (nextIndex >= questions.length) {
      setDone(true);
      say("That's the walkthrough done — great work! You'll see these question types feel more familiar now. 🎉");
      void completeWalkthrough(skill).catch(() => {});
      return;
    }
    if (nextIndex === teachCount) setPending((p) => [...p, script.soloIntro]);
    setQi(nextIndex);
  }

  const progressPct = Math.round(((done ? questions.length : qi) / questions.length) * 100);

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

          {pending.length > 0 && (
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
          {q && (
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
                      disabled={revealed}
                      onClick={() => answer(letter)}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors",
                        revealed && isCorrect && "border-green-500 bg-green-50",
                        revealed && isChosen && !isCorrect && "border-red-500 bg-red-50",
                        !revealed && "hover:border-primary/50 hover:bg-accent/40",
                      )}
                    >
                      <span className="font-semibold">{letter}.</span>
                      <QuestionText section={q.section}>{choice}</QuestionText>
                    </button>
                  );
                })}
              </div>
              {revealed && (
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={next}>
                    {qi + 1 >= questions.length ? "Finish" : "Next"}
                  </Button>
                </div>
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
