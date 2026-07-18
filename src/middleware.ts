import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role;
    const { pathname } = req.nextUrl;

    const inAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
    // Note: use an exact/prefixed check so "/tutoring" is NOT caught by "/tutor".
    const inTutor = pathname === "/tutor" || pathname.startsWith("/tutor/");

    if (inAdmin && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    if (inTutor && role !== "TUTOR" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
  },
);

// Everything under these prefixes requires a session; role checks above.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/practice/:path*",
    "/session/:path*",
    "/tests/:path*",
    "/lessons/:path*",
    "/reading/:path*",
    "/diagnostic/:path*",
    "/flashcards/:path*",
    "/tutoring/:path*",
    "/analytics/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/tutor/:path*",
  ],
};
