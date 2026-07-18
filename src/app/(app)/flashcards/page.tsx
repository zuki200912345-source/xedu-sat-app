import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Flame, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Flashcards" };

export default async function FlashcardsPage() {
  const session = await auth();
  const user = session!.user;

  const now = new Date();
  const totalWords = await prisma.vocabWord.count();
  const progress = await prisma.vocabProgress.findMany({
    where: { userId: user.id },
    select: { dueAt: true, repetitions: true },
  });
  const seen = progress.length;
  const dueSeen = progress.filter((p) => p.dueAt <= now).length;
  const newCards = totalWords - seen;
  const dueToday = dueSeen + Math.min(newCards, 20); // cap new cards per session
  const mastered = progress.filter((p) => p.repetitions >= 3).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vocabulary flashcards</h1>
        <p className="mt-1 text-muted-foreground">
          {totalWords} SAT words on a spaced-repetition schedule (SM-2). Review a little every
          day and the words you find hard come back sooner.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Due today" value={dueToday} icon={<Flame className="h-4 w-4 text-primary" />} />
        <Stat label="Words seen" value={`${seen}/${totalWords}`} icon={<BookOpen className="h-4 w-4 text-primary" />} />
        <Stat label="Mastered" value={mastered} icon={<Sparkles className="h-4 w-4 text-primary" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s review</CardTitle>
          <CardDescription>
            {dueToday > 0
              ? `${dueToday} card${dueToday === 1 ? "" : "s"} ready. New words are mixed in with ones you're due to see again.`
              : "You're all caught up! Come back tomorrow for more reviews."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild disabled={dueToday === 0}>
            <Link href="/flashcards/study">{dueToday > 0 ? "Start reviewing" : "Nothing due"}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

