import { Check, Clock, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Stimulus } from "@/components/runner/stimulus";
import { QuestionText } from "@/components/runner/math-text";
import { isResponseCorrect } from "@/lib/scoring";

const LETTERS = ["A", "B", "C", "D"];

export interface ReviewItem {
  id: string;
  index: number;
  section: string;
  domain: string;
  skill: string;
  difficulty: string;
  type: string;
  stem: string;
  choices: string[] | null;
  correctAnswer: string;
  explanation: string;
  passage: { content: string; graphSpec: unknown | null } | null;
  response: string | null;
  secondsSpent: number;
}

export function QuestionReview({ item }: { item: ReviewItem }) {
  const answered = item.response != null && item.response !== "";
  const isCorrect = isResponseCorrect(item.type, item.correctAnswer, item.response);

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-sm font-bold text-background">
            {item.index}
          </span>
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              !answered
                ? "bg-muted text-muted-foreground"
                : isCorrect
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700",
            )}
          >
            {!answered ? (
              <>
                <Minus className="h-3 w-3" /> Skipped
              </>
            ) : isCorrect ? (
              <>
                <Check className="h-3 w-3" /> Correct
              </>
            ) : (
              <>
                <X className="h-3 w-3" /> Incorrect
              </>
            )}
          </span>
          <Badge variant="outline">{item.domain}</Badge>
          <Badge variant="secondary">{item.skill}</Badge>
          <Badge variant="outline" className="capitalize">
            {item.difficulty}
          </Badge>
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {item.secondsSpent}s
          </span>
        </div>

        {item.passage && (
          <div className="mb-4 rounded-lg bg-muted/50 p-4">
            <Stimulus content={item.passage.content} graphSpec={item.passage.graphSpec} />
          </div>
        )}

        <p className="mb-3 font-medium">
          <QuestionText section={item.section}>{item.stem}</QuestionText>
        </p>

        {item.choices ? (
          <ul className="space-y-2">
            {item.choices.map((choice, ci) => {
              const letter = LETTERS[ci];
              const isKey = letter === item.correctAnswer;
              const isChosen = letter === item.response;
              return (
                <li
                  key={letter}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-2.5 text-sm",
                    isKey && "border-green-500 bg-green-50",
                    isChosen && !isKey && "border-red-500 bg-red-50",
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                    {letter}
                  </span>
                  <span className="flex-1">
                    <QuestionText section={item.section}>{choice}</QuestionText>
                  </span>
                  {isKey && <Badge className="bg-green-600 hover:bg-green-600">Correct</Badge>}
                  {isChosen && !isKey && <Badge variant="destructive">Your answer</Badge>}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="rounded-lg border border-green-500 bg-green-50 px-3 py-2">
              <div className="text-xs text-muted-foreground">Correct answer</div>
              <div className="font-mono font-semibold">{item.correctAnswer.split("|")[0]}</div>
            </div>
            <div
              className={cn(
                "rounded-lg border px-3 py-2",
                isCorrect ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50",
              )}
            >
              <div className="text-xs text-muted-foreground">Your answer</div>
              <div className="font-mono font-semibold">{answered ? item.response : "—"}</div>
            </div>
          </div>
        )}

        <div className="mt-4 rounded-lg bg-accent/50 p-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
            Explanation
          </div>
          <p className="text-sm leading-relaxed">{item.explanation}</p>
        </div>
      </CardContent>
    </Card>
  );
}
