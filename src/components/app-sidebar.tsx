"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BarChart3,
  BookOpenCheck,
  BookText,
  CalendarClock,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  Newspaper,
  NotebookPen,
  Settings,
  ShieldCheck,
  Stethoscope,
  Timer,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/enums";

const studentNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/diagnostic", label: "Diagnostic", icon: Stethoscope },
  { href: "/tests", label: "Full tests", icon: Timer },
  { href: "/practice", label: "Practice drills", icon: Dumbbell },
  { href: "/walkthroughs", label: "Learn with Thoth", icon: MessagesSquare },
  { href: "/notebook", label: "Mistake notebook", icon: NotebookPen },
  { href: "/lessons", label: "Lessons", icon: BookText },
  { href: "/reading", label: "Daily Reading", icon: Newspaper },
  { href: "/flashcards", label: "Flashcards", icon: BookOpenCheck },
  { href: "/tutoring", label: "Tutoring", icon: CalendarClock },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  const items = [...studentNav];
  if (role === "TUTOR" || role === "ADMIN") {
    items.push({ href: "/tutor", label: "Tutor hub", icon: Users });
  }
  if (role === "ADMIN") {
    items.push({ href: "/admin", label: "Admin", icon: ShieldCheck });
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-sidebar">
      <div className="flex h-16 items-center px-4">
        <Logo href="/dashboard" />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Main">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 border-t p-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname.startsWith("/settings")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 px-3 text-muted-foreground"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
