import type { Metadata } from "next";
import Link from "next/link";
import { Lock, ShieldAlert } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Reference corpus (internal)" };

// ADMIN-ONLY. This is the only route that reads ReferenceCorpusItem, and it is
// gated by both middleware (role check) and requireRole here. It is never
// referenced from any student-facing route or API.
export default async function ReferenceCorpusPage() {
  await requireRole("ADMIN");
  const items = await prisma.referenceCorpusItem.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← Admin
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldAlert className="h-6 w-6 text-amber-600" /> Internal reference corpus
          <Lock className="h-5 w-5 text-amber-600" />
        </h1>
        <p className="mt-1 text-muted-foreground">
          Structural attribute notes only — no copyrighted text. Used to guide original question
          authoring. This data is never served to students through any API or page.
        </p>
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Access-gated:</strong> ADMIN role required. Contains no item text — only domain,
        skill, difficulty, and structure notes.
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="space-y-2 pt-6">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{item.domain}</Badge>
                <Badge variant="secondary">{item.skill}</Badge>
                <Badge variant="outline" className="capitalize">
                  {item.difficulty}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{item.structureNotes}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
