import { Fragment } from "react";

/**
 * Lightweight plain-text math prettifier for Math items. The question bank
 * stores plain text (e.g. "x^2", "sqrt(9)", "pi", "<="), which this renders as
 * x², √(9), π, ≤. It is deliberately simple — not a full LaTeX engine — and is
 * only applied to MATH-section content so prose is never altered.
 */
function swapSymbols(input: string): string {
  return input
    .replace(/<=/g, "≤")
    .replace(/>=/g, "≥")
    .replace(/!=/g, "≠")
    .replace(/\bsqrt\s*\(/gi, "√(")
    .replace(/\bpi\b/g, "π")
    .replace(/\btheta\b/g, "θ")
    .replace(/\bdegrees?\b/g, "°")
    .replace(/(\d|\))\s*\*\s*(?=[a-zA-Z(\d])/g, "$1·")
    .replace(/\+\/-/g, "±");
}

/** Split on caret-superscripts (^2, ^{n+1}, ^x) and render them as <sup>. */
export function MathText({ children }: { children: string }) {
  const text = swapSymbols(children);
  const parts = text.split(/(\^\{[^}]+\}|\^-?\w)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("^")) {
          const raw = part.slice(1).replace(/^\{|\}$/g, "");
          return <sup key={i}>{raw}</sup>;
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

/** Convenience: render math for MATH section, plain text otherwise. */
export function QuestionText({ section, children }: { section: string; children: string }) {
  if (section === "MATH") return <MathText>{children}</MathText>;
  return <>{children}</>;
}
