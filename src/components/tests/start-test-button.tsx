"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startFullTest } from "@/app/(app)/tests/actions";

export function StartTestButton({
  testId,
  label,
  className,
}: {
  testId: string;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      const attemptId = await startFullTest(testId);
      router.push(`/tests/take/${attemptId}`);
    } catch (e) {
      setLoading(false);
      if (e instanceof Error && e.message === "UPGRADE") {
        toast.error("Full tests are a Plus feature — upgrade to unlock");
        router.push("/settings/billing");
      } else {
        toast.error("Could not start the test");
      }
    }
  }

  return (
    <Button onClick={start} disabled={loading} className={className}>
      {loading ? "Loading…" : label}
    </Button>
  );
}
