import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

// Thoth — the xedu AI tutor. A navy circle with a white scholar glyph.
export function ThothAvatar({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full bg-primary text-primary-foreground",
        className ?? "h-9 w-9",
      )}
      aria-hidden
    >
      <GraduationCap className="h-1/2 w-1/2" />
    </span>
  );
}
