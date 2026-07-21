import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { QuestionAuthorForm } from "./author-form";

export const metadata: Metadata = { title: "Question bank" };

const SECTION_LABEL: Record<string, string> = { RW: "Reading & Writing", MATH: "Math" };

type CoverageRow = { section: string; domain: string; skill: string; subtopic: string | null; _count: { _all: number } };
interface SkillNode { skill: string; total: number; subtopics: { subtopic: string; count: number }[] }
interface DomainNode { domain: string; total: number; skills: SkillNode[] }
interface SectionNode { section: string; total: number; domains: DomainNode[] }

/** Fold flat groupBy rows into section → domain → skill → subtopic with counts. */
function buildCoverageTree(rows: CoverageRow[]): SectionNode[] {
  const sections = new Map<string, SectionNode>();
  for (const r of rows) {
    const n = r._count._all;
    const sec = sections.get(r.section) ?? { section: r.section, total: 0, domains: [] };
    sections.set(r.section, sec);
    sec.total += n;
    let dom = sec.domains.find((d) => d.domain === r.domain);
    if (!dom) { dom = { domain: r.domain, total: 0, skills: [] }; sec.domains.push(dom); }
    dom.total += n;
    let sk = dom.skills.find((s) => s.skill === r.skill);
    if (!sk) { sk = { skill: r.skill, total: 0, subtopics: [] }; dom.skills.push(sk); }
    sk.total += n;
    sk.subtopics.push({ subtopic: r.subtopic ?? "—", count: n });
  }
  const order = ["RW", "MATH"];
  const tree = [...sections.values()].sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section));
  for (const s of tree)
    for (const d of s.domains) {
      d.skills.sort((a, b) => b.total - a.total);
      for (const sk of d.skills) sk.subtopics.sort((a, b) => a.subtopic.localeCompare(b.subtopic));
    }
  return tree;
}

function prettySubtopic(s: string): string {
  return s === "—" ? "general" : s.replace(/_/g, " ");
}

export default async function AdminQuestionsPage() {
  await requireRole("ADMIN");

  const [recent, byStatus, coverage] = await Promise.all([
    prisma.question.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, section: true, skill: true, difficulty: true, type: true, stem: true, status: true },
    }),
    prisma.question.groupBy({ by: ["status"], _count: true }),
    prisma.question.groupBy({
      by: ["section", "domain", "skill", "subtopic"],
      where: { status: "PUBLISHED" },
      _count: { _all: true },
    }),
  ]);

  const tree = buildCoverageTree(coverage);

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
        <h2 className="text-lg font-semibold">Coverage by topic</h2>
        <p className="text-sm text-muted-foreground">
          The published bank, organized by section → domain → skill → subtopic.
        </p>
        <div className="space-y-3">
          {tree.map((sec) => (
            <Card key={sec.section}>
              <CardContent className="p-0">
                <details open className="group">
                  <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-semibold">
                    <span>{SECTION_LABEL[sec.section] ?? sec.section}</span>
                    <Badge variant="secondary">{sec.total} items</Badge>
                  </summary>
                  <div className="border-t">
                    {sec.domains.map((dom) => (
                      <details key={dom.domain} className="border-b last:border-b-0">
                        <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-accent/50">
                          <span>{dom.domain}</span>
                          <Badge variant="outline">{dom.total}</Badge>
                        </summary>
                        <div className="space-y-3 bg-secondary/30 px-4 py-3">
                          {dom.skills.map((sk) => (
                            <div key={sk.skill}>
                              <div className="flex items-center justify-between text-sm font-medium">
                                <span>{sk.skill}</span>
                                <span className="text-xs text-muted-foreground">{sk.total}</span>
                              </div>
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {sk.subtopics.map((st) => (
                                  <Badge key={st.subtopic} variant="secondary" className="font-normal">
                                    {prettySubtopic(st.subtopic)} · {st.count}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

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
