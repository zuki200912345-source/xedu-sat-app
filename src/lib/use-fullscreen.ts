"use client";

import { useEffect } from "react";

/**
 * Enter browser fullscreen while the component is mounted (tests/practice).
 * Attempts immediately (works when the navigation gesture is preserved) and
 * falls back to the user's first interaction; exits fullscreen on unmount.
 */
export function useFullscreenSession() {
  useEffect(() => {
    const el = document.documentElement;
    const enter = () => {
      if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    };
    enter();

    const onFirst = () => {
      enter();
      cleanup();
    };
    function cleanup() {
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
    }
    window.addEventListener("pointerdown", onFirst);
    window.addEventListener("keydown", onFirst);

    return () => {
      cleanup();
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);
}
