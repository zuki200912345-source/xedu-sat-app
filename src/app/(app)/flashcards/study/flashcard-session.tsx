"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { gradeCard } from "@/app/(app)/flashcards/actions";
import type { Grade } from "@/lib/sm2";

export interface StudyCard {
  id: string;
  word: string;
  partOfSpeech: string;
  definition: string;
  example: string;
}

const GRADES: { grade: Grade; label: string; className: string }[] = [
  { grade: "AGAIN", label: "Again", className: "bg-red-100 text-red-700 hover:bg-red-200" },
  { grade: "HARD", label: "Hard", className: "bg-amber-100 text-amber-700 hover:bg-amber-200" },
  { grade: "GOOD", label: "Good", className: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
  { grade: "EASY", label: "Easy", className: "bg-green-100 text-green-700 hover:bg-green-200" },
];

export function FlashcardSession({ cards }: { cards: StudyCard[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [busy, setBusy] = useState(false);

  const card = cards[index];

  async function grade(g: Grade) {
    if (busy) return;
    setBusy(true);
    await gradeCard({ wordId: card.id, grade: g }).catch(() => {});
    setReviewed((r) => r + 1);
    setBusy(false);
    if (index + 1 >= cards.length) {
      setDone(true);
      router.refresh();
    } else {
      setIndex((i) => i + 1);
      setFlipped(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Check className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Session complete!</h1>
          <p className="mt-2 text-muted-foreground">
            You reviewed {reviewed} card{reviewed === 1 ? "" : "s"}. Nicely done.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/flashcards">Back to flashcards</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 py-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <Link href="/flashcards" className="hover:text-foreground">
          ← Exit
        </Link>
        <span>
          {index + 1} / {cards.length}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(index / cards.length) * 100}%` }}
        />
      </div>

      <Card
        className="min-h-[280px] cursor-pointer select-none"
        onClick={() => setFlipped((f) => !f)}
      >
        <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-8 text-center">
          {!flipped ? (
            <>
              <Badge variant="secondary">{card.partOfSpeech}</Badge>
              <div className="text-4xl font-bold">{card.word}</div>
              <p className="text-sm text-muted-foreground">Tap to reveal the definition</p>
            </>
          ) : (
            <>
              <div className="text-xl font-semibold text-primary">{card.word}</div>
              <p className="text-lg">{card.definition}</p>
              <p className="text-sm italic text-muted-foreground">&ldquo;{card.example}&rdquo;</p>
            </>
          )}
        </CardContent>
      </Card>

      {flipped ? (
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map(({ grade: g, label, className }) => (
            <button
              key={g}
              disabled={busy}
              onClick={() => grade(g)}
              className={`rounded-lg py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${className}`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <Button className="w-full" onClick={() => setFlipped(true)}>
          Show answer
        </Button>
      )}
    </div>
  );
}
