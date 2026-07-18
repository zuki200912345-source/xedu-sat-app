import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, ExternalLink, Video } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingActions } from "./booking-actions";

export const metadata: Metadata = { title: "Session details" };

export default async function BookingDetailPage({ params }: { params: { bookingId: string } }) {
  const user = await requireUser();

  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    include: { tutor: { include: { user: true } }, student: true },
  });
  const tutorProfile = await prisma.tutorProfile.findUnique({ where: { userId: user.id } });
  const isParticipant =
    booking && (booking.studentId === user.id || booking.tutorId === tutorProfile?.id);
  if (!booking || !isParticipant) notFound();

  const isMock = booking.meetingProvider === "mock";
  const isPast = booking.endsAt < new Date();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/tutoring" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to tutoring
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Session with {booking.tutor.user.name}</CardTitle>
            <Badge
              variant={
                booking.status === "CONFIRMED" ? "default" : booking.status === "CANCELED" ? "destructive" : "secondary"
              }
            >
              {booking.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-primary" />
            {booking.startsAt.toLocaleString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            ({Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60000)} min)
          </div>

          {booking.status === "CONFIRMED" && (
            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <Video className="h-4 w-4 text-primary" /> Video meeting
                {isMock && <Badge variant="outline">Mock link</Badge>}
              </div>
              <a
                href={booking.meetingUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                {booking.meetingUrl} <ExternalLink className="h-3.5 w-3.5" />
              </a>
              {isMock && (
                <p className="mt-2 text-xs text-muted-foreground">
                  This is a placeholder link. Add Zoom credentials in <code>.env</code> to generate
                  real meetings.
                </p>
              )}
            </div>
          )}

          <BookingActions
            bookingId={booking.id}
            notes={booking.notes ?? ""}
            canCancel={booking.status === "CONFIRMED" && !isPast}
          />
        </CardContent>
      </Card>
    </div>
  );
}
