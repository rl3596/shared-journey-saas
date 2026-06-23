import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { seedFromMock } from "@/lib/data";

// One-time helper: copies the built-in starter data into Supabase.
// Protected by the login gate (proxy). Safe to run more than once (upsert).
export async function POST() {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local and restart.",
      },
      { status: 503 },
    );
  }

  try {
    const counts = await seedFromMock();
    return NextResponse.json({ ok: true, counts });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Seed failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
