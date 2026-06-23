"use client";

import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Browser Supabase client for Client Components (login/register forms, the
 * sign-out action in the avatar menu). Reads/writes the session cookie so it
 * stays in sync with the server client.
 */
export function createClient() {
  return createBrowserClient(url, anonKey);
}
