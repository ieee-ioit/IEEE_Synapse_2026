// BP-001 regression: admin pages and APIs must not leak team data to non-admins.
// Usage (from the audit checkout): BASE_URL=http://localhost:3100 DATABASE_URL=... node tests/regression/bp-001-admin-auth.mjs
// Exits 1 on any leak. Local only — never pushed (repo is public).
import { BASE_URL, DATABASE_URL } from "../../scripts/audit/assert-safe-env.mjs";
import { SignJWT } from "jose";
import postgres from "postgres";

const sql = postgres(DATABASE_URL, { max: 2, onnotice: () => {} });
const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
const call = async (path, { method = "GET", cookie, headers = {}, body } = {}) => {
  const h = { ...headers };
  if (cookie) h.cookie = cookie;
  if (body !== undefined) Object.assign(h, { "content-type": "application/json", origin: BASE_URL });
  const r = await fetch(BASE_URL + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
  return { status: r.status, text: await r.text(), location: r.headers.get("location"), setCookie: r.headers.getSetCookie() };
};

// ── Seed: admin session + 3 teams with known codes ───────────────────────────
const login = await call("/api/admin/login", { method: "POST", body: { email: process.env.AUDIT_ADMIN1_EMAIL, password: process.env.AUDIT_ADMIN1_PASSWORD } });
if (login.status !== 200) throw new Error(`admin login ${login.status}`);
const adminCookie = login.setCookie[0].split(";")[0];
await sql`delete from teams where leader_email like 'bp001-%'`;
const seed = [1, 2, 3].map((i) => ({ name: `Leaky Team ${i} Zq${i}`, leaderName: `Leader ${i}`, leaderEmail: `bp001-${i}@mock.example.test`, college: "PICT", members: [] }));
const imp = await call("/api/admin/import", { method: "POST", cookie: adminCookie, body: { teams: seed } });
const created = JSON.parse(imp.text).created ?? [];
if (created.length !== 3) throw new Error(`seed import failed: ${imp.status} ${imp.text.slice(0, 200)}`);
const secrets = created.flatMap((c) => [c.code, c.leaderEmail, c.name]);
const teamLogin = await call("/api/team/login", { method: "POST", body: { teamNumber: created[0].teamNumber, code: created[0].code } });
const teamCookie = teamLogin.setCookie[0].split(";")[0];
const [admin] = await sql`select id from admins limit 1`;
const jwt = (claims, exp) => new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setSubject(claims.sub).setIssuedAt(exp - 60).setExpirationTime(exp).sign(secret);
const now = Math.floor(Date.now() / 1000);
const expiredAdmin = `hk_admin=${await jwt({ kind: "admin", sub: admin.id }, now - 3600)}`;
const tamperedAdmin = adminCookie.slice(0, -4) + (adminCookie.endsWith("AAAA") ? "BBBB" : "AAAA");
const teamKindInAdminSlot = `hk_admin=${await jwt({ kind: "team", sub: admin.id }, now + 3600)}`;

const cookies = { none: undefined, expired: expiredAdmin, tampered: tamperedAdmin, team: teamCookie, teamKindAsAdmin: teamKindInAdminSlot };
const tree = JSON.stringify(["", { children: ["admin", { children: ["(panel)", { children: ["__PAGE__", {}] }] }] }, null, null, true]);
const variants = {
  plain: { path: "", headers: {} },
  rsc: { path: "", headers: { RSC: "1" } },
  prefetch: { path: "", headers: { RSC: "1", "Next-Router-Prefetch": "1" } },
  rscQuery: { path: "?_rsc=x", headers: { RSC: "1" } },
  stateTree: { path: "", headers: { RSC: "1", "Next-Router-State-Tree": encodeURIComponent(tree) } },
};

const pages = ["/admin", "/admin/teams", "/admin/scores", "/admin/leaderboard", "/admin/send-credentials", "/admin/import", "/admin/logs", "/admin/print"];
const apis = ["credentials", "criteria", "import", "logs", "reset", "scores", "settings", "teams"];
const failures = [];
let checks = 0;

for (const page of pages) for (const [ck, cookie] of Object.entries(cookies)) for (const [vk, v] of Object.entries(variants)) {
  const r = await call(page + v.path, { cookie, headers: v.headers });
  checks++;
  const leaked = secrets.filter((s) => r.text.includes(s));
  const okStatus = (r.status >= 300 && r.status < 400) || r.status === 401 || r.status === 403 || r.status === 404;
  // RSC requests can't receive an HTTP 3xx: Next.js answers 200 with a flight payload whose only
  // instruction is NEXT_REDIRECT → /admin/login. Accept that only if no admin-only markup is present.
  const rscRedirect = r.status === 200 && r.text.includes("NEXT_REDIRECT;replace;/admin/login;307");
  // Prefetch of a dynamic route: Next.js returns only the route tree with null segment data (nothing rendered).
  const emptyPrefetch = vk === "prefetch" && r.status === 200 && r.text.length < 400 && r.text.includes("null,[null,null],true]]");
  const adminMarkup = /admin-bar|admin-h1|Audit One|Audit Two/.test(r.text);
  if (leaked.length || adminMarkup || !(okStatus || rscRedirect || emptyPrefetch)) {
    failures.push({ page, cookie: ck, variant: vk, status: r.status, bytes: r.text.length, leaked: leaked.length, adminMarkup });
  }
}
for (const p of apis) for (const m of ["GET", "POST", "PUT", "DELETE"]) for (const [ck, cookie] of Object.entries(cookies)) {
  const r = await call(`/api/admin/${p}`, { method: m, cookie, body: m === "GET" ? undefined : {} });
  checks++;
  const leaked = secrets.filter((s) => r.text.includes(s));
  if (leaked.length || ![401, 403, 404, 405].includes(r.status)) failures.push({ api: p, method: m, cookie: ck, status: r.status, leaked: leaked.length, body: r.text.slice(0, 120) });
}

// Positive control: a real admin still sees the data (the test isn't vacuous).
const control = await call("/admin/teams", { cookie: adminCookie });
const controlOk = control.status === 200 && control.text.includes(created[0].code);

await sql`delete from teams where leader_email like 'bp001-%'`;
await sql.end();
console.log(`BP-001: ${checks} probes, ${failures.length} failures; admin control ${controlOk ? "OK" : "FAILED"}`);
for (const f of failures.slice(0, 400)) console.log("  FAIL", JSON.stringify(f));
if (failures.length > 40) console.log(`  … ${failures.length - 40} more`);
process.exit(failures.length || !controlOk ? 1 : 0);
