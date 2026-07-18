export interface SeedQuestion {
  section: "RW" | "MATH";
  domain: string;
  skill: string;
  difficulty: "easy" | "medium" | "hard";
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
