import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

// Rotating pastel accents matching the xedu stat-card look.
export const STAT_ACCENTS = {
  blue: { chip: "bg-blue-100 text-blue-600", bar: "bg-blue-400" },
  purple: { chip: "bg-violet-100 text-violet-600", bar: "bg-violet-400" },
  green: { chip: "bg-emerald-100 text-emerald-600", bar: "bg-emerald-400" },
  amber: { chip: "bg-amber-100 text-amber-600", bar: "bg-amber-400" },
  navy: { chip: "bg-primary/10 text-primary", bar: "bg-primary" },
} as const;

export type StatAccent = keyof typeof STAT_ACCENTS;

/** xedu stat card: big value, label, pastel icon chip, colored top accent. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "navy",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ReactNode;
  accent?: StatAccent;
}) {
  const a = STAT_ACCENTS[accent];
  return (
    <Card className="relative overflow-hidden">
      <div className={cn("absolute inset-x-0 top-0 h-1", a.bar)} />
      <CardContent className="flex items-start justify-between gap-3 pt-6">
        <div>
          <div className="text-3xl font-bold tabular-nums">{value}</div>
          <div className="mt-1 text-sm font-medium text-muted-foreground">{label}</div>
          {hint && <div className="mt-0.5 text-xs text-muted-foreground/80">{hint}</div>}
        </div>
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", a.chip)}>
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}
