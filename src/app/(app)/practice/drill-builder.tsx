"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RW_DOMAINS, MATH_DOMAINS } from "@/lib/enums";
import { buildDrill } from "@/app/(app)/practice/drill-actions";

const selectClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function DrillBuilder() {
  const router = useRouter();
  const [section, setSection] = useState<"RW" | "MATH">("RW");
  const [skill, setSkill] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);

  const skills = useMemo(() => {
    const domains = section === "RW" ? RW_DOMAINS : MATH_DOMAINS;
    return Object.entries(domains).flatMap(([domain, list]) =>
      list.map((s: string) => ({ domain, skill: s })),
    );
  }, [section]);

  async function start() {
    setBusy(true);
    const res = await buildDrill({ section, skill: skill || undefined, difficulty, count });
    if ("error" in res) {
      toast.error(res.error);
      setBusy(false);
      return;
    }
    router.push(`/session/${res.testId}`);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="section">Section</Label>
          <select
            id="section"
            className={selectClass}
            value={section}
            onChange={(e) => {
              setSection(e.target.value as "RW" | "MATH");
              setSkill("");
            }}
          >
            <option value="RW">Reading &amp; Writing</option>
            <option value="MATH">Math</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="skill">Skill</Label>
          <select id="skill" className={selectClass} value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option value="">Any skill in section</option>
            {skills.map(({ domain, skill: s }) => (
              <option key={s} value={s}>
                {domain} — {s}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="difficulty">Difficulty</Label>
          <select
            id="difficulty"
            className={selectClass}
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
          >
            <option value="mixed">Mixed</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="count">Number of questions</Label>
          <select
            id="count"
            className={selectClass}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            {[5, 10, 15, 20, 25, 30].map((n) => (
              <option key={n} value={n}>
                {n} questions
              </option>
            ))}
          </select>
        </div>
      </div>

      <Button onClick={start} disabled={busy}>
        {busy ? "Building…" : "Build drill"}
      </Button>
    </div>
  );
}
