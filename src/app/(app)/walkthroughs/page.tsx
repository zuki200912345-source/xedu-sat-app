import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { walkthroughGroups } from "@/lib/walkthroughs";
import { ThothAvatar } from "@/components/thoth-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Walkthroughs with Thoth" };

export default async function WalkthroughsPage() {
  const session = await auth();
  const user = session!.user;

  const groups = walkthroughGroups();
  const progress = await prisma.walkthroughProgress.findMany({
    where: { userId: user.id },
    select: { skill: true, status: true },
  });
  const statusBySkill = new Map(progress.map((p) => [p.skill, p.status]));

  const total = groups.reduce((s, g) => s + g.skills.length, 0);
  const done = progress.filter((p) => p.status === "COMPLETED").length;

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4 rounded-2xl bg-primary p-6 text-primary-foreground">
        <ThothAvatar className="h-12 w-12 bg-primary-foreground/15" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Learn with Thoth</h1>
          <p className="mt-1 max-w-2xl text-primary-foreground/80">
            Pick a question type and I&apos;ll walk you through it step by step — first
            together, then on your own. {done} of {total} completed.
          </p>
        </div>
      </div>

      {groups.map((group) => (
        <section key={group.section + group.domain} className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{group.section === "MATH" ? "Math" : "Reading & Writing"}</Badge>
            <h2 className="text-lg font-semibold">{group.domain}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.skills.map((skill) => {
              const status = statusBySkill.get(skill);
              const label =
                status === "COMPLETED" ? "Review" : status === "IN_PROGRESS" ? "Continue" : "Start";
              return (
                <Link key={skill} href={`/walkthroughs/${encodeURIComponent(skill)}`}>
                  <Card className="h-full transition-colors hover:border-primary/50">
                    <CardContent className="flex items-center justify-between gap-3 py-4">
                      <div className="flex items-center gap-3">
                        {status === "COMPLETED" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : status === "IN_PROGRESS" ? (
                          <PlayCircle className="h-5 w-5 text-primary" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/40" />
                        )}
                        <span className="font-medium">{skill}</span>
                      </div>
                      <span className="text-xs font-medium text-primary">{label} →</span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
