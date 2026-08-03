import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toRunnerQuestion } from "@/lib/serialize";
import { SAT_CONFIG } from "@/lib/config";
import { resolveTestPhase } from "@/lib/full-test";
import type { AnswerState } from "@/lib/runner-store";
import { ModuleRunner } from "@/components/runner/module-runner";
import { BreakScreen } from "@/components/runner/break-screen";
import { submitFullModule } from "@/app/(app)/tests/actions";

export default async function TakeTestPage({
  params,
}: {
  params: { attemptId: string };
}) {
  const user = await requireUser();

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: params.attemptId },
    include: {
      test: true,
      moduleAttempts: { include: { module: true } },
    },
  });
  if (!attempt || attempt.userId !== user.id) notFound();

  const phase = resolveTestPhase({
    status: attempt.status,
    moduleAttempts: attempt.moduleAttempts.map((ma) => ({
      id: ma.id,
      moduleId: ma.moduleId,
      rawCorrect: ma.rawCorrect,
      completedAt: ma.completedAt,
      module: ma.module,
    })),
  });

  if (phase.kind === "DONE") redirect(`/tests/report/${attempt.id}`);
  if (phase.kind === "BREAK") return <BreakScreen attemptId={attempt.id} />;

  // phase.kind === "MODULE"
  const activeMa = phase.moduleAttempt;
  const mod = await prisma.module.findUniqueOrThrow({
    where: { id: activeMa.moduleId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { question: { include: { passage: true } } },
      },
    },
  });

  const savedRows = await prisma.answer.findMany({ where: { moduleAttemptId: activeMa.id } });
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
    mod.section === "MATH" ? SAT_CONFIG.math.minutesPerModule : SAT_CONFIG.rw.minutesPerModule;
  const isLastModule = mod.section === "MATH" && mod.order === 2;
  // Section 1 = Reading & Writing, Section 2 = Math (Bluebook ordering).
  const sectionNumber = mod.section === "MATH" ? 2 : 1;
  const activeModuleAttempt = attempt.moduleAttempts.find((ma) => ma.id === activeMa.id)!;
  const lastActiveQuestion = Math.max(
    0,
    ...questions.map((question, index) =>
      (saved[question.id]?.secondsSpent ?? 0) > 0 || saved[question.id]?.response ? index : 0,
    ),
  );

  return (
    <ModuleRunner
      key={activeMa.id}
      moduleAttemptId={activeMa.id}
      attemptId={attempt.id}
      heading={{
        line1: `Section ${sectionNumber}, Module ${mod.order}:`,
        line2: mod.section === "MATH" ? "Math" : "Reading and Writing",
      }}
      section={mod.section}
      durationMinutes={durationMinutes}
      questions={questions}
      saved={saved}
      hasSavedProgress={activeModuleAttempt.secondsRemaining !== null || savedRows.length > 0}
      initialSecondsLeft={activeModuleAttempt.secondsRemaining}
      initialQuestionIndex={lastActiveQuestion}
      exitHref="/tests"
      finishAction={submitFullModule}
      submitLabel="Submit module"
      submitDialogTitle={
        mod.order === 1
          ? "Submit Module 1?"
          : isLastModule
            ? "Finish the test?"
            : "Submit this module?"
      }
      submitDialogBody={
        mod.order === 1
          ? "Your Module 1 score decides whether Module 2 is the Easy or Hard form."
          : isLastModule
            ? "This is the last module. Submitting will calculate your scaled score."
            : undefined
      }
    />
  );
}
