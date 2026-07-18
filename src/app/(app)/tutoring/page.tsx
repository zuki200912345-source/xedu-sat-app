import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Lock, Video } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tierMeets } from "@/lib/tier";
import { openSlots } from "@/lib/slots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TutorBooking } from "./tutor-booking";

export const metadata: Metadata = { title: "Tutoring" };

export default async function TutoringPage() {
  const session = await auth();
  const user = session!.user;
  const canBook = tierMeets(user.tier, "PREMIUM");

  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { tutoringCredits: true },
  });

  const tutors = await prisma.tutorProfile.findMany({ include: { user: true } });
  const tutorSlots = await Promise.all(
    tutors.map(async (t) => ({
      profile: t,
      slots: (await openSlots(t.id)).slice(0, 8).map((s) => ({
        startsAt: s.startsAt.toISOString(),
        label: s.startsAt.toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      })),
    })),
  );

  const myBookings = await prisma.booking.findMany({
    where: { studentId: user.id },
    include: { tutor: { include: { user: true } } },
    orderBy: { startsAt: "asc" },
  });
  const upcoming = myBookings.filter((b) => b.status === "CONFIRMED" && b.startsAt > new Date());

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tutoring</h1>
          <p className="mt-1 text-muted-foreground">
            Book a 1-on-1 session. Each confirmed booking gets a video link automatically.
          </p>
        </div>
        {canBook && (
          <Badge variant="secondary" className="gap-1.5 text-sm">
            <CalendarClock className="h-4 w-4 text-primary" />
            {dbUser.tutoringCredits} credit{dbUser.tutoringCredits === 1 ? "" : "s"} left
          </Badge>
        )}
      </div>

      {!canBook && (
        <Card className="border-primary/40 bg-accent/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Tutoring is a Premium feature</p>
                <p className="text-sm text-muted-foreground">
                  Premium includes monthly tutoring credits for 1-on-1 sessions.
                </p>
              </div>
            </div>
            <Button asChild>
              <Link href="/settings/billing">Upgrade to Premium</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Upcoming sessions */}
      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Your upcoming sessions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((b) => (
              <Card key={b.id}>
                <CardContent className="flex items-center justify-between pt-6">
                  <div>
                    <p className="font-medium">{b.tutor.user.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {b.startsAt.toLocaleString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Button size="sm" asChild>
                    <Link href={`/tutoring/${b.id}`}>
                      <Video className="mr-1.5 h-4 w-4" /> Details
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Tutors */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Available tutors</h2>
        {tutorSlots.map(({ profile, slots }) => (
          <Card key={profile.id}>
            <CardHeader>
              <CardTitle className="text-base">{profile.user.name}</CardTitle>
              <CardDescription>{profile.bio}</CardDescription>
              <div className="flex flex-wrap gap-2 pt-1">
                {(JSON.parse(profile.subjects) as string[]).map((s) => (
                  <Badge key={s} variant="secondary">
                    {s}
                  </Badge>
                ))}
                <Badge variant="outline">${(profile.hourlyRate / 100).toFixed(0)}/hr value</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <TutorBooking
                tutorProfileId={profile.id}
                slots={slots}
                canBook={canBook && dbUser.tutoringCredits > 0}
              />
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
