"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppSidebar } from "@/components/app-sidebar";
import type { Role } from "@/lib/enums";

/**
 * App shell with a collapsible navigation sidebar. A hamburger (three-bar)
 * button in the slim top bar toggles it — on mobile the sidebar overlays with a
 * backdrop; on desktop it collapses the column to reclaim space.
 */
export function AppShell({ role, hideDiagnostic, children }: { role: Role; hideDiagnostic?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const closeOnMobile = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) setOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "z-40 h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out",
          "max-md:absolute max-md:shadow-2xl",
          open ? "w-60" : "w-0",
        )}
      >
        <div className="h-full w-60">
          <AppSidebar role={role} hideDiagnostic={hideDiagnostic} onNavigate={closeOnMobile} />
        </div>
      </div>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Hide navigation" : "Show navigation"}
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          {!open && (
            <span className="text-sm font-semibold tracking-tight">
              Xedu<span className="text-primary">SAT</span>
            </span>
          )}
        </header>
        <main className="xedu-grid flex-1 overflow-y-auto bg-secondary/30">
          <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
