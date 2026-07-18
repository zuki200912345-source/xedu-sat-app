"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markLessonComplete } from "@/app/(app)/lessons/actions";

export function CompleteLessonButton({
  lessonId,
  alreadyDone,
}: {
  lessonId: string;
  alreadyDone: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(alreadyDone);
  const [busy, setBusy] = useState(false);

  async function complete() {
    setBusy(true);
    await markLessonComplete(lessonId).catch(() => {});
    setDone(true);
    setBusy(false);
    router.refresh();
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
        <Check className="h-4 w-4" /> Completed
      </span>
    );
  }
  return (
    <Button onClick={complete} disabled={busy}>
      {busy ? "Saving…" : "Mark as complete"}
    </Button>
  );
}
