import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NotebookView, type ActiveEntry, type ConqueredEntry } from "./notebook-view";

export const metadata: Metadata = { title: "Mistake notebook" };

export default async function NotebookPage() {
  const session = await auth();
  const userId = session!.user.id;

  const entries = await prisma.mistakeEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { question: { include: { passage: true } } },
  });

  const active: ActiveEntry[] = entries
    .filter((e) => !e.resolved)
    .map((e) => ({
      // Correct answer + explanation are intentionally omitted here so the
      // re-attempt is honest; the server returns them after an attempt.
      id: e.question.id,
      skill: e.question.skill,
      section: e.question.section,
      type: e.question.type,
      stem: e.question.stem,
      choices: e.question.choices ? (JSON.parse(e.question.choices) as string[]) : null,
      passage: e.question.passage
        ? { content: e.question.passage.content, graphSpec: e.question.passage.graphSpec ? JSON.parse(e.question.passage.graphSpec) : null }
        : null,
      source: e.source,
      userResponse: e.userResponse,
    }));

  const conquered: ConqueredEntry[] = entries
    .filter((e) => e.resolved)
    .map((e) => ({
      id: e.question.id,
      skill: e.question.skill,
      section: e.question.section,
      stem: e.question.stem,
      choices: e.question.choices ? (JSON.parse(e.question.choices) as string[]) : null,
      correctAnswer: e.question.correctAnswer,
      explanation: e.question.explanation,
    }));

  return <NotebookView active={active} conquered={conquered} />;
}
