"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown } from "lucide-react";

interface DevUser {
  id: string;
  name: string;
  email: string;
  usefulInteractions: number;
}

export function DevDashboard({
  totalUsers,
  totalInteractions,
  users,
}: {
  totalUsers: number;
  totalInteractions: number;
  users: DevUser[];
}) {
  const router = useRouter();
  const [dir, setDir] = useState<"desc" | "asc">("desc");

  const sorted = useMemo(
    () =>
      [...users].sort((a, b) =>
        dir === "desc"
          ? b.usefulInteractions - a.usefulInteractions
          : a.usefulInteractions - b.usefulInteractions,
      ),
    [users, dir],
  );

  async function logout() {
    await fetch("/api/dev/logout", { method: "POST" }).catch(() => {});
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Developer dashboard</h1>
            <p className="text-sm text-slate-400">Internal analytics — not for end users.</p>
          </div>
          <button
            onClick={logout}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="text-sm text-slate-400">Total users</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{totalUsers}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="text-sm text-slate-400">Total useful interactions</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{totalInteractions}</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Name</th>
                <th className="px-4 py-2.5 text-left font-medium">Email</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <button
                    onClick={() => setDir((d) => (d === "desc" ? "asc" : "desc"))}
                    className="inline-flex items-center gap-1 hover:text-slate-100"
                  >
                    Useful interactions <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950">
              {sorted.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2.5">{u.name}</td>
                  <td className="px-4 py-2.5 text-slate-400">{u.email}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                    {u.usefulInteractions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
