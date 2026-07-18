// Lightweight in-memory rate limiter (fixed-window). Protects abuse-prone and
// cost-bearing endpoints (auth, registration, AI calls).
//
// NOTE: state is per-process. On a single server or low-traffic serverless it
// works well; for horizontally-scaled production, back this with a shared store
// (e.g. Upstash Redis / Vercel KV) using the same interface.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

/** Consume one unit against `key`. Returns whether the call is allowed. */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();

  // Opportunistically evict expired buckets so memory stays bounded.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
  }

  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  b.count++;
  return { ok: true, remaining: limit - b.count, retryAfterSec: 0 };
}

/** Best-effort client IP from proxy headers (works behind Vercel/most proxies). */
export function clientIp(get: (name: string) => string | null | undefined): string {
  const xff = get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return get("x-real-ip")?.trim() || "unknown";
}

// Central place to tune limits.
export const LIMITS = {
  register: { limit: 5, windowMs: 60_000 }, // 5 sign-ups / min / IP
  login: { limit: 10, windowMs: 5 * 60_000 }, // 10 attempts / 5 min / IP+email
  aiSummary: { limit: 20, windowMs: 60 * 60_000 }, // 20 AI analyses / hour / user
} as const;
