import { prisma } from "@/lib/prisma";

export interface Slot {
  startsAt: Date;
  endsAt: Date;
}

const SLOT_MINUTES = 60;
const DAYS_AHEAD = 14;

/**
 * Generate bookable 1-hour slots for a tutor over the next two weeks from their
 * recurring weekly availability, excluding times that are already booked or in
 * the past.
 */
export async function openSlots(tutorProfileId: string): Promise<Slot[]> {
  const [availability, bookings] = await Promise.all([
    prisma.availability.findMany({ where: { tutorId: tutorProfileId, kind: "RECURRING" } }),
    prisma.booking.findMany({
      where: { tutorId: tutorProfileId, status: { in: ["CONFIRMED", "COMPLETED"] } },
      select: { startsAt: true },
    }),
  ]);
  const bookedTimes = new Set(bookings.map((b) => b.startsAt.getTime()));

  const byWeekday = new Map<number, { start: number; end: number }[]>();
  for (const a of availability) {
    if (a.weekday == null || a.startMinute == null || a.endMinute == null) continue;
    if (!byWeekday.has(a.weekday)) byWeekday.set(a.weekday, []);
    byWeekday.get(a.weekday)!.push({ start: a.startMinute, end: a.endMinute });
  }

  const slots: Slot[] = [];
  const now = new Date();
  for (let d = 0; d < DAYS_AHEAD; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);
    day.setHours(0, 0, 0, 0);
    const windows = byWeekday.get(day.getDay());
    if (!windows) continue;
    for (const w of windows) {
      for (let m = w.start; m + SLOT_MINUTES <= w.end; m += SLOT_MINUTES) {
        const startsAt = new Date(day);
        startsAt.setMinutes(m);
        if (startsAt <= now) continue;
        if (bookedTimes.has(startsAt.getTime())) continue;
        const endsAt = new Date(startsAt.getTime() + SLOT_MINUTES * 60 * 1000);
        slots.push({ startsAt, endsAt });
      }
    }
  }
  return slots;
}
