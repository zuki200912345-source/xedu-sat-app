import { create } from "zustand";
import type { RunnerQuestion } from "@/lib/serialize";

export interface AnswerState {
  response: string | null;
  flagged: boolean;
  eliminated: string[]; // choice letters struck through
  secondsSpent: number;
}

interface RunnerState {
  moduleAttemptId: string | null;
  questions: RunnerQuestion[];
  current: number; // index
  answers: Record<string, AnswerState>;
  timerHidden: boolean;
  // dirty question ids awaiting autosave flush
  dirty: Set<string>;

  init: (
    moduleAttemptId: string,
    questions: RunnerQuestion[],
    saved: Record<string, Partial<AnswerState>>,
  ) => void;
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
  setResponse: (questionId: string, response: string | null) => void;
  toggleFlag: (questionId: string) => void;
  toggleEliminated: (questionId: string, letter: string) => void;
  tick: (questionId: string) => void;
  toggleTimer: () => void;
  markClean: (questionId: string) => void;
}

const blank = (): AnswerState => ({
  response: null,
  flagged: false,
  eliminated: [],
  secondsSpent: 0,
});

export const useRunner = create<RunnerState>((set, get) => ({
  moduleAttemptId: null,
  questions: [],
  current: 0,
  answers: {},
  timerHidden: false,
  dirty: new Set(),

  init: (moduleAttemptId, questions, saved) => {
    const answers: Record<string, AnswerState> = {};
    for (const q of questions) {
      answers[q.id] = { ...blank(), ...(saved[q.id] ?? {}) };
    }
    set({ moduleAttemptId, questions, answers, current: 0, dirty: new Set() });
  },

  goTo: (index) =>
    set((s) => ({ current: Math.max(0, Math.min(index, s.questions.length - 1)) })),
  next: () => get().goTo(get().current + 1),
  prev: () => get().goTo(get().current - 1),

  setResponse: (questionId, response) =>
    set((s) => {
      const a = s.answers[questionId] ?? blank();
      const dirty = new Set(s.dirty).add(questionId);
      return { answers: { ...s.answers, [questionId]: { ...a, response } }, dirty };
    }),

  toggleFlag: (questionId) =>
    set((s) => {
      const a = s.answers[questionId] ?? blank();
      const dirty = new Set(s.dirty).add(questionId);
      return {
        answers: { ...s.answers, [questionId]: { ...a, flagged: !a.flagged } },
        dirty,
      };
    }),

  toggleEliminated: (questionId, letter) =>
    set((s) => {
      const a = s.answers[questionId] ?? blank();
      const eliminated = a.eliminated.includes(letter)
        ? a.eliminated.filter((l) => l !== letter)
        : [...a.eliminated, letter];
      const dirty = new Set(s.dirty).add(questionId);
      return { answers: { ...s.answers, [questionId]: { ...a, eliminated } }, dirty };
    }),

  tick: (questionId) =>
    set((s) => {
      const a = s.answers[questionId] ?? blank();
      return {
        answers: {
          ...s.answers,
          [questionId]: { ...a, secondsSpent: a.secondsSpent + 1 },
        },
      };
    }),

  toggleTimer: () => set((s) => ({ timerHidden: !s.timerHidden })),

  markClean: (questionId) =>
    set((s) => {
      const dirty = new Set(s.dirty);
      dirty.delete(questionId);
      return { dirty };
    }),
}));
