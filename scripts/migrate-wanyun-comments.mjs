/* eslint-disable */
/**
 * One-time migration: turn each timeline_event's legacy `content_wanyun` text
 * into a per-member journey comment authored by Wanyun, now that she's joined
 * the "Wanyun & Rui" space.
 *
 *   node --env-file=.env.local scripts/migrate-wanyun-comments.mjs
 *
 * Idempotent: uses upsert on (event_id, author_id) with ignoreDuplicates, so it
 * never overwrites an existing comment and is safe to re-run. Rui's comments
 * were migrated previously and are left untouched; nothing is deleted.
 */
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// Locate the space + Wanyun's membership (no hardcoded UUIDs).
const { data: space } = await admin
  .from("spaces")
  .select("id,name")
  .ilike("name", "Wanyun & Rui")
  .maybeSingle();
if (!space) throw new Error('Space "Wanyun & Rui" not found.');

const { data: members } = await admin
  .from("space_members")
  .select("user_id")
  .eq("space_id", space.id);
const ids = (members ?? []).map((m) => m.user_id);
const { data: profs } = await admin
  .from("profiles")
  .select("id,username,first_name,last_name,handle")
  .in("id", ids);
const wanyun = (profs ?? []).find((p) =>
  [p.handle, p.first_name, p.username]
    .filter(Boolean)
    .some((v) => v.toLowerCase().includes("wanyun")),
);
if (!wanyun) throw new Error("Could not identify Wanyun in the space.");
console.log(`Space "${space.name}" (${space.id})`);
console.log(`Wanyun = ${wanyun.id} @${wanyun.handle}\n`);

// Build comment rows from non-empty content_wanyun.
const { data: events } = await admin
  .from("timeline_events")
  .select("id,title,content_wanyun")
  .eq("space_id", space.id);

const rows = (events ?? [])
  .filter((e) => (e.content_wanyun ?? "").trim() !== "")
  .map((e) => ({
    event_id: e.id,
    space_id: space.id,
    author_id: wanyun.id,
    content: e.content_wanyun,
  }));

console.log(`${rows.length} event(s) have Wanyun content to migrate.`);

const { error } = await admin
  .from("timeline_comments")
  .upsert(rows, { onConflict: "event_id,author_id", ignoreDuplicates: true });
if (error) throw new Error("upsert: " + error.message);

// Verify.
const { data: wComments } = await admin
  .from("timeline_comments")
  .select("event_id,content")
  .eq("space_id", space.id)
  .eq("author_id", wanyun.id);
const byEvent = new Map((wComments ?? []).map((c) => [c.event_id, c.content]));

let ok = 0;
for (const e of events ?? []) {
  const src = (e.content_wanyun ?? "").trim();
  if (!src) continue;
  if ((byEvent.get(e.id) ?? "").trim() === src) ok++;
  else console.log(`  ✗ mismatch on "${e.title}"`);
}
console.log(`\nWanyun now has ${wComments?.length ?? 0} comment(s); ${ok} match their source content.`);
