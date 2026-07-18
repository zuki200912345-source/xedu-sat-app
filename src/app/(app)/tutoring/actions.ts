"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { createMeeting } from "@/lib/meeting";

const bookSchema = z.object({
  tutorProfileId: z.string().min(1),
  startsAt: z.string().datetime(),
});

/** Book a tutoring slot and create the meeting link (available to all users). */
export async function bookSlot(input: z.infer<typeof bookSchema>): Promise<{ bookingId: string } | { error: string }> {
  const user = await requireUser();
  const data = bookSchema.parse(input);

  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { name: true },
  });

  const profile = await prisma.tutorProfile.findUnique({
    where: { id: data.tutorProfileId },
    include: { user: true },
  });
  if (!profile) return { error: "Tutor not found." };

  const startsAt = new Date(data.startsAt);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

  // Guard against double-booking the same slot.
  const clash = await prisma.booking.findFirst({
    where: { tutorId: profile.id, startsAt, status: { in: ["CONFIRMED", "COMPLETED"] } },
  });
  if (clash) return { error: "That slot was just taken. Please pick another." };

  const meeting = await createMeeting({
    topic: `XeduSAT tutoring: ${dbUser.name} with ${profile.user.name}`,
    startsAt,
    durationMinutes: 60,
  });

  const booking = await prisma.booking.create({
    data: {
      studentId: user.id,
      tutorId: profile.id,
      startsAt,
      endsAt,
      status: "CONFIRMED",
      meetingUrl: meeting.joinUrl,
      meetingProvider: meeting.provider,
    },
  });

  revalidatePath("/tutoring");
  return { bookingId: booking.id };
}

/** Cancel a booking. */
export async function cancelBooking(bookingId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  z.string().min(1).parse(bookingId);

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.studentId !== user.id) throw new Error("FORBIDDEN");
  if (booking.status !== "CONFIRMED") return { ok: false };

  await prisma.booking.update({ where: { id: bookingId }, data: { status: "CANCELED" } });

  revalidatePath("/tutoring");
  return { ok: true };
}

/** Save session notes (student side). */
export async function saveBookingNotes(bookingId: string, notes: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  z.object({ bookingId: z.string().min(1), notes: z.string().max(5000) }).parse({ bookingId, notes });

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || (booking.studentId !== user.id && booking.tutorId !== user.id)) {
    // tutor check below
  }
  const profile = await prisma.tutorProfile.findUnique({ where: { userId: user.id } });
  const isParticipant = booking?.studentId === user.id || booking?.tutorId === profile?.id;
  if (!booking || !isParticipant) throw new Error("FORBIDDEN");

  await prisma.booking.update({ where: { id: bookingId }, data: { notes } });
  revalidatePath(`/tutoring/${bookingId}`);
  return { ok: true };
}
