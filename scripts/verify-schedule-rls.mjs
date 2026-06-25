/**
 * Throwaway-user verification of schedule_events RLS + the new
 * creator/participant model. Run:
 *   node --env-file=.env.local scripts/verify-schedule-rls.mjs
 *
 * Creates an owner, a member (joined to the owner's space), and an outsider.
 * Exercises every rule, then deletes all three users (cascades clean up).
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error("Missing env vars.");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

let passed = 0;
let failed = 0;
function check(label, ok) {
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${label}`);
  if (ok) passed++;
  else failed++;
}

async function makeUser(tag) {
  const email = `verify-${tag}-${Date.now()}@example.com`;
  const password = "Test-passw0rd!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser ${tag}: ${error.message}`);
  // Sign in via anon client to get an RLS-scoped session.
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr) throw new Error(`signIn ${tag}: ${signErr.message}`);
  return { id: data.user.id, email, client };
}

const created = [];
async function cleanup() {
  for (const id of created) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}

async function main() {
  // --- setup ---
  const owner = await makeUser("owner");
  created.push(owner.id);
  const member = await makeUser("member");
  created.push(member.id);
  const outsider = await makeUser("outsider");
  created.push(outsider.id);

  // Give the signup trigger a moment, then find the owner's auto-provisioned space.
  await new Promise((r) => setTimeout(r, 800));
  const { data: ownerSpaces } = await admin
    .from("space_members")
    .select("space_id, role")
    .eq("user_id", owner.id);
  const ownerSpaceId = ownerSpaces?.find((s) => s.role === "owner")?.space_id
    ?? ownerSpaces?.[0]?.space_id;
  check("owner has an auto-provisioned space", Boolean(ownerSpaceId));
  if (!ownerSpaceId) throw new Error("no owner space");

  // Add member to the owner's space (service-role; simulates accepted invite).
  const { error: joinErr } = await admin
    .from("space_members")
    .insert({ space_id: ownerSpaceId, user_id: member.id, role: "member" });
  check("member joined the owner's space", !joinErr);

  const insertEvent = (client, extra) =>
    client
      .from("schedule_events")
      .insert({
        id: randomUUID(),
        space_id: ownerSpaceId,
        title: "T",
        date: "2030-01-01",
        time: "12:00",
        notes: "",
        ...extra,
      })
      .select("id,creator_id,participant_ids")
      .single();

  // A) Owner creates a personal event; trigger auto-stamps creator_id.
  const a = await insertEvent(owner.client, {});
  check("owner creates personal event (creator auto-set)",
    !a.error && a.data?.creator_id === owner.id);
  const ownerEventId = a.data?.id;

  // B) Member creates own personal event.
  const b = await insertEvent(member.client, {});
  check("member creates own personal event",
    !b.error && b.data?.creator_id === member.id);
  const memberEventId = b.data?.id;

  // C) Owner creates a JOINT event including the member.
  const c = await insertEvent(owner.client, { participant_ids: [member.id] });
  check("owner creates joint event with member as participant",
    !c.error && c.data?.participant_ids?.includes(member.id));
  const jointEventId = c.data?.id;

  // D) Member can SELECT all events in the shared space (incl. owner's + joint).
  const { data: memberView } = await member.client
    .from("schedule_events")
    .select("id")
    .eq("space_id", ownerSpaceId);
  const ids = new Set((memberView ?? []).map((r) => r.id));
  check("member sees owner's personal + joint events (shared calendar)",
    ids.has(ownerEventId) && ids.has(jointEventId) && ids.has(memberEventId));

  // E) Member CANNOT update the owner's event (RLS by creator_id).
  await member.client
    .from("schedule_events")
    .update({ title: "HACKED" })
    .eq("id", ownerEventId);
  const { data: afterUpd } = await admin
    .from("schedule_events")
    .select("title")
    .eq("id", ownerEventId)
    .single();
  check("member CANNOT edit owner's event", afterUpd?.title === "T");

  // F) Member CANNOT delete the owner's event.
  await member.client.from("schedule_events").delete().eq("id", ownerEventId);
  const { data: afterDel } = await admin
    .from("schedule_events")
    .select("id")
    .eq("id", ownerEventId)
    .maybeSingle();
  check("member CANNOT delete owner's event", afterDel?.id === ownerEventId);

  // G) Member CAN edit their own event.
  await member.client
    .from("schedule_events")
    .update({ title: "MINE" })
    .eq("id", memberEventId);
  const { data: ownUpd } = await admin
    .from("schedule_events")
    .select("title")
    .eq("id", memberEventId)
    .single();
  check("member CAN edit own event", ownUpd?.title === "MINE");

  // H) Member CANNOT spoof creator_id as the owner on insert.
  const spoof = await insertEvent(member.client, { creator_id: owner.id });
  check("member CANNOT spoof creator_id (insert rejected)", Boolean(spoof.error));

  // I) Outsider (not in the space) sees no events and cannot insert.
  const { data: outView } = await outsider.client
    .from("schedule_events")
    .select("id")
    .eq("space_id", ownerSpaceId);
  check("outsider sees no events in a space they're not in",
    (outView ?? []).length === 0);
  const outIns = await insertEvent(outsider.client, {});
  check("outsider CANNOT insert into a space they're not in", Boolean(outIns.error));

  // J) Member CAN delete their own event.
  await member.client.from("schedule_events").delete().eq("id", memberEventId);
  const { data: ownDel } = await admin
    .from("schedule_events")
    .select("id")
    .eq("id", memberEventId)
    .maybeSingle();
  check("member CAN delete own event", !ownDel);
}

main()
  .catch((e) => {
    console.error("ERROR:", e.message);
    failed++;
  })
  .finally(async () => {
    await cleanup();
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
