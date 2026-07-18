import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyDevPassword, issueDevToken, DEV_COOKIE } from "@/lib/dev-portal";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  // Throttle password attempts hard (brute-force protection).
  const ip = clientIp((n) => req.headers.get(n));
  const rl = rateLimit(`dev-login:${ip}`, 8, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const ok = await verifyDevPassword(parsed.data.password);
  if (!ok) return NextResponse.json({ error: "Incorrect password" }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEV_COOKIE, issueDevToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return res;
}
