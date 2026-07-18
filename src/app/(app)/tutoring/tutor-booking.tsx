"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { bookSlot } from "@/app/(app)/tutoring/actions";

interface SlotItem {
  startsAt: string;
  label: string;
}

export function TutorBooking({
  tutorProfileId,
  slots,
  canBook,
}: {
  tutorProfileId: string;
  slots: SlotItem[];
  canBook: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function book() {
    if (!selected) return;
    setBusy(true);
    const res = await bookSlot({ tutorProfileId, startsAt: selected });
    if ("error" in res) {
      toast.error(res.error);
      setBusy(false);
      return;
    }
    toast.success("Session booked! Video link is ready.");
    router.push(`/tutoring/${res.bookingId}`);
  }

  if (slots.length === 0) {
    return <p className="text-sm text-muted-foreground">No open slots in the next two weeks.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {slots.map((s) => (
          <button
            key={s.startsAt}
            disabled={!canBook}
            onClick={() => setSelected(s.startsAt)}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              selected === s.startsAt ? "border-2 border-primary bg-primary/5" : "hover:bg-accent",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {canBook ? (
        <Button onClick={book} disabled={!selected || busy}>
          {busy ? "Booking…" : "Book selected slot"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Premium with available credits is required to book.
        </p>
      )}
    </div>
  );
}
