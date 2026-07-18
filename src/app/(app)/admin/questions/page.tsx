import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { QuestionAuthorForm } from "./author-form";

export const metadata: Metadata = { title: "Question bank" };

export default async function AdminQuestionsPage() {
  await requireRole("ADMIN");

  const [recent, byStatus] = await Promise.all([
    prisma.question.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, section: true, skill: true, difficulty: true, type: true, stem: true, status: true },
    }),
    prisma.question.groupBy({ by: ["status"], _count: true }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← Admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Question bank</h1>
        <p className="mt-1 text-muted-foreground">
          Author new original items — the similarity check runs before publishing.
        </p>
        <div className="mt-3 flex gap-2">
          {byStatus.map((s) => (
            <Badge key={s.status} variant="secondary">
              {s._count} {s.status.toLowerCase()}
            </Badge>
          ))}
        </div>
      </div>

      <QuestionAuthorForm />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recently added</h2>
        <Card>
          <CardContent className="divide-y p-0">
            {recent.map((q) => (
              <div key={q.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                <Badge variant="outline" className="shrink-0">
                  {q.section}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate">{q.stem}</p>
                  <p className="text-xs text-muted-foreground">
                    {q.skill} · {q.difficulty} · {q.type}
                  </p>
                </div>
                <Badge variant={q.status === "PUBLISHED" ? "default" : "secondary"} className="shrink-0">
                  {q.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
