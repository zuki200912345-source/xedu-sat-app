import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * XeduSAT wordmark: a graduation-cap mark on the brand navy, followed by the
 * "Xedu" wordmark with a "SAT" accent. `variant="onDark"` renders for dark/navy
 * backgrounds (white mark, no tile).
 */
export function Logo({
  className,
  href = "/",
  variant = "default",
}: {
  className?: string;
  href?: string;
  variant?: "default" | "onDark";
}) {
  const onDark = variant === "onDark";
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 font-semibold", className)}
      aria-label="XeduSAT home"
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg",
          onDark ? "bg-white/10" : "bg-primary",
        )}
      >
        <GraduationCap className={cn("h-5 w-5", onDark ? "text-white" : "text-primary-foreground")} />
      </span>
      <span className={cn("text-lg tracking-tight", onDark ? "text-white" : "text-foreground")}>
        Xedu<span className={onDark ? "text-white/80" : "text-primary"}>SAT</span>
      </span>
    </Link>
  );
}
