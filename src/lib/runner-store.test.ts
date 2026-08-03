import { beforeEach, describe, expect, test } from "vitest";
import type { RunnerQuestion } from "@/lib/serialize";
import { useRunner } from "@/lib/runner-store";

const question = (id: string, order: number, stem: string): RunnerQuestion => ({
  id,
  order,
  section: "RW",
  domain: "Information and Ideas",
  skill: "Inferences",
  difficulty: "medium",
  type: "MCQ",
  stem,
  choices: ["A", "B", "C", "D"],
  passage: null,
});

const questions = [question("q1", 1, "One"), question("q2", 2, "Two"), question("q3", 3, "Three")];

beforeEach(() => {
  useRunner.getState().init("module-1", questions, {});
});

describe("runner resume state", () => {
  test("restores the requested question and saved answers", () => {
    useRunner.getState().init(
      "module-1",
      questions,
      { q2: { response: "C", secondsSpent: 14 } },
      1,
    );

    const state = useRunner.getState();
    expect(state.current).toBe(1);
    expect(state.answers.q2.response).toBe("C");
    expect(state.answers.q2.secondsSpent).toBe(14);
  });

  test("clamps an invalid restored question to the module bounds", () => {
    useRunner.getState().init("module-1", questions, {}, 99);
    expect(useRunner.getState().current).toBe(2);
  });

  test("a fresh init clears answers and returns to question one", () => {
    useRunner.getState().setResponse("q1", "A");
    useRunner.getState().init("module-1", questions, {}, 0);

    const state = useRunner.getState();
    expect(state.current).toBe(0);
    expect(state.answers.q1.response).toBeNull();
  });
});
