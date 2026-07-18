import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isDevAuthed, DEV_COOKIE } from "@/lib/dev-portal";
import { DevDashboard } from "./dev-dashboard";

export const metadata = { title: "Internal", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DevPage() {
  // Server-side gate: without a valid dev cookie this route does not exist.
  const token = cookies().get(DEV_COOKIE)?.value;
  if (!isDevAuthed(token)) notFound();

  const [totalUsers, users] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, usefulInteractions: true },
      orderBy: { usefulInteractions: "desc" },
    }),
  ]);

  const totalInteractions = users.reduce((s, u) => s + u.usefulInteractions, 0);

  return (
    <DevDashboard
      totalUsers={totalUsers}
      totalInteractions={totalInteractions}
      users={users}
    />
  );
}
