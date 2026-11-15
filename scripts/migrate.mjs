// Applies the files in migrations/ that this database has not had yet, then exits.
// It runs before every build (npm run build), so deploying applies database changes automatically.
//
//  - Each file runs once, in order, and is recorded in the schema_migrations table.
//  - All pending files run in one transaction under a lock, so two builds at once cannot collide,
//    and a failed file changes nothing and fails the build (the previous version keeps running).
//  - Files must be safe to run twice (create ... if not exists, add column if not exists).
//  - With no DATABASE_URL (for example a build with no database) it does nothing and succeeds.
//  - SKIP_DB_MIGRATE=1 turns it off.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env"); // reads .env.local the way Next does; real environment variables win
const { Client } = require("pg");

loadEnvConfig(process.cwd());

if (process.env.SKIP_DB_MIGRATE === "1") {
  console.log("migrate: SKIP_DB_MIGRATE is set, skipping.");
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.log("migrate: DATABASE_URL is not set, skipping.");
  process.exit(0);
}

const dir = process.env.MIGRATIONS_DIR || path.join(process.cwd(), "migrations");
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d+.*\.sql$/.test(f)).sort() : [];

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 20_000,
});

try {
  await client.connect();
  await client.query("begin");
  // A transaction-level lock works through Neon's pooled connections. A second build waits here, then finds nothing to do.
  await client.query("set local lock_timeout = '60s'");
  await client.query("select pg_advisory_xact_lock(7243001)");
  await client.query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await client.query("select name from schema_migrations")).rows.map((r) => r.name));
  const pending = files.filter((f) => !done.has(f));
  for (const file of pending) {
    await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
    await client.query("insert into schema_migrations (name) values ($1)", [file]);
    console.log(`migrate: applied ${file}`);
  }
  await client.query("commit");
  if (pending.length === 0) console.log(`migrate: database is up to date (${files.length} migration${files.length === 1 ? "" : "s"}).`);
} catch (err) {
  try { await client.query("rollback"); } catch { /* the connection may already be gone */ }
  console.error(`migrate: FAILED, nothing was changed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
