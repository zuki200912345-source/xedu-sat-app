import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getScript } from "@/lib/walkthroughs";
import { WalkthroughChat, type WalkQuestion } from "./walkthrough-chat";

export default async function WalkthroughFlowPage({
  params,
}: {
  params: { skill: string };
}) {
  await requireUser();
  const skill = decodeURIComponent(params.skill);
  const script = getScript(skill);
  if (!script) notFound();

  // Draw up to 5 questions for this skill, easiest → hardest. MCQ only — the
  // chat teaches through answer choices, and a grid-in (SPR) would leave the
  // student with nothing to click.
  const rows = await prisma.question.findMany({
    where: { skill, status: "PUBLISHED", type: "MCQ" },
    orderBy: { difficultyValue: "asc" },
    take: 5,
    include: { passage: true },
  });
  if (rows.length === 0) notFound();

  const questions: WalkQuestion[] = rows.map((q) => ({
    id: q.id,
    section: q.section,
    type: q.type,
    stem: q.stem,
    choices: q.choices ? (JSON.parse(q.choices) as string[]) : null,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    passage: q.passage
      ? { content: q.passage.content, graphSpec: q.passage.graphSpec ? JSON.parse(q.passage.graphSpec) : null }
      : null,
  }));

  return <WalkthroughChat skill={skill} script={script} questions={questions} />;
}
