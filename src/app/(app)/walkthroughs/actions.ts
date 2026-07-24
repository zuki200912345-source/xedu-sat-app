"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { captureMistake, resolveMistake } from "@/lib/mistakes";
import { awardXp, bumpUsefulInteraction } from "@/lib/gamification";

const answerSchema = z.object({
  skill: z.string().min(1).max(120),
  questionId: z.string().min(1).max(64),
  correct: z.boolean(),
  response: z.string().max(200).nullable(),
  isFinalAttempt: z.boolean(),
});

/**
 * Record a solo-mode walkthrough answer: update skill mastery, and feed the
 * mistake notebook on a final incorrect attempt (or resolve it when correct).
 */
export async function recordWalkthroughAnswer(input: z.infer<typeof answerSchema>) {
  const user = await requireUser();
  const data = answerSchema.parse(input);

  const q = await prisma.question.findUnique({
    where: { id: data.questionId },
    select: { section: true, skill: true },
  });
  if (!q) return { ok: false };

  // Skill mastery — count the attempt once (on the final attempt).
  if (data.isFinalAttempt) {
    await prisma.skillMastery.upsert({
      where: { userId_skill: { userId: user.id, skill: q.skill } },
      create: {
        userId: user.id,
        skill: q.skill,
        section: q.section,
        attempts: 1,
        correct: data.correct ? 1 : 0,
      },
      update: {
        attempts: { increment: 1 },
        correct: data.correct ? { increment: 1 } : undefined,
        lastSeen: new Date(),
      },
    });
  }

  if (data.correct) {
    await resolveMistake(user.id, data.questionId);
  } else if (data.isFinalAttempt) {
    await captureMistake({ userId: user.id, questionId: data.questionId, source: "walkthrough", response: data.response });
  }
  return { ok: true };
}

/** Mark a walkthrough completed and award progress. */
export async function completeWalkthrough(skill: string) {
  const user = await requireUser();
  z.string().min(1).max(120).parse(skill);

  await prisma.walkthroughProgress.upsert({
    where: { userId_skill: { userId: user.id, skill } },
    create: { userId: user.id, skill, status: "COMPLETED" },
    update: { status: "COMPLETED" },
  });

  await awardXp(user.id, 25);
  await bumpUsefulInteraction(user.id);

  revalidatePath("/walkthroughs");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Mark a walkthrough started (first visit). */
export async function startWalkthrough(skill: string) {
  const user = await requireUser();
  z.string().min(1).max(120).parse(skill);
  await prisma.walkthroughProgress.upsert({
    where: { userId_skill: { userId: user.id, skill } },
    create: { userId: user.id, skill, status: "IN_PROGRESS" },
    update: {}, // don't downgrade a completed one
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Thoth question-specific coaching (DeepSeek-backed).
// ---------------------------------------------------------------------------

const teachSchema = z.object({
  questionId: z.string().min(1).max(64),
  mode: z.enum(["teach", "mistake"]),
  chosen: z.string().max(4).optional(),
});

/**
 * Generate short chat bubbles walking through THIS specific question.
 * - teach: Thoth solves the exact question step by step, ending on the key.
 * - mistake: the student chose `chosen`; explain that specific error.
 * Falls back to the stored explanation if the model call fails.
 */
export async function thothTeachQuestion(
  input: z.infer<typeof teachSchema>,
): Promise<{ steps: string[] }> {
  await requireUser();
  const { questionId, mode, chosen } = teachSchema.parse(input);

  const q = await prisma.question.findUnique({
    where: { id: questionId },
    include: { passage: true },
  });
  if (!q) return { steps: ["Hmm, I can't find that question — let's move on."] };

  const choices = q.choices ? (JSON.parse(q.choices) as string[]) : [];
  const letterList = choices.map((c, i) => `${"ABCD"[i]}) ${c}`).join("\n");
  const fallback =
    mode === "teach"
      ? [`Let's look at it together. The answer is ${q.correctAnswer}.`, q.explanation]
      : [`Not quite — the answer is ${q.correctAnswer}.`, q.explanation];

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { steps: fallback };

  const prompt =
    mode === "teach"
      ? `You are Thoth, a friendly SAT tutor, walking a student through this exact question step by step.
${q.passage ? `PASSAGE:\n${q.passage.content}\n` : ""}QUESTION: ${q.stem}
CHOICES:\n${letterList}
CORRECT ANSWER: ${q.correctAnswer}
REFERENCE REASONING: ${q.explanation}

Return STRICT JSON {"steps": [string, ...]} — 4 to 6 short chat messages (each under 35 words, plain text, no LaTeX or markdown):
1) point out what the question is really asking, 2-4) solve it step by step using THIS question's numbers/text, last) state the answer letter and why the tempting wrong choice fails.`
      : `You are Thoth, a friendly SAT tutor. A student answered this question and chose ${chosen}, which is wrong.
${q.passage ? `PASSAGE:\n${q.passage.content}\n` : ""}QUESTION: ${q.stem}
CHOICES:\n${letterList}
CORRECT ANSWER: ${q.correctAnswer}
REFERENCE REASONING: ${q.explanation}

Return STRICT JSON {"steps": [string, ...]} — 3 to 4 short chat messages (each under 35 words, plain text):
1) name the specific trap in choice ${chosen} and why it's tempting, 2-3) walk the correct reasoning with THIS question's specifics, last) state why ${q.correctAnswer} is right.`;

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          { role: "system", content: "You are Thoth, a warm, concise SAT tutor. Strict JSON only. Plain text — no LaTeX, no markdown." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });
    if (!res.ok) return { steps: fallback };
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as { steps?: unknown[] };
    const steps = (parsed.steps ?? [])
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0 && s.length <= 400)
      .slice(0, 6);
    return steps.length >= 2 ? { steps } : { steps: fallback };
  } catch {
    return { steps: fallback };
  }
}
