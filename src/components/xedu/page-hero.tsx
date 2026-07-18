import { cn } from "@/lib/utils";

/**
 * xedu-style hero banner: navy gradient card with an uppercase eyebrow, a big
 * bold heading, a muted subtitle, and optional right-aligned actions.
 */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "xedu-hero relative overflow-hidden rounded-3xl px-7 py-8 text-white sm:px-9 sm:py-9",
        className,
      )}
    >
      {/* soft decorative orbs */}
      <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute right-24 top-10 h-40 w-40 rounded-full bg-white/[0.04]" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
              {eyebrow}
            </div>
          )}
          <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-2xl text-sm text-white/70 sm:text-base">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
