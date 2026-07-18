"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateUser } from "@/app/(app)/admin/actions";

const selectClass = "rounded-md border border-input bg-background px-2 py-1 text-sm";

export function UserRow({
  user,
}: {
  user: { id: string; name: string; email: string; role: string; xp: number };
}) {
  const router = useRouter();
  const [role, setRole] = useState(user.role);
  const [busy, setBusy] = useState(false);

  async function save(nextRole: string) {
    setBusy(true);
    const res = await updateUser({ userId: user.id, role: nextRole }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      toast.success(`Updated ${user.name}`);
      router.refresh();
    } else {
      toast.error("Could not update user");
    }
  }

  return (
    <div className="grid grid-cols-12 items-center gap-2 px-4 py-3">
      <div className="col-span-6 min-w-0">
        <div className="truncate font-medium">{user.name}</div>
        <div className="truncate text-xs text-muted-foreground">{user.email}</div>
      </div>
      <div className="col-span-4">
        <select
          className={selectClass}
          value={role}
          disabled={busy}
          onChange={(e) => {
            setRole(e.target.value);
            save(e.target.value);
          }}
        >
          <option value="STUDENT">STUDENT</option>
          <option value="TUTOR">TUTOR</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </div>
      <div className="col-span-2 text-right text-sm text-muted-foreground">{user.xp}</div>
    </div>
  );
}
