export interface SeedQuestion {
  section: "RW" | "MATH";
  domain: string;
  skill: string;
  /** Fine-grained subtopic within the skill (e.g. "percent_change"). Metadata
   *  for browsing/analytics; the adaptive engine still buckets by spec subtype. */
  subtopic?: string;
  difficulty: "easy" | "medium" | "hard";
  /** Optional explicit continuous difficulty (1.0–3.0). When set, overrides the
   *  deterministic band value — used to pin "challenge" items near 3.0. */
  difficultyValue?: number;
  type: "MCQ" | "SPR";
  /** Short passage (25–150 words) shown left of the question (R&W). */
  passageText?: string;
  /** JSON spec for a quantitative stimulus rendered with the passage. */
  graphSpec?: {
    type: "table";
    title: string;
    headers: string[];
    rows: (string | number)[][];
  };
  stem: string;
  choices?: [string, string, string, string];
  /** MCQ: "A".."D". SPR: canonical value; "|"-separated accepted forms. */
  correctAnswer: string;
  explanation: string;
}
