"use client";

import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Browser Supabase client for Client Components (login/register forms, the
 * sign-out action in the avatar menu, realtime subscriptions). Reads/writes the
 * session cookie so it stays in sync with the server client.
 *
 * Memoized to a single instance per tab so all realtime channels share ONE
 * WebSocket connection instead of opening a socket per subscriber.
 */
// Infer the precise client type from a concrete call (using
// `ReturnType<typeof createBrowserClient>` on the generic function would
// broaden the type and break realtime `.on()` payload inference).
function makeClient() {
  return createBrowserClient(url, anonKey);
}

let browserClient: ReturnType<typeof makeClient> | null = null;

export function createClient() {
  if (!browserClient) browserClient = makeClient();
  return browserClient;
}
