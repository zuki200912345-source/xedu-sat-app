"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { awardXp, grantBadge, touchStreak } from "@/lib/gamification";

export async function markLessonComplete(lessonId: string) {
  const user = await requireUser();
  z.string().min(1).parse(lessonId);

  const existing = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: user.id, lessonId } },
  });
  if (existing) return { ok: true };

  await prisma.lessonProgress.create({ data: { userId: user.id, lessonId } });
  await awardXp(user.id, 15);
  await touchStreak(user.id);

  const count = await prisma.lessonProgress.count({ where: { userId: user.id } });
  if (count >= 5) await grantBadge(user.id, "scholar");

  return { ok: true };
}
