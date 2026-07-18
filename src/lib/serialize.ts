import type { Question, Passage } from "@prisma/client";

/**
 * The safe, student-facing shape of a question DURING a test: the correct
 * answer and explanation are omitted so they never reach the client until the
 * attempt is graded. Never send raw Question rows to the runner.
 */
export interface RunnerQuestion {
  id: string;
  order: number;
  section: string;
  domain: string;
  skill: string;
  difficulty: string;
  type: string;
  stem: string;
  choices: string[] | null;
  passage: {
    content: string;
    graphSpec: unknown | null;
  } | null;
}

export function toRunnerQuestion(
  q: Question & { passage: Passage | null },
  order: number,
): RunnerQuestion {
  return {
    id: q.id,
    order,
    section: q.section,
    domain: q.domain,
    skill: q.skill,
    difficulty: q.difficulty,
    type: q.type,
    stem: q.stem,
    choices: q.choices ? (JSON.parse(q.choices) as string[]) : null,
    passage: q.passage
      ? {
          content: q.passage.content,
          graphSpec: q.passage.graphSpec ? JSON.parse(q.passage.graphSpec) : null,
        }
      : null,
  };
}

/** Full review shape (post-grading): includes correct answer + explanation. */
export interface ReviewQuestion extends RunnerQuestion {
  correctAnswer: string;
  explanation: string;
  response: string | null;
  isCorrect: boolean | null;
  secondsSpent: number;
  flagged: boolean;
}
