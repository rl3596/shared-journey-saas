import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, getSessionToken } from "@/lib/auth";

// Pages reachable without logging in.
const PUBLIC_PATHS = new Set<string>(["/login"]);

// Renamed from Middleware in Next.js 16. Runs (Node.js runtime) before every matched
// request and gates the whole site behind the shared password.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow the login endpoint so the password can be submitted.
  if (pathname === "/api/login") return NextResponse.next();
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && token === getSessionToken()) return NextResponse.next();

  // Not authenticated.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Run on everything except Next internals and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
