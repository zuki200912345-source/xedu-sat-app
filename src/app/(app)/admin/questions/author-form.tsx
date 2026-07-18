"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RW_DOMAINS, MATH_DOMAINS } from "@/lib/enums";
import { createQuestion, checkSimilarity } from "@/app/(app)/admin/actions";

const selectClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const textareaClass = selectClass + " min-h-[80px]";

export function QuestionAuthorForm() {
  const router = useRouter();
  const [section, setSection] = useState<"RW" | "MATH">("RW");
  const [type, setType] = useState<"MCQ" | "SPR">("MCQ");
  const [skill, setSkill] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [stem, setStem] = useState("");
  const [passageText, setPassageText] = useState("");
  const [choices, setChoices] = useState(["", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState("A");
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState(false);
  const [simResult, setSimResult] = useState<string | null>(null);

  const domains = section === "RW" ? RW_DOMAINS : MATH_DOMAINS;
  const skillOptions = Object.entries(domains).flatMap(([domain, list]) =>
    list.map((s: string) => ({ domain, skill: s })),
  );
  const domainForSkill =
    skillOptions.find((s) => s.skill === skill)?.domain ?? Object.keys(domains)[0];

  async function runCheck() {
    setBusy(true);
    const res = await checkSimilarity(`${passageText} ${stem}`);
    setBusy(false);
    setSimResult(
      res.ok
        ? `✓ Passes (${(res.maxOverlap * 100).toFixed(0)}% max overlap)`
        : `✗ Too similar (${(res.maxOverlap * 100).toFixed(0)}% overlap)`,
    );
  }

  async function submit() {
    if (!skill) return toast.error("Pick a skill");
    setBusy(true);
    const res = await createQuestion({
      section,
      domain: domainForSkill,
      skill,
      difficulty: difficulty as "easy" | "medium" | "hard",
      type,
      stem,
      choices: type === "MCQ" ? (choices as string[]) : undefined,
      correctAnswer,
      explanation,
      passageText: passageText || undefined,
      status: "PUBLISHED",
    });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Question published");
    setStem("");
    setPassageText("");
    setChoices(["", "", "", ""]);
    setExplanation("");
    setSimResult(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Author a new question</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Section</Label>
            <select className={selectClass} value={section} onChange={(e) => { setSection(e.target.value as "RW" | "MATH"); setSkill(""); }}>
              <option value="RW">R&amp;W</option>
              <option value="MATH">Math</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as "MCQ" | "SPR")}>
              <option value="MCQ">MCQ</option>
              <option value="SPR">SPR (grid-in)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Skill</Label>
            <select className={selectClass} value={skill} onChange={(e) => setSkill(e.target.value)}>
              <option value="">Select…</option>
              {skillOptions.map((s) => (
                <option key={s.skill} value={s.skill}>{s.skill}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Difficulty</Label>
            <select className={selectClass} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        {section === "RW" && (
          <div className="space-y-1.5">
            <Label>Passage (optional)</Label>
            <textarea className={textareaClass} value={passageText} onChange={(e) => setPassageText(e.target.value)} placeholder="25–150 word original passage" />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Question stem</Label>
          <textarea className={textareaClass} value={stem} onChange={(e) => setStem(e.target.value)} />
        </div>

        {type === "MCQ" ? (
          <div className="space-y-2">
            <Label>Choices (mark the correct one)</Label>
            {["A", "B", "C", "D"].map((letter, i) => (
              <div key={letter} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrectAnswer(letter)}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${correctAnswer === letter ? "border-primary bg-primary text-primary-foreground" : ""}`}
                >
                  {letter}
                </button>
                <Input value={choices[i]} onChange={(e) => setChoices((c) => c.map((v, j) => (j === i ? e.target.value : v)))} />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Correct answer (numeric)</Label>
            <Input value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} placeholder="e.g. 8 or 3/4" className="max-w-xs" />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Explanation</Label>
          <textarea className={textareaClass} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={runCheck} disabled={busy || !stem}>
            Run similarity check
          </Button>
          {simResult && (
            <span className={`text-sm font-medium ${simResult.startsWith("✓") ? "text-green-600" : "text-destructive"}`}>
              {simResult}
            </span>
          )}
          <Button onClick={submit} disabled={busy || !stem || !explanation} className="ml-auto">
            {busy ? "Saving…" : "Publish question"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
