"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cancelBooking, saveBookingNotes } from "@/app/(app)/tutoring/actions";

export function BookingActions({
  bookingId,
  notes: initialNotes,
  canCancel,
}: {
  bookingId: string;
  notes: string;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [savingNotes, setSavingNotes] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function save() {
    setSavingNotes(true);
    await saveBookingNotes(bookingId, notes).catch(() => toast.error("Could not save notes"));
    setSavingNotes(false);
    toast.success("Notes saved");
  }

  async function cancel() {
    setCancelling(true);
    const res = await cancelBooking(bookingId).catch(() => null);
    setCancelling(false);
    if (res?.ok) {
      toast.success("Session cancelled — credit refunded");
      router.push("/tutoring");
    } else {
      toast.error("Could not cancel");
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="notes">Session notes &amp; shared resources</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Topics to cover, questions to ask, links to share…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button size="sm" variant="outline" onClick={save} disabled={savingNotes}>
          {savingNotes ? "Saving…" : "Save notes"}
        </Button>
      </div>

      {canCancel && (
        <div className="border-t pt-4">
          <Button variant="destructive" size="sm" onClick={cancel} disabled={cancelling}>
            {cancelling ? "Cancelling…" : "Cancel session"}
          </Button>
        </div>
      )}
    </div>
  );
}
