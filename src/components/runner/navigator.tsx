"use client";

import { cn } from "@/lib/utils";
import { useRunner } from "@/lib/runner-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function Navigator({ children }: { children: React.ReactNode }) {
  const questions = useRunner((s) => s.questions);
  const answers = useRunner((s) => s.answers);
  const current = useRunner((s) => s.current);
  const goTo = useRunner((s) => s.goTo);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Question navigator</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2 pt-2" role="grid" aria-label="Questions">
          {questions.map((q, i) => {
            const a = answers[q.id];
            const answered = a?.response != null && a.response !== "";
            const flagged = a?.flagged;
            return (
              <DialogTrigger asChild key={q.id}>
                <button
                  onClick={() => goTo(i)}
                  aria-current={i === current ? "true" : undefined}
                  aria-label={`Question ${i + 1}${answered ? ", answered" : ", not answered"}${
                    flagged ? ", flagged" : ""
                  }`}
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-md border text-sm font-medium transition-colors",
                    i === current && "ring-2 ring-primary ring-offset-1",
                    // Flagged wins: the whole tile goes red so it can't be missed.
                    flagged
                      ? "border-red-500 bg-red-500 text-white hover:bg-red-600"
                      : answered
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-accent",
                  )}
                >
                  {i + 1}
                </button>
              </DialogTrigger>
            );
          })}
        </div>
        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-primary" /> Answered
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-dashed border-muted-foreground/40" />{" "}
            Unanswered
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-red-500" /> Flagged
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
