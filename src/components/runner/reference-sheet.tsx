"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The Digital SAT Math reference sheet — the same set of area/volume formulas
 * and geometry facts shown behind the in-test "Reference" (x²) button.
 */
export function ReferenceSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Reference</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3">
            {figures.map((f) => (
              <figure key={f.label} className="flex flex-col items-center gap-2 text-center">
                <div className="flex h-24 items-center justify-center">{f.svg}</div>
                <figcaption className="font-mono text-sm">{f.label}</figcaption>
              </figure>
            ))}
          </div>

          <div className="mt-8 space-y-1.5 border-t pt-5 text-sm text-muted-foreground">
            <p>The number of degrees of arc in a circle is 360.</p>
            <p>The number of radians of arc in a circle is 2π.</p>
            <p>The sum of the measures in degrees of the angles of a triangle is 180.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const stroke = "currentColor";
const S = { fill: "none", stroke, strokeWidth: 1.5 } as const;

const figures: { label: string; svg: React.ReactNode }[] = [
  {
    label: "A = πr²",
    svg: (
      <svg viewBox="0 0 90 80" className="h-20 w-24 text-foreground">
        <circle cx="45" cy="40" r="30" {...S} />
        <line x1="45" y1="40" x2="75" y2="40" {...S} />
        <text x="56" y="35" fontSize="10" fill={stroke}>r</text>
      </svg>
    ),
  },
  {
    label: "C = 2πr",
    svg: (
      <svg viewBox="0 0 90 80" className="h-20 w-24 text-foreground">
        <circle cx="45" cy="40" r="30" {...S} />
        <circle cx="45" cy="40" r="1.5" fill={stroke} />
      </svg>
    ),
  },
  {
    label: "A = ℓw",
    svg: (
      <svg viewBox="0 0 100 80" className="h-20 w-24 text-foreground">
        <rect x="15" y="22" width="70" height="36" {...S} />
        <text x="46" y="70" fontSize="10" fill={stroke}>ℓ</text>
        <text x="2" y="43" fontSize="10" fill={stroke}>w</text>
      </svg>
    ),
  },
  {
    label: "A = ½bh",
    svg: (
      <svg viewBox="0 0 100 80" className="h-20 w-24 text-foreground">
        <path d="M15 62 L85 62 L45 18 Z" {...S} />
        <line x1="45" y1="18" x2="45" y2="62" {...S} strokeDasharray="3 3" />
        <text x="48" y="45" fontSize="10" fill={stroke}>h</text>
        <text x="46" y="74" fontSize="10" fill={stroke}>b</text>
      </svg>
    ),
  },
  {
    label: "c² = a² + b²",
    svg: (
      <svg viewBox="0 0 100 80" className="h-20 w-24 text-foreground">
        <path d="M20 62 L80 62 L20 18 Z" {...S} />
        <rect x="20" y="52" width="10" height="10" {...S} />
        <text x="6" y="42" fontSize="10" fill={stroke}>a</text>
        <text x="46" y="74" fontSize="10" fill={stroke}>b</text>
        <text x="52" y="36" fontSize="10" fill={stroke}>c</text>
      </svg>
    ),
  },
  {
    label: "Special right triangles",
    svg: (
      <svg viewBox="0 0 120 80" className="h-20 w-28 text-foreground">
        <path d="M12 62 L72 62 L12 24 Z" {...S} />
        <text x="2" y="46" fontSize="9" fill={stroke}>x</text>
        <text x="36" y="74" fontSize="9" fill={stroke}>x√3</text>
        <text x="44" y="38" fontSize="9" fill={stroke}>2x</text>
        <text x="20" y="20" fontSize="8" fill={stroke}>30°</text>
      </svg>
    ),
  },
  {
    label: "V = ℓwh",
    svg: (
      <svg viewBox="0 0 100 80" className="h-20 w-24 text-foreground">
        <rect x="20" y="30" width="45" height="30" {...S} />
        <path d="M20 30 L35 18 L80 18 L65 30" {...S} />
        <path d="M65 60 L80 48 L80 18" {...S} />
      </svg>
    ),
  },
  {
    label: "V = πr²h",
    svg: (
      <svg viewBox="0 0 90 80" className="h-20 w-24 text-foreground">
        <ellipse cx="45" cy="20" rx="24" ry="8" {...S} />
        <path d="M21 20 L21 60" {...S} />
        <path d="M69 20 L69 60" {...S} />
        <path d="M21 60 A24 8 0 0 0 69 60" {...S} />
      </svg>
    ),
  },
  {
    label: "V = 4⁄3 πr³",
    svg: (
      <svg viewBox="0 0 90 80" className="h-20 w-24 text-foreground">
        <circle cx="45" cy="40" r="28" {...S} />
        <ellipse cx="45" cy="40" rx="28" ry="9" {...S} strokeDasharray="3 3" />
      </svg>
    ),
  },
  {
    label: "V = ⅓ πr²h",
    svg: (
      <svg viewBox="0 0 90 80" className="h-20 w-24 text-foreground">
        <ellipse cx="45" cy="60" rx="24" ry="8" {...S} />
        <path d="M21 60 L45 12 L69 60" {...S} />
      </svg>
    ),
  },
  {
    label: "V = ⅓ ℓwh",
    svg: (
      <svg viewBox="0 0 100 80" className="h-20 w-24 text-foreground">
        <path d="M20 60 L70 60 L55 48 L15 48 Z" {...S} />
        <path d="M15 48 L45 14 L70 60" {...S} />
        <path d="M20 60 L45 14 L55 48" {...S} />
      </svg>
    ),
  },
];
