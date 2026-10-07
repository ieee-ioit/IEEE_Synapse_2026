// Shared helpers for tests/regression/*.mjs (local only — never pushed).
import { BASE_URL, DATABASE_URL } from "../../scripts/audit/assert-safe-env.mjs";
import postgres from "postgres";

export { BASE_URL };
export const sql = postgres(DATABASE_URL, { max: 4, onnotice: () => {} });

export async function call(path, { method = "POST", body, cookie, headers = {}, raw = false, base = BASE_URL } = {}) {
  const h = { ...headers };
  if (body !== undefined && !h["content-type"]) h["content-type"] = "application/json";
  if (body !== undefined && h.origin === undefined) h.origin = base;
  if (cookie) h.cookie = cookie;
  const t0 = performance.now();
  const r = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : raw ? body : JSON.stringify(body), redirect: "manual" });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, text, json, headers: r.headers, setCookie: r.headers.getSetCookie(), ms: performance.now() - t0 };
}
export const cookieOf = (r) => r.setCookie.map((c) => c.split(";")[0]).join("; ");

export async function adminLogin(n = 1, base = BASE_URL) {
  const r = await call("/api/admin/login", { base, body: { email: process.env[`AUDIT_ADMIN${n}_EMAIL`], password: process.env[`AUDIT_ADMIN${n}_PASSWORD`] } });
  if (r.status !== 200) throw new Error(`admin login ${r.status} ${r.text.slice(0, 100)}`);
  return cookieOf(r);
}
export async function teamLogin(teamNumber, code, headers = {}) {
  const r = await call("/api/team/login", { body: { teamNumber, code }, headers });
  return { ...r, cookie: r.status === 200 ? cookieOf(r) : null };
}

/** Imports `n` throwaway teams tagged `prefix` and returns [{teamNumber, code, name, leaderEmail, id}]. */
export async function seedTeams(admin, prefix, n) {
  await sql`delete from teams where leader_email like ${prefix + "-%"}`;
  const teams = Array.from({ length: n }, (_, i) => ({ name: `${prefix} team ${i}`, leaderName: `L${i}`, leaderEmail: `${prefix}-${i}@mock.example.test`, college: "PICT", members: [] }));
  const r = await call("/api/admin/import", { cookie: admin, body: { teams } });
  const created = r.json?.created ?? [];
  if (created.length !== n) throw new Error(`seed failed ${r.status} ${r.text.slice(0, 200)}`);
  const ids = await sql`select id, team_number from teams where leader_email like ${prefix + "-%"}`;
  const idBy = new Map(ids.map((x) => [x.team_number, x.id]));
  return created.map((c) => ({ ...c, id: idBy.get(c.teamNumber) }));
}
export const cleanup = (prefix) => sql`delete from teams where leader_email like ${prefix + "-%"}`;

const results = [];
export function check(id, title, pass, detail = {}) {
  results.push({ id, title, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id.padEnd(10)} ${title}${pass ? "" : "  ← " + JSON.stringify(detail).slice(0, 400)}`);
}
export async function finish(name) {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${name}: ${results.length - failed.length}/${results.length} passed`);
  await sql.end();
  process.exit(failed.length ? 1 : 0);
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
