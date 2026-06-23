/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * One-time data migration: copy content from the OLD single-tenant Supabase
 * project into the NEW multi-tenant project, stamping every row with your new
 * space_id.
 *
 * Usage (Node 20+, loads vars from .env.local):
 *   node --env-file=.env.local scripts/migrate-to-space.js
 *
 * Required env vars (see .env.example):
 *   OLD_SUPABASE_URL                 old project URL
 *   OLD_SUPABASE_SERVICE_ROLE_KEY    old project service-role key
 *   NEXT_PUBLIC_SUPABASE_URL         new project URL
 *   SUPABASE_SERVICE_ROLE_KEY        new project service-role key
 *   MIGRATION_TARGET_SPACE_ID        the space_id (uuid) to inject
 *
 * Add --dry-run to preview counts without writing.
 *
 * NOTE: this copies database ROWS only. Photo files still live in the OLD
 * project's Storage bucket — image_urls keep pointing there. Copying storage
 * objects across projects is a separate step (keep the old project alive, or
 * re-upload). The service-role keys bypass RLS, which is why we can write into
 * any space_id.
 */

const { createClient } = require("@supabase/supabase-js");

const DRY_RUN = process.argv.includes("--dry-run");

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`✗ Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

const OLD_URL = need("OLD_SUPABASE_URL");
const OLD_KEY = need("OLD_SUPABASE_SERVICE_ROLE_KEY");
const NEW_URL = need("NEXT_PUBLIC_SUPABASE_URL");
const NEW_KEY = need("SUPABASE_SERVICE_ROLE_KEY");
const SPACE_ID = need("MIGRATION_TARGET_SPACE_ID");

const oldDb = createClient(OLD_URL, OLD_KEY, {
  auth: { persistSession: false },
});
const newDb = createClient(NEW_URL, NEW_KEY, {
  auth: { persistSession: false },
});

// Per-table column allow-lists. Only these columns are read from the old DB and
// written to the new one (so stale/removed columns like `description` are
// dropped). space_id is added to every row.
const TABLES = {
  timeline_events: [
    "id",
    "date",
    "title",
    "content_rui",
    "content_wanyun",
    "location",
    "image",
  ],
  albums: [
    "id",
    "title",
    "location",
    "date",
    "end_date",
    "cover_image_url",
    "pinned_at",
    "image_urls",
    "latitude",
    "longitude",
  ],
  schedule_events: ["id", "owner", "title", "date", "time", "notes"],
};

function pick(row, columns) {
  const out = {};
  for (const c of columns) if (row[c] !== undefined) out[c] = row[c];
  return out;
}

async function verifyTargetSpace() {
  const { data, error } = await newDb
    .from("spaces")
    .select("id, name")
    .eq("id", SPACE_ID)
    .maybeSingle();
  if (error) {
    console.error(`✗ Could not query target space: ${error.message}`);
    process.exit(1);
  }
  if (!data) {
    console.error(
      `✗ Space ${SPACE_ID} not found in the NEW project. Sign up first, then copy your space_id from the space_members table.`,
    );
    process.exit(1);
  }
  console.log(`✓ Target space: "${data.name}" (${data.id})`);
}

async function migrateTable(table, columns) {
  const { data: rows, error } = await oldDb.from(table).select(columns.join(","));
  if (error) {
    console.error(`✗ Read ${table} failed: ${error.message}`);
    return { table, read: 0, written: 0, ok: false };
  }
  const read = rows?.length ?? 0;
  if (read === 0) {
    console.log(`• ${table}: 0 rows`);
    return { table, read: 0, written: 0, ok: true };
  }

  const toWrite = rows.map((r) => ({ ...pick(r, columns), space_id: SPACE_ID }));

  if (DRY_RUN) {
    console.log(`• ${table}: ${read} rows (dry-run, not written)`);
    return { table, read, written: 0, ok: true };
  }

  // Upsert on id so re-running is idempotent.
  const { error: writeErr } = await newDb
    .from(table)
    .upsert(toWrite, { onConflict: "id" });
  if (writeErr) {
    console.error(`✗ Write ${table} failed: ${writeErr.message}`);
    return { table, read, written: 0, ok: false };
  }
  console.log(`✓ ${table}: ${read} rows migrated`);
  return { table, read, written: read, ok: true };
}

async function main() {
  console.log(
    `\nMigrating from\n  ${OLD_URL}\nto\n  ${NEW_URL}\nspace_id: ${SPACE_ID}${
      DRY_RUN ? "  (DRY RUN)" : ""
    }\n`,
  );
  await verifyTargetSpace();

  const results = [];
  for (const [table, columns] of Object.entries(TABLES)) {
    results.push(await migrateTable(table, columns));
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n── summary ──");
  for (const r of results) {
    console.log(
      `  ${r.ok ? "✓" : "✗"} ${r.table}: read ${r.read}, written ${r.written}`,
    );
  }
  if (failed.length) {
    console.error(`\nDone with ${failed.length} error(s).`);
    process.exit(1);
  }
  console.log(
    `\nDone.${DRY_RUN ? " (dry run — nothing written)" : ""} Photo files still live in the old project's Storage.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
