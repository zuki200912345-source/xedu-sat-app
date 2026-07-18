import { CheckCircle2, Lightbulb, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SummaryFeedback } from "@/lib/summary-analysis";

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-lime-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

export function FeedbackPanel({
  summary,
  wordCount,
  feedback,
}: {
  summary: string;
  wordCount: number;
  feedback: SummaryFeedback;
}) {
  return (
    <div className="space-y-4">
      {/* Your summary */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Your summary</CardTitle>
            <Badge variant="secondary">{wordCount} words</Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">{summary}</CardContent>
      </Card>

      {/* Score */}
      <Card className="border-primary/40 bg-accent/40">
        <CardContent className="flex items-center justify-between py-6">
          <div>
            <div className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Comprehension score
            </div>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{feedback.overall}</p>
          </div>
          <div className={`text-5xl font-bold ${scoreColor(feedback.score)}`}>{feedback.score}</div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Understood */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-green-600" /> What you understood
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {feedback.understood.length ? (
                feedback.understood.map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                    <span>{p}</span>
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground">No clear points identified.</li>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Missed */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-5 w-5 text-amber-500" /> What you may have missed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {feedback.missed.length ? (
                feedback.missed.map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>{p}</span>
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground">You covered the key points well.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        Feedback by {feedback.provider === "deepseek" ? "AI comprehension coach" : "comprehension analysis"}
      </p>
    </div>
  );
}
