import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { compare } from "bcryptjs";

// Hidden developer-dashboard access. The password is NEVER in client code or
// the repo — only a bcrypt hash lives in the DEV_DASHBOARD_PASSWORD_HASH env
// var, checked here on the server. Access is carried by a short-lived HMAC-
// signed cookie so the data endpoints stay protected server-side.

export const DEV_COOKIE = "xedu_dev";
const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function signingKey(): string {
  // Reuse the app secret; both are server-only.
  return process.env.NEXTAUTH_SECRET || "xedu-dev-fallback-secret";
}

/** Verify a submitted password against the bcrypt hash in the environment. */
export async function verifyDevPassword(password: string): Promise<boolean> {
  const hash = process.env.DEV_DASHBOARD_PASSWORD_HASH;
  if (!hash || typeof password !== "string" || password.length === 0) return false;
  try {
    return await compare(password, hash);
  } catch {
    return false;
  }
}

/** Issue a signed session token: "<expiryMs>.<hmac>". */
export function issueDevToken(): string {
  const exp = String(Date.now() + TTL_MS);
  const sig = createHmac("sha256", signingKey()).update(exp).digest("hex");
  return `${exp}.${sig}`;
}

/** Validate a session token (signature + not expired). */
export function isDevAuthed(token: string | undefined | null): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  const expected = createHmac("sha256", signingKey()).update(exp).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return Number(exp) > Date.now();
}
