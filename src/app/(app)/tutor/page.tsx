import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, GraduationCap, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Tutor hub" };

export default async function TutorHubPage() {
  const user = await requireRole("TUTOR", "ADMIN");

  const profile = await prisma.tutorProfile.findUnique({ where: { userId: user.id } });
  if (!profile) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Tutor hub</h1>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No tutor profile is set up for this account yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  const bookings = await prisma.booking.findMany({
    where: { tutorId: profile.id },
    include: { student: true },
    orderBy: { startsAt: "asc" },
  });
  const now = new Date();
  const upcoming = bookings.filter((b) => b.status === "CONFIRMED" && b.startsAt > now);

  // Student roster with a progress snapshot.
  const studentIds = [...new Set(bookings.map((b) => b.studentId))];
  const roster = await Promise.all(
    studentIds.map(async (id) => {
      const student = await prisma.user.findUniqueOrThrow({
        where: { id },
        select: { id: true, name: true, email: true },
      });
      const lastTest = await prisma.testAttempt.findFirst({
        where: { userId: id, status: "COMPLETED", test: { kind: "FULL" } },
        orderBy: { completedAt: "desc" },
        select: { scaledTotal: true },
      });
      const weakest = await prisma.skillMastery.findMany({
        where: { userId: id, attempts: { gte: 2 } },
      });
      const weak = weakest
        .map((m) => ({ skill: m.skill, acc: m.correct / m.attempts }))
        .sort((a, b) => a.acc - b.acc)
        .slice(0, 2)
        .map((w) => w.skill);
      return { student, lastScore: lastTest?.scaledTotal ?? null, weak };
    }),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tutor hub</h1>
        <p className="mt-1 text-muted-foreground">Your upcoming sessions and student roster.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Upcoming sessions" value={upcoming.length} icon={<CalendarClock className="h-4 w-4 text-primary" />} />
        <Stat label="Students" value={studentIds.length} icon={<Users className="h-4 w-4 text-primary" />} />
        <Stat label="Total sessions" value={bookings.length} icon={<GraduationCap className="h-4 w-4 text-primary" />} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Upcoming sessions</h2>
        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">No upcoming sessions.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((b) => (
              <Card key={b.id}>
                <CardContent className="flex items-center justify-between pt-6">
                  <div>
                    <p className="font-medium">{b.student.name}</p>
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
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/tutoring/${b.id}`}>Open</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Student roster</h2>
        {roster.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No students have booked with you yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {roster.map(({ student, lastScore, weak }) => (
              <Card key={student.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{student.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{student.email}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm">
                    Last full test:{" "}
                    <span className="font-semibold">{lastScore ? lastScore : "—"}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {weak.length > 0 ? (
                      weak.map((s) => (
                        <Badge key={s} variant="outline" className="text-xs">
                          Needs work: {s}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No weak-spot data yet</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
