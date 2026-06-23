import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Renamed from Middleware in Next.js 16. Runs before every matched request:
// refreshes the Supabase session cookie and redirects unauthenticated users
// to /login (API routes get a 401 instead).
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on everything except Next internals, the favicon, and common static
  // image assets (so auth cookies still refresh on page + API requests).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
