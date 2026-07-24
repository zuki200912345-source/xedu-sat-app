import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Admin-only JSONL export of the training corpus (TrainingEvent) — the
 * long-term feed for model fine-tuning on real student work. One event per
 * line: { userId, kind, createdAt, ...payload }.
 */
export async function GET() {
  try {
    await requireRole("ADMIN");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const events = await prisma.trainingEvent.findMany({ orderBy: { createdAt: "asc" } });
  const lines = events.map((e) => {
    let payload: unknown = {};
    try { payload = JSON.parse(e.payload); } catch { /* keep empty */ }
    return JSON.stringify({ userId: e.userId, kind: e.kind, createdAt: e.createdAt, ...(payload as object) });
  });
  return new NextResponse(lines.join("\n") + (lines.length ? "\n" : ""), {
    headers: {
      "Content-Type": "application/jsonl; charset=utf-8",
      "Content-Disposition": `attachment; filename="xedusat-training-${new Date().toISOString().slice(0, 10)}.jsonl"`,
    },
  });
}
