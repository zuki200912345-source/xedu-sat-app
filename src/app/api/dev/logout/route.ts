import { NextResponse } from "next/server";
import { DEV_COOKIE } from "@/lib/dev-portal";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEV_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
