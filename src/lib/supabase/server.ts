import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Cookie-based Supabase client for Server Components, Route Handlers, and
 * Server Actions. It carries the signed-in user's session, so every query
 * runs under Row Level Security — the user only ever sees their space's rows.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // In a pure Server Component the cookie store is read-only; the
        // try/catch lets those render passes no-op while Route Handlers and
        // Server Actions (which can write) refresh the session normally.
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* read-only context — session refresh handled by proxy.ts */
        }
      },
    },
  });
}
