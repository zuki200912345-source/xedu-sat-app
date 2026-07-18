// Pure state-machine helpers for the full adaptive test flow. No DB access —
// callers pass in the loaded attempt so this stays testable and shared between
// the runner page (read) and the server actions (mutate).

export const SECTION_ORDER = ["RW", "MATH"] as const;

export interface LoadedModule {
  id: string;
  section: string;
  order: number;
  path: string;
}
export interface LoadedModuleAttempt {
  id: string;
  moduleId: string;
  rawCorrect: number | null;
  completedAt: Date | null;
  module: LoadedModule;
}
export interface LoadedAttempt {
  status: string; // IN_PROGRESS | BREAK | COMPLETED | ABANDONED
  moduleAttempts: LoadedModuleAttempt[];
}

export type TestPhase =
  | { kind: "MODULE"; moduleAttempt: LoadedModuleAttempt }
  | { kind: "BREAK" }
  | { kind: "DONE" };

/** The single in-flight (not-yet-completed) module attempt, if any. */
export function activeModuleAttempt(attempt: LoadedAttempt): LoadedModuleAttempt | null {
  return attempt.moduleAttempts.find((ma) => ma.completedAt === null) ?? null;
}

/** Resolve what the runner page should show right now. */
export function resolveTestPhase(attempt: LoadedAttempt): TestPhase {
  if (attempt.status === "COMPLETED") return { kind: "DONE" };
  const active = activeModuleAttempt(attempt);
  if (active) return { kind: "MODULE", moduleAttempt: active };
  if (attempt.status === "BREAK") return { kind: "BREAK" };
  // No active module and not on break/completed — treated as done (defensive).
  return { kind: "DONE" };
}

/** A completed module attempt for a given section + order, if it exists. */
export function completedModule(
  attempt: LoadedAttempt,
  section: string,
  order: number,
): LoadedModuleAttempt | undefined {
  return attempt.moduleAttempts.find(
    (ma) =>
      ma.module.section === section &&
      ma.module.order === order &&
      ma.completedAt !== null,
  );
}

/** Overall progress label, e.g. "Reading & Writing · Module 1 of 2". */
export function moduleLabel(section: string, order: number): string {
  const name = section === "MATH" ? "Math" : "Reading & Writing";
  return `${name} · Module ${order} of 2`;
}
