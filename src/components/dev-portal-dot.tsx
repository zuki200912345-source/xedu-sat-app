"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// A deliberately subtle entry point for the internal developer dashboard: a
// tiny, low-opacity dot fixed in the bottom-right on every page. No tooltip,
// no label. Clicking opens a password prompt; the check happens server-side.
export function DevPortalDot() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/dev/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setOpen(false);
      setPassword("");
      router.push("/dev");
    } else {
      setError(res?.status === 429 ? "Too many attempts." : "Incorrect password.");
    }
  }

  return (
    <>
      <button
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          right: 6,
          bottom: 6,
          width: 9,
          height: 9,
          borderRadius: 9999,
          background: "#000",
          opacity: 0.05,
          zIndex: 2147483647,
          padding: 0,
          border: "none",
          cursor: "default",
        }}
      />
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 2147483647,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
            className="w-72 space-y-3 rounded-xl bg-white p-5 shadow-2xl"
          >
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-md border border-input px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? "…" : "Enter"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
