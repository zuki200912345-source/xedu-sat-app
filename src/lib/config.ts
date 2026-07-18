// Digital SAT blueprint constants — the single place to tune test mechanics.

export const SAT_CONFIG = {
  rw: {
    questionsPerModule: 27,
    minutesPerModule: 32,
    totalQuestions: 54,
  },
  math: {
    questionsPerModule: 22,
    minutesPerModule: 35,
    totalQuestions: 44,
    sprShare: 0.25, // ~25% Student-Produced Response
  },
  breakMinutes: 10,

  // Section-adaptive routing: fraction of Module 1 answered correctly at or
  // above which the student is routed to the Hard Module 2.
  routingThreshold: 0.7,

  // A student routed to the Easy path is capped at roughly this scaled score.
  // The authoritative cap lives in each test's ScaleTable rows; this constant
  // is used when generating scale tables and as a sanity bound.
  easyPathScaledCap: 590,

  sectionScore: { min: 200, max: 800 },
  totalScore: { min: 400, max: 1600 },
} as const;

