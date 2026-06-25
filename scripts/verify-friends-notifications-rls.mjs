/**
 * Throwaway-user verification of Phase 3 RLS (friendships + notifications) and
 * the enriched DEFINER read RPCs. Run AFTER applying
 * migration-phase3-friends-notifications.sql:
 *
 *   node --env-file=.env.local scripts/verify-friends-notifications-rls.mjs
 *
 * Creates three users (A, B, C), exercises every rule, then deletes them.
 */
import { createClient } from "@supabase/supabase-js";

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
  const email = `verify-p3-${tag}-${Date.now()}@example.com`;
  const password = "Test-passw0rd!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser ${tag}: ${error.message}`);
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr) throw new Error(`signIn ${tag}: ${signErr.message}`);
  return { id: data.user.id, email, client };
}

const created = [];
async function cleanup() {
  for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => {});
}

async function main() {
  const A = await makeUser("a");
  created.push(A.id);
  const B = await makeUser("b");
  created.push(B.id);
  const C = await makeUser("c");
  created.push(C.id);

  // A's auto-provisioned space.
  await new Promise((r) => setTimeout(r, 800));
  const { data: aSpaces } = await admin
    .from("space_members")
    .select("space_id, role, spaces(name)")
    .eq("user_id", A.id);
  const aSpace = aSpaces?.find((s) => s.role === "owner");
  const aSpaceId = aSpace?.space_id;
  const aSpaceName = aSpace?.spaces?.name ?? aSpace?.spaces?.[0]?.name;
  check("A has an auto-provisioned space", Boolean(aSpaceId));

  // 1) A sends friend request to B.
  const ins = await A.client
    .from("friendships")
    .insert({ requester_id: A.id, addressee_id: B.id, status: "pending" })
    .select("id")
    .single();
  check("A creates a pending friendship A→B", !ins.error && Boolean(ins.data?.id));
  const friendshipId = ins.data?.id;

  // 2) Duplicate pair (B→A) blocked by the unordered-pair unique index.
  const dup = await B.client
    .from("friendships")
    .insert({ requester_id: B.id, addressee_id: A.id, status: "pending" });
  check("duplicate friendship for the same pair is rejected", Boolean(dup.error));

  // 3) Forge: C cannot insert a friendship claiming A is the requester.
  const forgeF = await C.client
    .from("friendships")
    .insert({ requester_id: A.id, addressee_id: C.id, status: "pending" });
  check("C CANNOT forge a friendship as another requester", Boolean(forgeF.error));

  // 4) A creates the friend_request notification to B. The sender CANNOT read
  //    it back (it's addressed to B), so insert with return=minimal and fetch
  //    the id via the admin client.
  const notifIns = await A.client.from("notifications").insert({
    user_id: B.id,
    sender_id: A.id,
    type: "friend_request",
    reference_id: friendshipId,
    message: "hi",
  });
  check("A creates a friend_request notification to B", !notifIns.error);
  const { data: adminNotif } = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", B.id)
    .eq("type", "friend_request")
    .eq("reference_id", friendshipId)
    .maybeSingle();
  const notifId = adminNotif?.id;

  // The sender cannot read a notification addressed to someone else.
  const { data: aReadBack } = await A.client
    .from("notifications")
    .select("id")
    .eq("id", notifId);
  check("sender A CANNOT read a notification addressed to B", (aReadBack ?? []).length === 0);

  // 5) Forge: C cannot insert a notification claiming A is the sender.
  const forgeN = await C.client
    .from("notifications")
    .insert({ user_id: B.id, sender_id: A.id, type: "friend_request" });
  check("C CANNOT forge a notification as another sender", Boolean(forgeN.error));

  // 6) B sees the notification via the enriched RPC (sender name resolved).
  const { data: bNotifs } = await B.client.rpc("get_notifications");
  const got = (bNotifs ?? []).find((n) => n.id === notifId);
  check("B sees the friend_request via get_notifications", Boolean(got));
  check("notification is enriched with the sender's name", Boolean(got?.sender_name));

  // 7) C does NOT see B's notification.
  const { data: cNotifs } = await C.client.rpc("get_notifications");
  check(
    "C does NOT see B's notification",
    !(cNotifs ?? []).some((n) => n.id === notifId),
  );

  // 8) C cannot read the A–B friendship row.
  const { data: cView } = await C.client
    .from("friendships")
    .select("id")
    .eq("id", friendshipId);
  check("C cannot read someone else's friendship", (cView ?? []).length === 0);

  // 9) B accepts: flips status, which B (the addressee) is allowed to do.
  const acc = await B.client
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", friendshipId);
  check("B (addressee) can accept the request", !acc.error);
  const { data: afterAcc } = await admin
    .from("friendships")
    .select("status")
    .eq("id", friendshipId)
    .single();
  check("friendship is now accepted", afterAcc?.status === "accepted");

  // 10) Both sides see each other via get_friends_overview.
  const { data: aOv } = await A.client.rpc("get_friends_overview");
  const { data: bOv } = await B.client.rpc("get_friends_overview");
  check(
    "A's overview lists B as an accepted friend",
    (aOv ?? []).some((r) => r.other_id === B.id && r.status === "accepted"),
  );
  check(
    "B's overview lists A as an accepted friend",
    (bOv ?? []).some((r) => r.other_id === A.id && r.status === "accepted"),
  );

  // 11) A cannot delete B's notification (not addressed to A).
  await A.client.from("notifications").delete().eq("id", notifId);
  const { data: stillThere } = await admin
    .from("notifications")
    .select("id")
    .eq("id", notifId)
    .maybeSingle();
  check("A CANNOT delete a notification addressed to B", Boolean(stillThere));

  // 12) Space invite: A invites B to A's space; B can read the space NAME via
  //     the DEFINER RPC even though B is not (yet) a member.
  const spInv = await A.client.from("notifications").insert({
    user_id: B.id,
    sender_id: A.id,
    type: "space_invite",
    reference_id: aSpaceId,
  });
  check("A creates a space_invite notification to B", !spInv.error);
  const { data: bNotifs2 } = await B.client.rpc("get_notifications");
  const inviteRow = (bNotifs2 ?? []).find(
    (n) => n.type === "space_invite" && n.reference_id === aSpaceId,
  );
  check(
    "B sees the space name on the invite without being a member",
    inviteRow?.space_name === aSpaceName,
  );

  // 13) B is NOT yet a member of A's space (no auto-join from the invite).
  const { data: preMember } = await admin
    .from("space_members")
    .select("user_id")
    .eq("space_id", aSpaceId)
    .eq("user_id", B.id)
    .maybeSingle();
  check("invite alone does NOT add B to the space", !preMember);
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
