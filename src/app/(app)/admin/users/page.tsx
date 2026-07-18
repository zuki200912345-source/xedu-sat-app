import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { UserRow } from "./user-row";

export const metadata: Metadata = { title: "Manage users" };

export default async function AdminUsersPage() {
  await requireRole("ADMIN");
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, xp: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← Admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Users</h1>
        <p className="mt-1 text-muted-foreground">Manage user roles.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <div className="col-span-6">User</div>
              <div className="col-span-4">Role</div>
              <div className="col-span-2 text-right">XP</div>
            </div>
            {users.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
