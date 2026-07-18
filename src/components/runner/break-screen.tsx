"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SAT_CONFIG } from "@/lib/config";
import { continueFromBreak } from "@/app/(app)/tests/actions";

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function BreakScreen({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(SAT_CONFIG.breakMinutes * 60);
  const [continuing, setContinuing] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  async function proceed() {
    setContinuing(true);
    await continueFromBreak(attemptId);
    router.refresh();
  }

  // Auto-continue when the break time elapses.
  useEffect(() => {
    if (secondsLeft === 0 && !continuing) void proceed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-secondary/40 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Coffee className="h-8 w-8" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Section break</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          You&apos;ve finished the Reading &amp; Writing section. Take a short break —
          the Math section begins when you&apos;re ready or when the timer ends.
        </p>
      </div>
      <div className="font-mono text-5xl tabular-nums" aria-live="off">
        {fmt(secondsLeft)}
      </div>
      <Button size="lg" onClick={proceed} disabled={continuing}>
        {continuing ? "Starting Math…" : "Start Math section now"}
      </Button>
    </div>
  );
}
