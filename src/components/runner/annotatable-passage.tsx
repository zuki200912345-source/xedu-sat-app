"use client";

import { useRef } from "react";
import { Stimulus } from "@/components/runner/stimulus";

/**
 * Wraps the passage with a basic highlight/annotation tool. When `active`, a
 * text selection inside the passage is wrapped in a yellow <mark>. Highlights
 * are per-question (the container is keyed by question, so they reset on
 * navigation) — matching the in-test "Annotate" affordance.
 */
export function AnnotatablePassage({
  content,
  graphSpec,
  active,
}: {
  content: string;
  graphSpec: unknown | null;
  active: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMouseUp() {
    if (!active || !ref.current) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!ref.current.contains(range.commonAncestorContainer)) return;
    const mark = document.createElement("mark");
    mark.className = "rounded-sm bg-yellow-200 text-inherit";
    try {
      range.surroundContents(mark);
      sel.removeAllRanges();
    } catch {
      // Selection spanned multiple elements — ignore (best-effort highlight).
    }
  }

  return (
    <div
      ref={ref}
      onMouseUp={onMouseUp}
      className={active ? "cursor-text selection:bg-yellow-200" : undefined}
    >
      <Stimulus content={content} graphSpec={graphSpec} />
    </div>
  );
}
