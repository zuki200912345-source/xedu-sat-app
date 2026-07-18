import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FlashcardSession, type StudyCard } from "./flashcard-session";

export const metadata: Metadata = { title: "Review flashcards" };

export default async function StudyPage() {
  const session = await auth();
  const user = session!.user;

  const now = new Date();

  // Due, previously-seen cards first…
  const dueProgress = await prisma.vocabProgress.findMany({
    where: { userId: user.id, dueAt: { lte: now } },
    include: { word: true },
    orderBy: { dueAt: "asc" },
    take: 40,
  });

  // …then fill with new (never-seen) words.
  const seenIds = (
    await prisma.vocabProgress.findMany({ where: { userId: user.id }, select: { wordId: true } })
  ).map((p) => p.wordId);
  const newWords = await prisma.vocabWord.findMany({
    where: { id: { notIn: seenIds } },
    take: 20,
  });

  const cards: StudyCard[] = [
    ...dueProgress.map((p) => ({
      id: p.word.id,
      word: p.word.word,
      partOfSpeech: p.word.partOfSpeech,
      definition: p.word.definition,
      example: p.word.example,
    })),
    ...newWords.map((w) => ({
      id: w.id,
      word: w.word,
      partOfSpeech: w.partOfSpeech,
      definition: w.definition,
      example: w.example,
    })),
  ];

  if (cards.length === 0) redirect("/flashcards");

  return <FlashcardSession cards={cards} />;
}
