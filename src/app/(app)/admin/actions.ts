"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role, Tier, Section, Difficulty, QuestionType } from "@/lib/enums";
import { similarityGate, SIMILARITY_THRESHOLD } from "@/lib/similarity";

const questionSchema = z.object({
  section: Section,
  domain: z.string().min(1),
  skill: z.string().min(1),
  difficulty: Difficulty,
  type: QuestionType,
  stem: z.string().min(5),
  choices: z.array(z.string()).length(4).optional(),
  correctAnswer: z.string().min(1),
  explanation: z.string().min(5),
  passageText: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
});

/** Run the similarity gate for a candidate item against all published items. */
export async function checkSimilarity(text: string): Promise<{ ok: boolean; maxOverlap: number }> {
  await requireRole("ADMIN");
  const published = await prisma.question.findMany({
    where: { status: "PUBLISHED" },
    select: { stem: true, passage: { select: { content: true } } },
  });
  const refs = published.map((q) => `${q.passage?.content ?? ""} ${q.stem}`);
  return similarityGate(text, refs);
}

/** Create a new original question (runs the similarity gate before saving). */
export async function createQuestion(input: z.infer<typeof questionSchema>): Promise<{ id?: string; error?: string }> {
  await requireRole("ADMIN");
  const data = questionSchema.parse(input);

  if (data.type === "MCQ" && !data.choices) return { error: "MCQ questions need 4 choices." };

  const gate = await checkSimilarity(`${data.passageText ?? ""} ${data.stem}`);
  if (!gate.ok) {
    return {
      error: `Rejected: ${(gate.maxOverlap * 100).toFixed(0)}% overlap with an existing item (max ${(SIMILARITY_THRESHOLD * 100).toFixed(0)}%).`,
    };
  }

  let passageId: string | undefined;
  if (data.passageText) {
    const passage = await prisma.passage.create({ data: { content: data.passageText } });
    passageId = passage.id;
  }

  const q = await prisma.question.create({
    data: {
      section: data.section,
      domain: data.domain,
      skill: data.skill,
      difficulty: data.difficulty,
      type: data.type,
      stem: data.stem,
      choices: data.choices ? JSON.stringify(data.choices) : null,
      correctAnswer: data.correctAnswer,
      explanation: data.explanation,
      status: data.status,
      passageId,
    },
  });

  revalidatePath("/admin/questions");
  return { id: q.id };
}

/** Update a user's role and tier (admin user management). */
export async function updateUser(input: { userId: string; role: string; tier: string }): Promise<{ ok: boolean }> {
  await requireRole("ADMIN");
  const data = z.object({ userId: z.string().min(1), role: Role, tier: Tier }).parse(input);

  await prisma.user.update({
    where: { id: data.userId },
    data: { role: data.role, tier: data.tier },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}
