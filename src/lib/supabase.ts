import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** True when both Supabase env vars are present. When false, the app uses mock data. */
export const isSupabaseConfigured = Boolean(url && serviceKey);

let cached: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the service-role key (bypasses RLS).
 * Returns null when Supabase isn't configured, so callers can fall back to mock data.
 */
export function getSupabase(): SupabaseClient | null {
  if (!url || !serviceKey) return null;
  if (!cached) {
    cached = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
