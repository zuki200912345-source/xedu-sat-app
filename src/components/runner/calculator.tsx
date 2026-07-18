"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator: (el: HTMLElement, opts?: Record<string, unknown>) => { destroy?: () => void };
    };
  }
}

// The Desmos graphing calculator (same product used in Bluebook). Configure a
// key via NEXT_PUBLIC_DESMOS_API_KEY; without one, the basic calculator is used.
// (Desmos keys are public/client-side by design — never put a secret here.)
const DESMOS_KEY = process.env.NEXT_PUBLIC_DESMOS_API_KEY ?? "";
const DESMOS_SRC = `https://www.desmos.com/api/v1.12/calculator.js?apiKey=${DESMOS_KEY}`;

/** Minimal safe on-screen calculator, used only if the Desmos script fails. */
function BasicCalculator() {
  const [display, setDisplay] = useState("0");
  function press(key: string) {
    setDisplay((d) => {
      if (key === "C") return "0";
      if (key === "=") {
        try {
          if (!/^[-+*/.()\d\s]+$/.test(d)) return "Error";
          const result = Function(`"use strict"; return (${d})`)();
          return String(Number.isFinite(result) ? +result.toPrecision(12) : "Error");
        } catch {
          return "Error";
        }
      }
      if (d === "0" || d === "Error") return key;
      return d + key;
    });
  }
  const keys = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "=", "+"];
  return (
    <div className="p-3">
      <div className="mb-2 rounded-md border bg-muted px-3 py-2 text-right font-mono text-lg" aria-live="polite">
        {display}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <Button variant="outline" className="col-span-4" onClick={() => press("C")}>Clear</Button>
        {keys.map((k) => (
          <Button key={k} variant={["/", "*", "-", "+", "="].includes(k) ? "secondary" : "outline"} className="h-10" onClick={() => press(k)}>
            {k === "*" ? "×" : k === "/" ? "÷" : k}
          </Button>
        ))}
      </div>
    </div>
  );
}

function DesmosCalculator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let calc: { destroy?: () => void } | undefined;
    let cancelled = false;

    function mount() {
      if (cancelled || !containerRef.current || !window.Desmos) return;
      calc = window.Desmos.GraphingCalculator(containerRef.current, {
        keypad: true,
        expressions: true,
        settingsMenu: true,
        zoomButtons: true,
      });
    }

    if (window.Desmos) {
      mount();
    } else {
      let script = document.querySelector<HTMLScriptElement>("script[data-desmos]");
      if (!script) {
        script = document.createElement("script");
        script.src = DESMOS_SRC;
        script.async = true;
        script.dataset.desmos = "true";
        script.onerror = () => setFailed(true);
        document.body.appendChild(script);
      }
      script.addEventListener("load", mount);
    }
    return () => {
      cancelled = true;
      calc?.destroy?.();
    };
  }, []);

  if (failed) return <BasicCalculator />;
  return <div ref={containerRef} className="h-full w-full" />;
}

/** Floating, draggable-position calculator panel toggled from the top bar. */
export function CalculatorPanel({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed left-4 top-24 z-50 flex h-[460px] w-[380px] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl"
      role="dialog"
      aria-label="Calculator"
    >
      <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">Calculator</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} aria-label="Close calculator">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1">
        {DESMOS_KEY ? <DesmosCalculator /> : <BasicCalculator />}
      </div>
    </div>
  );
}
