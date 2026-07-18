import Link from "next/link";
import {
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  CalendarClock,
  GraduationCap,
  LineChart,
  Sparkles,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { auth } from "@/lib/auth";

const features = [
  {
    icon: Timer,
    title: "Bluebook-style adaptive tests",
    body: "Full-length, section-adaptive mocks with real module timing, flagging, answer elimination, and a built-in graphing calculator.",
  },
  {
    icon: BrainCircuit,
    title: "Weakness Conqueror",
    body: "We track every answer by domain, skill, and difficulty, then auto-build drills that attack your weakest skills first.",
  },
  {
    icon: LineChart,
    title: "Real scaled scores",
    body: "Per-form raw-to-scaled tables with authentic Easy-path capping — the score you see is the score the format would give you.",
  },
  {
    icon: BookOpenCheck,
    title: "Spaced-repetition vocab",
    body: "150+ SAT words on the SM-2 algorithm: a short daily queue, streaks, and words-in-context quizzes.",
  },
  {
    icon: CalendarClock,
    title: "1-on-1 tutoring",
    body: "Book expert tutors in two clicks. Video links are generated automatically and session notes live with your booking.",
  },
  {
    icon: BarChart3,
    title: "Analytics that coach you",
    body: "Score trends, skill mastery heatmaps, pacing vs. target, and a predicted score band that updates as you practice.",
  },
];


export default async function LandingPage() {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
          </nav>
          <div className="flex items-center gap-2">
            {session?.user ? (
              <Button asChild>
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/login">Log in</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">Start free</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(215_66%_30%/0.12),transparent)]"
            aria-hidden
          />
          <div className="mx-auto max-w-6xl px-4 py-24 text-center">
            <Badge variant="secondary" className="mb-6 gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Built for the Digital SAT — section-adaptive, just like test day
            </Badge>
            <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
              Master the Digital SAT with practice that{" "}
              <span className="text-primary">adapts to you</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
              Full-length adaptive mocks, precision drills, spaced-repetition vocabulary,
              and expert tutors — everything in one calm, focused workspace.
            </p>
            <div className="mt-10 flex items-center justify-center gap-3">
              <Button size="lg" asChild>
                <Link href="/register">Take the free diagnostic</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#features">See how it works</a>
              </Button>
            </div>
            <div className="mt-14 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {[
                ["10", "full adaptive mock tests"],
                ["400+", "original practice questions"],
                ["100+", "topic drills & lessons"],
                ["400–1600", "true scaled scoring"],
              ].map(([stat, label]) => (
                <div key={label} className="rounded-xl border bg-card p-4">
                  <div className="text-2xl font-bold text-primary">{stat}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t bg-secondary/50">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">
                Everything between you and your target score
              </h2>
              <p className="mt-3 text-muted-foreground">
                One platform for testing, drilling, memorizing, and coaching.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, body }) => (
                <Card key={title} className="border-border/70">
                  <CardHeader className="pb-2">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">{title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {body}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center">
            <GraduationCap className="h-10 w-10" />
            <h2 className="text-3xl font-bold tracking-tight">
              Your target score is a plan away
            </h2>
            <p className="max-w-xl text-primary-foreground/80">
              Take the 20-question diagnostic and get a prioritized study plan in under 30 minutes.
            </p>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/register">Create your free account</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <Logo />
          <p>
            © {new Date().getFullYear()} XeduSAT. All practice content is original and platform-owned.
          </p>
        </div>
      </footer>
    </div>
  );
}
