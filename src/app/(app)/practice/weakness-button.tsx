"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Swords } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildWeaknessDrill } from "@/app/(app)/practice/drill-actions";

export function WeaknessButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    const res = await buildWeaknessDrill();
    if ("error" in res) {
      toast.error(res.error);
      setBusy(false);
      return;
    }
    router.push(`/session/${res.testId}`);
  }

  return (
    <Button onClick={start} disabled={busy} className="gap-2">
      <Swords className="h-4 w-4" />
      {busy ? "Building your drill…" : "Conquer my weaknesses"}
    </Button>
  );
}
