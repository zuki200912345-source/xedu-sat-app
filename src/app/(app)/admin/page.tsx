import type { Metadata } from "next";
import Link from "next/link";
import { BookText, FileQuestion, Layers, Lock, ShieldAlert, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireRole("ADMIN");

  const [users, questions, tests, lessons, corpus, drafts] = await Promise.all([
    prisma.user.count(),
    prisma.question.count({ where: { status: "PUBLISHED" } }),
    prisma.test.count(),
    prisma.lesson.count(),
    prisma.referenceCorpusItem.count(),
    prisma.question.count({ where: { status: "DRAFT" } }),
  ]);

  const stats = [
    { label: "Users", value: users, href: "/admin/users", icon: Users },
    { label: "Published questions", value: questions, href: "/admin/questions", icon: FileQuestion },
    { label: "Tests & drills", value: tests, href: "/tests", icon: Layers },
    { label: "Lessons", value: lessons, href: "/lessons", icon: BookText },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin panel</h1>
        <p className="mt-1 text-muted-foreground">Manage content, users, and internal tooling.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:border-primary/50">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <s.icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/questions">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileQuestion className="h-5 w-5 text-primary" /> Question bank
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Browse the bank and author new original items with the built-in similarity check.
              {drafts > 0 && <span className="ml-1 font-medium text-amber-600">{drafts} draft(s) awaiting review.</span>}
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/users">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-primary" /> Users
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Manage roles and subscription tiers.
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/reference" className="md:col-span-2">
          <Card className="h-full border-amber-300/60 bg-amber-50/40 transition-colors hover:border-amber-400">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-5 w-5 text-amber-600" /> Internal reference corpus
                <Lock className="h-4 w-4 text-amber-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {corpus} attribute rows. Admin-only structural notes used to guide authoring — never
              exposed to students and never containing copyrighted text.
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
