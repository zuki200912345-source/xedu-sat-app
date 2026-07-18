"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { submitSummary } from "@/app/(app)/reading/actions";

const MIN = 50;
const MAX = 100;

export function SummaryForm({ articleId }: { articleId: string }) {
  const router = useRouter();
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);

  const words = useMemo(() => summary.trim().split(/\s+/).filter(Boolean).length, [summary]);
  const tooShort = words < MIN;
  const overTarget = words > MAX;

  async function submit() {
    if (tooShort) return;
    setBusy(true);
    const res = await submitSummary({ articleId, summary });
    if ("error" in res) {
      toast.error(res.error);
      setBusy(false);
      return;
    }
    toast.success("Summary analyzed!");
    router.refresh();
  }

  return (
    <Card>
      <div className="space-y-3 p-6">
        <div className="flex items-center justify-between">
          <Label htmlFor="summary" className="text-base font-semibold">
            Write your summary
          </Label>
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              tooShort ? "text-destructive" : overTarget ? "text-amber-600" : "text-green-600",
            )}
          >
            {words} / {MIN}–{MAX} words
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          In your own words, summarize the article&apos;s main idea and key supporting points.
          Aim for {MIN}–{MAX} words (minimum {MIN}).
        </p>
        <textarea
          id="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={6}
          placeholder="The article explains…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {/* Progress toward the minimum */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full transition-all", tooShort ? "bg-destructive" : "bg-green-500")}
            style={{ width: `${Math.min(100, (words / MIN) * 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {tooShort
              ? `${MIN - words} more word${MIN - words === 1 ? "" : "s"} to go`
              : overTarget
                ? "A bit long — a tight summary scores best, but you can still submit."
                : "Great length!"}
          </span>
          <Button onClick={submit} disabled={busy || tooShort}>
            {busy ? "Analyzing…" : "Submit for AI feedback"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-card shadow-sm">{children}</div>;
}
