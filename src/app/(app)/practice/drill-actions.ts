"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { TIER_LIMITS } from "@/lib/config";

const buildSchema = z.object({
  section: z.enum(["RW", "MATH"]),
  skill: z.string().optional(), // empty = any skill in section
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]),
  count: z.number().int().min(5).max(30),
});

/** Shuffle helper (Fisher–Yates). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Enforce the FREE daily drill-question cap. Returns the allowed count. */
async function applyDailyLimit(userId: string, tier: string, requested: number): Promise<number> {
  const limit = TIER_LIMITS[tier as keyof typeof TIER_LIMITS]?.dailyDrillQuestions ?? Infinity;
  if (limit === Infinity) return requested;

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const answeredToday = await prisma.answer.count({
    where: {
      moduleAttempt: {
        attempt: {
          userId,
          test: { kind: { in: ["DRILL", "TOPIC"] } },
          startedAt: { gte: since },
        },
      },
    },
  });
  return Math.max(0, Math.min(requested, limit - answeredToday));
}

/**
 * Build an on-the-fly practice drill from the question bank and return its id.
 * The drill is a lightweight DRILL Test with one module, reusable by the runner.
 */
export async function buildDrill(input: z.infer<typeof buildSchema>): Promise<{ testId: string } | { error: string }> {
  const user = await requireUser();
  const data = buildSchema.parse(input);

  const allowed = await applyDailyLimit(user.id, user.tier, data.count);
  if (allowed <= 0) {
    return { error: "You've reached today's free drill limit. Upgrade to Plus for unlimited drills." };
  }

  const pool = await prisma.question.findMany({
    where: {
      section: data.section,
      status: "PUBLISHED",
      ...(data.skill ? { skill: data.skill } : {}),
      ...(data.difficulty === "mixed" ? {} : { difficulty: data.difficulty }),
    },
    select: { id: true, difficulty: true },
  });
  if (pool.length === 0) return { error: "No questions match those filters yet." };

  const picked = shuffle(pool).slice(0, allowed).map((q) => q.id);

  const label = data.skill
    ? `${data.skill} drill`
    : `${data.section === "MATH" ? "Math" : "Reading & Writing"} drill`;

  const test = await prisma.test.create({
    data: {
      title: label,
      kind: "DRILL",
      description: `Custom ${data.difficulty} drill · ${picked.length} questions`,
      isPublished: true,
      section: data.section,
      skill: data.skill,
      difficulty: data.difficulty,
      modules: { create: { section: data.section, order: 1, path: "BASE" } },
    },
    include: { modules: true },
  });
  await prisma.moduleQuestion.createMany({
    data: picked.map((questionId, i) => ({ moduleId: test.modules[0].id, questionId, order: i + 1 })),
  });

  return { testId: test.id };
}

/**
 * Weakness Conqueror: build a drill from the user's weakest skills (lowest
 * accuracy among skills they've attempted at least a few times). Falls back to
 * a broad mixed drill for brand-new users.
 */
export async function buildWeaknessDrill(): Promise<{ testId: string } | { error: string }> {
  const user = await requireUser();

  const mastery = await prisma.skillMastery.findMany({
    where: { userId: user.id, attempts: { gte: 2 } },
  });

  // Rank skills by accuracy ascending; take the weakest few.
  const weakest = mastery
    .map((m) => ({ skill: m.skill, section: m.section, acc: m.correct / m.attempts }))
    .sort((a, b) => a.acc - b.acc)
    .slice(0, 4);

  let questionIds: string[];
  let title: string;

  if (weakest.length === 0) {
    // No history yet — a broad mixed drill across both sections.
    const pool = await prisma.question.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true },
    });
    questionIds = shuffle(pool).slice(0, 12).map((q) => q.id);
    title = "Warm-up mixed drill";
  } else {
    const skills = weakest.map((w) => w.skill);
    const pool = await prisma.question.findMany({
      where: { skill: { in: skills }, status: "PUBLISHED" },
      select: { id: true, skill: true },
    });
    // Spread across the weak skills.
    questionIds = shuffle(pool).slice(0, 15).map((q) => q.id);
    title = "Weakness Conqueror drill";
  }

  const allowed = await applyDailyLimit(user.id, user.tier, questionIds.length);
  if (allowed <= 0) {
    return { error: "You've reached today's free drill limit. Upgrade to Plus for unlimited drills." };
  }
  questionIds = questionIds.slice(0, allowed);
  if (questionIds.length === 0) return { error: "Not enough questions available yet." };

  const test = await prisma.test.create({
    data: {
      title,
      kind: "DRILL",
      description: weakest.length
        ? `Targets your weakest skills: ${weakest.map((w) => w.skill).join(", ")}`
        : "A broad mix to establish your baseline",
      isPublished: true,
      modules: { create: { section: weakest[0]?.section ?? "RW", order: 1, path: "BASE" } },
    },
    include: { modules: true },
  });
  await prisma.moduleQuestion.createMany({
    data: questionIds.map((questionId, i) => ({ moduleId: test.modules[0].id, questionId, order: i + 1 })),
  });

  return { testId: test.id };
}
