import { prisma } from "@/lib/prisma";

/** Days since the Unix epoch (UTC), used to rotate the article of the day. */
export function dayNumber(date = new Date()): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000,
  );
}

/** Today's required article, chosen deterministically from the library. */
export async function getTodaysArticle() {
  const count = await prisma.readingArticle.count();
  if (count === 0) return null;
  const index = dayNumber() % count;
  return prisma.readingArticle.findUnique({ where: { dayIndex: index } });
}
