// Drops and recreates the local test database, applies schema + migrations twice, creates the two
// audit admins. Usage: node scripts/audit/fresh-db.mjs   (APP_DIR = app checkout to take migrations from)
import { DATABASE_URL } from "./assert-safe-env.mjs";
import { execFileSync } from "node:child_process";
import postgres from "postgres";

const url = new URL(DATABASE_URL);
const name = url.pathname.slice(1);
if (!/^synapse_(audit|main|ev)$/.test(name)) throw new Error(`refusing to recreate database "${name}"`);
url.pathname = "/postgres";
const admin = postgres(url.toString(), { max: 1, onnotice: () => {} });
await admin`select pg_terminate_backend(pid) from pg_stat_activity where datname = ${name} and pid <> pg_backend_pid()`;
await admin.unsafe(`drop database if exists ${name}`);
await admin.unsafe(`create database ${name} encoding 'UTF8' template template0 lc_collate 'C' lc_ctype 'C'`);
await admin.end();
const db = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
for (const role of ["anon", "authenticated", "service_role"]) await db.unsafe(`create role ${role} nologin`).catch(() => {});
await db.end();

const run = (args) => execFileSync(process.execPath, args, { cwd: process.env.APP_DIR, env: process.env, stdio: "pipe" }).toString().trim().split("\n").pop();
console.log(run(["scripts/db-setup.mjs"]));
console.log(run(["scripts/db-setup.mjs"]), "(second run)");
for (const n of [1, 2]) console.log(run(["scripts/create-admin.mjs", "--name", `Audit ${n}`, "--email", process.env[`AUDIT_ADMIN${n}_EMAIL`], "--password", process.env[`AUDIT_ADMIN${n}_PASSWORD`]]));
