import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toRunnerQuestion } from "@/lib/serialize";
import { SAT_CONFIG } from "@/lib/config";
import { startPracticeAttempt, finishPracticeAttempt } from "@/app/(app)/practice/actions";
import { ModuleRunner } from "@/components/runner/module-runner";
import type { AnswerState } from "@/lib/runner-store";

export default async function RunModulePage({
  params,
}: {
  params: { testId: string };
}) {
  await requireUser();

  const test = await prisma.test.findUnique({
    where: { id: params.testId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: { question: { include: { passage: true } } },
          },
        },
      },
    },
  });
  if (!test || !test.isPublished || test.modules.length === 0) notFound();

  const mod = test.modules[0];
  const { attemptId, moduleAttemptId } = await startPracticeAttempt(test.id);

  // Load any previously saved answers for resume.
  const [savedRows, moduleAttempt] = await Promise.all([
    prisma.answer.findMany({ where: { moduleAttemptId } }),
    prisma.moduleAttempt.findUniqueOrThrow({ where: { id: moduleAttemptId } }),
  ]);
  const saved: Record<string, Partial<AnswerState>> = {};
  for (const row of savedRows) {
    saved[row.questionId] = {
      response: row.response,
      flagged: row.flagged,
      secondsSpent: row.secondsSpent,
      eliminated: row.eliminated ? (JSON.parse(row.eliminated) as string[]) : [],
    };
  }

  const questions = mod.questions.map((mq, i) => toRunnerQuestion(mq.question, i + 1));
  const durationMinutes =
    mod.section === "MATH"
      ? SAT_CONFIG.math.minutesPerModule
      : SAT_CONFIG.rw.minutesPerModule;
  const lastActiveQuestion = Math.max(
    0,
    ...questions.map((question, index) =>
      (saved[question.id]?.secondsSpent ?? 0) > 0 || saved[question.id]?.response ? index : 0,
    ),
  );

  return (
    <ModuleRunner
      moduleAttemptId={moduleAttemptId}
      attemptId={attemptId}
      section={mod.section}
      durationMinutes={durationMinutes}
      questions={questions}
      saved={saved}
      hasSavedProgress={moduleAttempt.secondsRemaining !== null || savedRows.length > 0}
      initialSecondsLeft={moduleAttempt.secondsRemaining}
      initialQuestionIndex={lastActiveQuestion}
      exitHref="/practice"
      finishAction={finishPracticeAttempt}
      submitLabel="Review & submit"
    />
  );
}
