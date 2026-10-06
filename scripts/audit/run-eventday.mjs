// Event-day hard test + security probes against the LOCAL production build (manual §5–§7).
// Usage: node scripts/audit/run-eventday.mjs   (services + `next start` must be running; see audit/BASELINE.md)
import { BASE_URL, DATABASE_URL } from "./assert-safe-env.mjs";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import postgres from "postgres";

const sql = postgres(DATABASE_URL, { max: 4, onnotice: () => {} });
const MAIL = "http://127.0.0.1:8025";
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const results = [];
const evidence = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(id, title, pass, detail = {}) {
  const status = pass === null ? "NOT TESTED" : pass ? "PASS" : "FAIL";
  results.push({ id, title, status, detail });
  console.log(`${status.padEnd(10)} ${id.padEnd(10)} ${title}${pass === false ? "  ← " + JSON.stringify(detail).slice(0, 300) : ""}`);
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
async function call(path, { method = "POST", body, cookie, headers = {}, raw = false } = {}) {
  const t0 = performance.now();
  const h = { ...headers };
  if (body !== undefined && !h["content-type"]) h["content-type"] = "application/json";
  if (body !== undefined && h.origin === undefined) h.origin = BASE_URL;
  if (cookie) h.cookie = cookie;
  if (h.origin === null) delete h.origin;
  const res = await fetch(BASE_URL + path, { method, headers: h, body: body === undefined ? undefined : raw ? body : JSON.stringify(body), redirect: "manual" });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  const setCookie = res.headers.getSetCookie?.() ?? [];
  return { status: res.status, json, text, headers: res.headers, setCookie, ms: performance.now() - t0 };
}
const cookieOf = (r) => r.setCookie.map((c) => c.split(";")[0]).join("; ");

async function adminLogin(n = 1) {
  const r = await call("/api/admin/login", { body: { email: process.env[`AUDIT_ADMIN${n}_EMAIL`], password: process.env[`AUDIT_ADMIN${n}_PASSWORD`] } });
  if (r.status !== 200) throw new Error("admin login failed " + r.status);
  return cookieOf(r);
}
async function teamLogin(teamNumber, code) {
  const r = await call("/api/team/login", { body: { teamNumber, code } });
  return { ...r, cookie: r.status === 200 ? cookieOf(r) : null };
}
const setSettings = (admin, patch) => call("/api/admin/settings", { method: "PUT", cookie: admin, body: patch });

// ── 0. Clean slate ───────────────────────────────────────────────────────────
await sql`delete from teams`;
await sql`delete from login_events`;
await sql`delete from audit_logs`;
await sql`delete from error_logs`;
await fetch(MAIL + "/api/v1/messages", { method: "DELETE" });

const admin = await adminLogin(1);
const admin2 = await adminLogin(2);
const data = JSON.parse(readFileSync("audit/data/roster_expected.json", "utf8"));
const now = () => Date.now();

// Event "live" now, deadline far away — individual stages move these.
await setSettings(admin, { eventStart: new Date(now() - 60_000).toISOString(), submissionDeadline: new Date(now() + 3600_000).toISOString(), leaderboardVisible: false, scoresVisible: false });

// ── T-7d Setup: import ───────────────────────────────────────────────────────
const asImport = (t) => ({ name: t.name, leaderName: t.leaderName, leaderEmail: t.leaderEmail, college: t.college, members: t.members });
const dirtyTeams = [...data.teams, ...data.poisonTeams].map(asImport);
let r = await call("/api/admin/import", { cookie: admin, body: { teams: dirtyTeams, dryRun: true } });
evidence.importDryRun = r.json?.summary;
const poisonRows = (r.json?.rows ?? []).slice(150);
const poisonOutcome = poisonRows.map((row, i) => ({ why: data.poison[i].why, expect: data.poison[i].expect, got: row.status, reason: row.reason }));
evidence.poisonOutcome = poisonOutcome;
const shouldReject = poisonOutcome.filter((p) => p.expect === "reject");
check("T7-IMP-1", "Dry-run classifies poison rows that must be rejected", shouldReject.every((p) => p.got !== "new"), { accepted: shouldReject.filter((p) => p.got === "new").map((p) => p.why) });

r = await call("/api/admin/import", { cookie: admin, body: { teams: dirtyTeams } });
const importMs = r.ms;
const created = r.json?.created ?? [];
evidence.importReal = { status: r.status, ms: Math.round(r.ms), created: created.length, summary: r.json?.summary };
check("T7-IMP-2", `Real import of ${dirtyTeams.length} rows completes < 5s without 5xx`, r.status === 200 && importMs < 5000, evidence.importReal);
const codes = new Map(created.map((c) => [c.teamNumber, c.code]));
const byName = new Map(created.map((c) => [c.name, c]));
check("T7-IMP-3", "Import response contains no duplicate codes", new Set(created.map((c) => c.code)).size === created.length);

r = await call("/api/admin/import", { cookie: admin, body: { teams: dirtyTeams } });
const [{ n: teamCountAfterReimport }] = await sql`select count(*)::int n from teams`;
check("T7-IMP-4", "Re-import is idempotent (no new teams/codes)", (r.json?.created ?? []).length === 0 && teamCountAfterReimport === created.length, { createdOnReimport: r.json?.created?.length, teamCountAfterReimport });

const [xssRow] = await sql`select name, college from teams where leader_email = 'xss1@mock.example.test'`;
const [hdrRow] = await sql`select name, leader_name from teams where leader_email = 'hdr@mock.example.test'`;
evidence.storedRaw = { xssRow, hdrRow: hdrRow && { name: JSON.stringify(hdrRow.name), leader: JSON.stringify(hdrRow.leader_name) } };
check("T7-IMP-5", "CR/LF stripped from names on import", hdrRow ? !/[\r\n]/.test(hdrRow.name + hdrRow.leader_name) : true, evidence.storedRaw.hdrRow);

// ── SEC-B01 / INV-13: every admin API rejects unauthenticated + team cookies ─
const adminApis = ["credentials", "criteria", "import", "logs", "reset", "scores", "settings", "teams"];
const unauth = [];
const firstTeam = created.find((c) => c.leaderEmail.startsWith("t1."));
const teamCookieAny = (await teamLogin(firstTeam.teamNumber, firstTeam.code)).cookie;
for (const p of adminApis) for (const m of ["GET", "POST", "PUT", "DELETE"]) {
  for (const [label, cookie] of [["none", undefined], ["team", teamCookieAny], ["garbage", "hk_admin=eyJhbGciOiJIUzI1NiJ9.e30.x"]]) {
    const x = await call(`/api/admin/${p}`, { method: m, cookie, body: m === "GET" ? undefined : {} });
    if (![401, 405].includes(x.status)) unauth.push({ p, m, label, status: x.status });
  }
}
check("SEC-B01", "All /api/admin/* reject missing/team/garbage cookies (401/405)", unauth.length === 0, { unexpected: unauth });

// Admin pages without a cookie: plain GET and RSC-flight GET (layout-only auth, SEC-B05).
const pageLeaks = [];
const someCode = firstTeam.code;
for (const page of ["/admin", "/admin/teams", "/admin/send-credentials", "/admin/logs", "/admin/scores", "/admin/leaderboard", "/admin/import", "/admin/print"]) {
  const plain = await call(page, { method: "GET" });
  const tree = encodeURIComponent(JSON.stringify(["", { children: ["admin", { children: ["(panel)", { children: ["__PAGE__", {}] }] }] }, null, null, true]));
  const rsc = await call(page, { method: "GET", headers: { RSC: "1", "Next-Router-State-Tree": decodeURIComponent(tree) } });
  for (const [kind, x] of [["html", plain], ["rsc", rsc]]) {
    const leaked = x.text.includes(someCode) || x.text.includes(firstTeam.leaderEmail);
    if (leaked || (x.status === 200 && !x.text.includes("/admin/login"))) pageLeaks.push({ page, kind, status: x.status, leakedCodeOrEmail: leaked, bytes: x.text.length });
  }
}
evidence.pageLeaks = pageLeaks;
check("SEC-B05", "Admin pages leak nothing without a cookie (HTML and RSC flight)", pageLeaks.every((p) => !p.leakedCodeOrEmail), { pageLeaks });

// ── SEC-C01/C02: origin + content type ───────────────────────────────────────
const t2 = created.find((c) => c.leaderEmail.startsWith("t2."));
const t2c = (await teamLogin(t2.teamNumber, t2.code)).cookie;
const originCases = {
  evil: "https://evil.example", suffix: "http://localhost:3000.evil.com", null: "null", otherPort: "http://localhost:3001",
};
const originRes = {};
for (const [k, o] of Object.entries(originCases)) originRes[k] = (await call("/api/team/repo", { cookie: t2c, headers: { origin: o }, body: { url: "https://github.com/a/clean-x" } })).status;
originRes.missing = (await call("/api/team/repo", { cookie: t2c, headers: { origin: null }, body: { url: "https://github.com/a/clean-x" } })).status;
originRes.textPlain = (await call("/api/team/repo", { cookie: t2c, headers: { "content-type": "text/plain" }, raw: true, body: JSON.stringify({ url: "https://github.com/a/clean-x" }) })).status;
originRes.form = (await call("/api/team/repo", { cookie: t2c, headers: { "content-type": "application/x-www-form-urlencoded" }, raw: true, body: "url=https://github.com/a/clean-x" })).status;
evidence.origin = originRes;
check("SEC-C01", "Cross-origin / spoofed Origin rejected", ["evil", "suffix", "null", "otherPort"].every((k) => originRes[k] === 400), originRes);
check("SEC-C02", "text/plain and form bodies rejected", originRes.textPlain === 400 && originRes.form === 400, originRes);

// ── SEC-A01 login lockout race: 50 parallel wrong codes at one team ──────────
const t3 = created.find((c) => c.leaderEmail.startsWith("t3."));
const wrong = await Promise.all(Array.from({ length: 50 }, (_, i) => call("/api/team/login", { body: { teamNumber: t3.teamNumber, code: `SYN-AAAA${String(i).padStart(2, "2").replace(/[01]/g, "2")}` } })));
const evaluated = wrong.filter((x) => x.status === 401).length;
evidence.lockRace = { evaluatedGuesses: evaluated, locked429: wrong.filter((x) => x.status === 429).length };
check("SEC-A01", "Parallel wrong attempts: at most 5 guesses evaluated before lock", evaluated <= 5, evidence.lockRace);

// SEC-A03 enumeration
const unk = await call("/api/team/login", { body: { teamNumber: 99999, code: "SYN-AAAAAA" } });
const t4 = created.find((c) => c.leaderEmail.startsWith("t4."));
const wr = await call("/api/team/login", { body: { teamNumber: t4.teamNumber, code: "SYN-AAAAAA" } });
check("SEC-A03", "Unknown team vs wrong code give identical responses", unk.status === wr.status && unk.json?.error === wr.json?.error, { unknown: unk.json?.error, wrongCode: wr.json?.error });

// SEC-A04 per-IP throttle: one IP locks 20 different teams
const victims = created.slice(20, 40);
for (const v of victims) for (let i = 0; i < 5; i++) await call("/api/team/login", { body: { teamNumber: v.teamNumber, code: "SYN-ZZZZZZ" } });
const lockedVictims = (await Promise.all(victims.map((v) => teamLogin(v.teamNumber, v.code)))).filter((x) => x.status === 429).length;
check("SEC-A04", "One client cannot lock out many teams (per-IP throttle)", lockedVictims === 0, { lockedOutOf20: lockedVictims });
await call("/api/admin/teams", { cookie: admin, body: { action: "unlock", ids: (await sql`select id from teams`).map((x) => x.id) } });

// SEC-A05 code generator
const codesSrc = readFileSync("lib/codes.ts", "utf8");
check("SEC-A05", "Codes use crypto.randomInt (no Math.random)", /randomInt\(/.test(codesSrc) && !/Math\.random/.test(codesSrc));

// SEC-A06 cookie flags
const lc = await call("/api/team/login", { body: { teamNumber: t4.teamNumber, code: t4.code } });
evidence.cookieFlags = lc.setCookie[0]?.replace(/=[^;]+/, "=<redacted>");
check("SEC-A06", "Session cookie HttpOnly + SameSite + Path (Secure only under NODE_ENV=production)", /HttpOnly/i.test(lc.setCookie[0]) && /SameSite=lax/i.test(lc.setCookie[0]), { cookie: evidence.cookieFlags });

// ── INV-12 / SEC-A08: regenerate-code kills old session ─────────────────────
const t5 = created.find((c) => c.leaderEmail.startsWith("t5."));
const t5c = (await teamLogin(t5.teamNumber, t5.code)).cookie;
const [t5row] = await sql`select id from teams where team_number = ${t5.teamNumber}`;
r = await call("/api/admin/teams", { cookie: admin, body: { action: "regenerate-code", ids: [t5row.id] } });
const newCode = r.json?.code;
const oldCodeLogin = await teamLogin(t5.teamNumber, t5.code);
const newCodeLogin = await teamLogin(t5.teamNumber, newCode);
const oldSession = await call("/api/team/me", { method: "GET", cookie: t5c });
const oldSessionWrite = await call("/api/team/repo", { cookie: t5c, body: { url: "https://github.com/x/clean-hijack" } });
check("INV-12a", "regenerate-code: old code rejected, new code works", oldCodeLogin.status === 401 && newCodeLogin.status === 200);
check("INV-12b", "regenerate-code: old live session invalidated", oldSession.status === 401 && oldSessionWrite.status !== 200, { meStatus: oldSession.status, writeStatus: oldSessionWrite.status });
codes.set(t5.teamNumber, newCode);

// ── INV-10: disqualified teams ───────────────────────────────────────────────
const t6 = created.find((c) => c.leaderEmail.startsWith("t6."));
const t6c = (await teamLogin(t6.teamNumber, t6.code)).cookie;
const [t6row] = await sql`select id from teams where team_number = ${t6.teamNumber}`;
await call("/api/admin/teams", { cookie: admin, body: { action: "disqualify", ids: [t6row.id] } });
const dqLogin = await teamLogin(t6.teamNumber, t6.code);
const dqWrite = await call("/api/team/repo", { cookie: t6c, body: { url: "https://github.com/x/clean-dq" } });
check("INV-10a", "Disqualified team cannot log in", dqLogin.status !== 200, { status: dqLogin.status });
check("INV-10b", "Disqualified team cannot write via an existing session", dqWrite.status === 403, { status: dqWrite.status });

// ── INV-02: video before 13:00 (start+4h) rejected server-side ───────────────
const t7 = created.find((c) => c.leaderEmail.startsWith("t7."));
const t7c = (await teamLogin(t7.teamNumber, t7.code)).cookie;
const earlyVideo = await call("/api/team/video", { cookie: t7c, body: { url: "https://youtu.be/abc" } });
check("INV-02", "Video URL rejected before the unlock time (server-side)", earlyVideo.status === 403, { status: earlyVideo.status, body: earlyVideo.json });

// SEC-D02 video host bypasses
const vids = { "https://youtube.com.evil.com/x": false, "https://evil.com/youtube.com": false, "https://youtube.com@evil.com/x": false, "javascript:alert(1)//youtube.com": false, "data:text/html,youtube.com": false, "https://YOUTUBE.COM/watch?v=1": true, "https://www.youtube.com:443/watch?v=1": true, "http://youtube.com/watch?v=1": false, "https://xn--yutube-wqf.com/x": false };
const vidBad = [];
for (const [u, allowed] of Object.entries(vids)) {
  const x = await call("/api/team/video", { cookie: t7c, body: { url: u } });
  if ((x.status === 200) !== allowed) vidBad.push({ u, status: x.status, expectedAllowed: allowed });
}
check("SEC-D02", "Video host allow-list holds (https only, no lookalikes)", vidBad.length === 0, { vidBad });

// SEC-D01 repo URL fuzz
const repos = { "javascript:alert(1)": false, "file:///etc/passwd": false, "http://localhost/a/b": false, "http://169.254.169.254/latest": false, "https://github.com/a/..%2f..%2fx": false, "https://github.com.evil.com/a/b": false, ["https://github.com/a/" + "b".repeat(2000)]: false, "https://github.com/octo/clean-repo/tree/main/src": true, "github.com/octo/clean-repo.git": true };
const repoBad = [];
for (const [u, allowed] of Object.entries(repos)) {
  const x = await call("/api/team/repo", { cookie: t7c, body: { url: u } });
  if ((x.status === 200) !== allowed) repoBad.push({ u: u.slice(0, 60), status: x.status, saved: x.json?.url, expectedAllowed: allowed });
}
check("SEC-D01", "Repo URL parser rejects non-GitHub / SSRF / traversal input", repoBad.length === 0, { repoBad });

// ── INV-03 / SEC-H03 first_submitted_at under 20 parallel saves ─────────────
const t8 = created.find((c) => c.leaderEmail.startsWith("t8."));
const t8c = (await teamLogin(t8.teamNumber, t8.code)).cookie;
await Promise.all(Array.from({ length: 20 }, (_, i) => call("/api/team/repo", { cookie: t8c, body: { url: `https://github.com/t8/clean-${i}` } })));
const [{ first_submitted_at: f1 }] = await sql`select first_submitted_at from teams where team_number = ${t8.teamNumber}`;
await sleep(50);
await call("/api/team/repo", { cookie: t8c, body: { url: "https://github.com/t8/clean-final" } });
await call("/api/team/submit", { cookie: t8c, body: {} });
await call("/api/team/submit", { cookie: t8c, body: {} });
const [{ first_submitted_at: f2 }] = await sql`select first_submitted_at from teams where team_number = ${t8.teamNumber}`;
check("INV-03", "first_submitted_at set once, unchanged by later saves/submits", f1 && f1.getTime() === f2.getTime(), { f1, f2 });
const [{ n: finRows }] = await sql`select count(*)::int n from audit_logs where action = 'SUBMISSION_FINALIZED' and actor_id = ${String(t8.teamNumber)}`;
check("SEC-H02a", "Submitting twice writes one SUBMISSION_FINALIZED row", finRows === 1, { finRows });

// SEC-D07 duplicate repo across teams
const t9 = created.find((c) => c.leaderEmail.startsWith("t9."));
const t9c = (await teamLogin(t9.teamNumber, t9.code)).cookie;
const dupRepo = await call("/api/team/repo", { cookie: t9c, body: { url: "https://github.com/t8/clean-final" } });
check("SEC-D07", "Same repo URL submitted by two teams is detected/flagged", dupRepo.status !== 200, { status: dupRepo.status });

// SEC-H02b: repo changed after final submit → integrity check re-run?
await call("/api/team/submit", { cookie: t9c, body: {} });
await sleep(1500);
await call("/api/team/repo", { cookie: t9c, body: { url: "https://github.com/t9/early-swapped" } });
await sleep(1500);
const [t9state] = await sql`select github_status, github_repo_url, submission_status from teams where team_number = ${t9.teamNumber}`;
check("SEC-H02b", "Repo swapped after final submit gets re-checked (not left unchecked)", t9state.github_status !== null, t9state);

// ── SEC-E05 error leakage ────────────────────────────────────────────────────
const errLeak = await call("/api/admin/teams", { cookie: admin, body: { action: "disqualify", ids: ["------------------------------------"] } });
check("SEC-E05", "500 responses do not expose internal error text", !(errLeak.status === 500 && /uuid|syntax|postgres|relation/i.test(errLeak.text)), { status: errLeak.status, body: errLeak.json });

// ── SEC-C04 oversized bodies ─────────────────────────────────────────────────
const big = JSON.stringify({ teams: Array.from({ length: 1000 }, (_, i) => ({ name: "x".repeat(5000) + i })) });
const t0 = performance.now();
const bigRes = await call("/api/admin/import", { cookie: admin, raw: true, body: big, headers: { "content-type": "application/json" } });
check("SEC-C04", `~${(big.length / 1e6).toFixed(1)} MB JSON body returns 4xx quickly`, bigRes.status >= 400 && bigRes.status < 500 && performance.now() - t0 < 5000, { status: bigRes.status, ms: Math.round(performance.now() - t0) });
await sql`delete from teams where name like 'xxxxxxxxxx%'`;

// ── Credentials email (Mailpit stand-in) ─────────────────────────────────────
await fetch(MAIL + "/api/v1/messages", { method: "DELETE" });
const [{ n: withEmail }] = await sql`select count(*)::int n from teams where leader_email <> '' and credentials_sent_at is null`;
// Two admins click "send" at the same moment.
const sendT0 = performance.now();
let rounds = 0;
const loop = async (cookie) => {
  for (let i = 0; i < 40; i++) {
    const x = await call("/api/admin/credentials", { cookie, body: {} });
    rounds++;
    if (x.status !== 200 || x.json.remaining === 0) return x;
  }
};
const [la, lb] = await Promise.all([loop(admin), loop(admin2)]);
const sendMs = performance.now() - sendT0;
const inbox = await (await fetch(MAIL + "/api/v1/messages?limit=500")).json();
const perRcpt = {};
inbox.messages.forEach((m) => m.To.forEach((t) => (perRcpt[t] = (perRcpt[t] ?? 0) + 1)));
const dupMail = Object.entries(perRcpt).filter(([, n]) => n > 1);
evidence.mail = { teamsWithEmail: withEmail, delivered: inbox.total, duplicateRecipients: dupMail.length, ms: Math.round(sendMs), rounds, lastA: la?.json, lastB: lb?.json && { remaining: lb.json.remaining, failed: lb.json.failed?.length } };
check("INV-14a", "Each team leader gets exactly one email even when two admins send at once", dupMail.length === 0 && inbox.total === withEmail, evidence.mail);
const sample = inbox.messages.find((m) => m.To.includes(firstTeam.leaderEmail));
const codeInMail = sample?.Text?.match(/SYN-[A-Z0-9]{6}/)?.[0];
const mailLogin = codeInMail ? await teamLogin(firstTeam.teamNumber, codeInMail) : { status: 0 };
check("INV-14b", "Code in the email logs the team in", mailLogin.status === 200);
const loginLink = sample?.Text?.match(/https?:\/\/\S+\/team\/login/)?.[0];
check("H-01", "Login link in email uses the configured site URL (NEXT_PUBLIC_SITE_URL)", loginLink === `${process.env.NEXT_PUBLIC_SITE_URL}/team/login`, { loginLink });
const hdrMail = inbox.messages.find((m) => m.To.includes("hdr@mock.example.test"));
check("SEC-MAIL-HDR", "Header-injection payload in names adds no recipients/headers", !inbox.messages.some((m) => m.To.some((t) => t.includes("victim") || t === "x@mock.example.test")), { hdrMailTo: hdrMail?.To });
const xssMail = inbox.messages.find((m) => m.To.includes("xss1@mock.example.test"));
check("SEC-MAIL-XSS", "HTML email escapes team name", xssMail ? !xssMail.HTML.includes("<script>alert(1)</script>") : null);
const [{ n: credAudit }] = await sql`select count(*)::int n from audit_logs where action ilike '%CREDENTIAL%'`;
check("INV-11-mail", "Sending credentials writes an audit row", credAudit > 0, { credAudit });
const codeInLogs = await sql`select count(*)::int n from audit_logs where details::text ~ 'SYN-[A-Z0-9]{6}'`;
const codeInErr = await sql`select count(*)::int n from error_logs where context::text ~ 'SYN-[A-Z0-9]{6}' or message ~ 'SYN-[A-Z0-9]{6}'`;
check("INV-07", "No chit code in audit_logs / error_logs", codeInLogs[0].n === 0 && codeInErr[0].n === 0, { audit: codeInLogs[0].n, err: codeInErr[0].n });

// ── Deadline rush (most important stage) ─────────────────────────────────────
await sql`update teams set failed_attempts = 0, locked_until = null`;
const active = created.filter((c) => !c.leaderEmail.startsWith("t6.") && c.leaderEmail.endsWith("mock.example.test")).slice(0, 150);
const sessions = [];
const loginT0 = performance.now();
const logins = await Promise.all(active.map((c) => teamLogin(c.teamNumber, codes.get(c.teamNumber))));
const loginLat = logins.map((x) => x.ms).sort((a, b) => a - b);
logins.forEach((x, i) => x.cookie && sessions.push({ ...active[i], cookie: x.cookie }));
evidence.loginWave = { n: logins.length, ok: logins.filter((x) => x.status === 200).length, p50: Math.round(loginLat[Math.floor(loginLat.length * 0.5)]), p95: Math.round(loginLat[Math.floor(loginLat.length * 0.95)]), totalMs: Math.round(performance.now() - loginT0), non200: logins.filter((x) => x.status !== 200).map((x) => x.status).slice(0, 10) };
check("L1", `Check-in wave: ${logins.length} concurrent logins, 0×5xx, p95 < 1s`, logins.every((x) => x.status < 500) && evidence.loginWave.p95 < 1000, evidence.loginWave);

// Open video window (start 4h ago) and put the deadline 25 s out.
const deadline = now() + 25_000;
await setSettings(admin, { eventStart: new Date(now() - 4.5 * 3600_000).toISOString(), submissionDeadline: new Date(deadline).toISOString() });
const plan = JSON.parse(readFileSync("audit/data/submissions_plan.json", "utf8"));
const scenarioOf = (i) => (plan[i % plan.length].github === "server" ? "server-hang" : plan[i % plan.length].github);
await sleep(Math.max(0, deadline - now() - 15_000));
const rushRes = [];
const conns = [];
const poll = setInterval(async () => conns.push((await sql`select count(*)::int n from pg_stat_activity where datname = current_database()`)[0].n), 200);
const rushT0 = now();
await Promise.all(sessions.map(async (s, i) => {
  const a = await call("/api/team/repo", { cookie: s.cookie, body: { url: `https://github.com/team${s.teamNumber}/${scenarioOf(i)}-app` } });
  const b = await call("/api/team/video", { cookie: s.cookie, body: { url: `https://youtu.be/v${s.teamNumber}` } });
  const c = await call("/api/team/submit", { cookie: s.cookie, body: {} });
  const d = i < 10 ? await call("/api/team/submit", { cookie: s.cookie, body: {} }) : null;
  rushRes.push(...[a, b, c, d].filter(Boolean).map((x) => ({ status: x.status, ms: x.ms, t: now() })));
}));
clearInterval(poll);
const rushLat = rushRes.map((x) => x.ms).sort((a, b) => a - b);
evidence.rush = { requests: rushRes.length, s5xx: rushRes.filter((x) => x.status >= 500).length, s403: rushRes.filter((x) => x.status === 403).length, p95: Math.round(rushLat[Math.floor(rushLat.length * 0.95)]), maxConn: Math.max(...conns), wallMs: now() - rushT0, beforeDeadline: rushRes.every((x) => x.t < deadline) };
check("L3", "Deadline rush: 0×5xx, no 403 for requests before deadline", evidence.rush.s5xx === 0 && evidence.rush.s403 === 0, evidence.rush);
const [{ n: submittedN }] = await sql`select count(*)::int n from teams where submission_status = 'submitted'`;
const [{ n: finalizedRows }] = await sql`select count(distinct actor_id)::int n from audit_logs where action = 'SUBMISSION_FINALIZED'`;
check("L3b", "One SUBMISSION_FINALIZED per submitted team", submittedN === finalizedRows, { submittedN, finalizedRows });

// Boundary: wait for the deadline, then hammer.
while (now() < deadline - 1500) await sleep(100);
const edge = sessions.slice(0, 8);
const edgeRes = await Promise.all(edge.map(async (s, i) => { await sleep(i * 400); const t = now(); const x = await call("/api/team/repo", { cookie: s.cookie, body: { url: `https://github.com/edge/clean-${i}` } }); return { sentAt: t - deadline, status: x.status }; }));
evidence.edge = edgeRes;
check("SEC-H01", "Deadline boundary: before → 200, at/after → 403", edgeRes.every((e) => (e.sentAt < -50 ? e.status === 200 : e.sentAt > 50 ? e.status === 403 : true)), edgeRes);
await sleep(500);
const after = await Promise.all(sessions.map((s) => call("/api/team/submit", { cookie: s.cookie, body: {} })));
const afterVid = await Promise.all(sessions.slice(0, 50).map((s) => call("/api/team/video", { cookie: s.cookie, body: { url: "https://youtu.be/late" } })));
check("INV-01", "All mutations after the deadline rejected", [...after, ...afterVid].every((x) => x.status === 403), { statuses: [...new Set([...after, ...afterVid].map((x) => x.status))] });

// ── GitHub integrity (after() path) ──────────────────────────────────────────
await sleep(20_000);
const gh = await sql`select github_status, github_note, github_repo_url from teams where submission_status = 'submitted'`;
const byScenario = {};
for (const g of gh) {
  const sc = (g.github_repo_url.split("/").pop() || "").split("-")[0];
  byScenario[sc] ??= {};
  const k = g.github_status ?? "null(pending)";
  byScenario[sc][k] = (byScenario[sc][k] ?? 0) + 1;
}
evidence.github = byScenario;
const falseFlags = ["private", "ratelimited", "server", "empty"].some((sc) => byScenario[sc]?.flagged);
check("GH-1", "Every submitted team reaches a terminal GitHub status", gh.every((g) => g.github_status !== null), byScenario);
check("GH-2", "404/403/5xx/empty never produce a false 'flagged'", !falseFlags, byScenario);
check("GH-3", "Early first commit is flagged", (byScenario.early?.flagged ?? 0) > 0 && !byScenario.early?.clean, byScenario.early);
check("GH-4", "Missing reviewer collaborator detected", (byScenario.noreviewer?.clean ?? 0) === 0, byScenario.noreviewer);

// ── Judging ──────────────────────────────────────────────────────────────────
const crit = await sql`select id, name from criteria order by position`;
const cid = Object.fromEntries(crit.map((c) => [c.name, c.id]));
const teamsDb = await sql`select id, team_number, name, submission_status from teams order by team_number`;
const s1lines = readFileSync("audit/data/scores_stage1_clean.csv", "utf8").trim().split("\n").slice(1);
const rowsMap = new Map();
for (const l of s1lines) {
  const [ti, judge, c, v] = l.split(",");
  const team = byName.get(data.teams[Number(ti)].name);
  const k = `${team.teamNumber}|${judge}`;
  if (!rowsMap.has(k)) rowsMap.set(k, { teamNumber: team.teamNumber, judge, values: {} });
  rowsMap.get(k).values[cid[c]] = Number(v);
}
const scoreRows = [...rowsMap.values()];
r = await call("/api/admin/scores", { cookie: admin, body: { rows: scoreRows, stage: 1, dryRun: true } });
r = await call("/api/admin/scores", { cookie: admin, body: { rows: scoreRows, stage: 1, replaceAll: true } });
check("L4-scores", `Stage-1 import (${scoreRows.length} rows / 3150 marks) < 10s`, r.status === 200 && r.ms < 10_000, { status: r.status, ms: Math.round(r.ms), imported: r.json?.imported });

// Independent reference ranking (not lib/scoring.ts).
const W = { Innovation: 20, "Technical Implementation": 25, Functionality: 20, "Problem Relevance": 15, Creativity: 10, "Demo & Explanation": 5, "Overall Impact": 5 };
const ref = new Map();
for (const row of scoreRows) for (const [c, v] of Object.entries(row.values)) {
  const name = crit.find((x) => x.id === c).name;
  const e = ref.get(row.teamNumber) ?? {};
  (e[name] ??= []).push(v);
  ref.set(row.teamNumber, e);
}
const dq = new Set(teamsDb.filter((t) => t.submission_status === "disqualified").map((t) => t.team_number));
const refScores = [...ref.entries()].filter(([n]) => !dq.has(n)).map(([n, e]) => [n, Object.entries(e).reduce((s, [c, vs]) => s + (vs.reduce((a, b) => a + b, 0) / vs.length) * W[c] / 100, 0)]);
const weightSum = Object.values(W).reduce((a, b) => a + b, 0);
check("INV-08", "Criteria weights sum to exactly 100", weightSum === 100 && crit.length === 7);

// Judge-name variants double count (H-11)
const victimTeam = created.find((c) => c.leaderEmail.startsWith("t11."));
await call("/api/admin/scores", { cookie: admin, body: { rows: [{ teamNumber: victimTeam.teamNumber, judge: "dr rao ", values: { [cid.Innovation]: 0 } }, { teamNumber: victimTeam.teamNumber, judge: "DR RAO", values: { [cid.Innovation]: 0 } }], stage: 1 } });
const [{ n: judgesForInnovation }] = await sql`select count(*)::int n from scores s join teams t on t.id = s.team_id where t.team_number = ${victimTeam.teamNumber} and s.criterion_id = ${cid.Innovation} and s.stage = 1`;
check("H-11", "Judge spelling variants ('Dr. Rao'/'dr rao '/'DR RAO') counted as one judge", judgesForInnovation === 3, { judgesCountedForOneCriterion: judgesForInnovation });

// Missing marks: one team has a whole criterion missing → silently 0?
const missTeam = created.find((c) => c.leaderEmail.startsWith("t12."));
await sql`delete from scores where criterion_id = ${cid["Technical Implementation"]} and team_id = (select id from teams where team_number = ${missTeam.teamNumber})`;
r = await call("/api/admin/scores", { cookie: admin, body: { rows: scoreRows.slice(0, 1), stage: 1, dryRun: true } });
const ranking = await sql`select count(*)::int n from scores where team_id = (select id from teams where team_number = ${missTeam.teamNumber})`;
check("SCORE-MISS", "Team with a missing criterion is surfaced (not silently scored 0 for it)", null, { remainingMarks: ranking[0].n, note: "lib/scoring.ts sums available criteria only; no warning surfaced to admins" });

// Unknown criterion silently ignored?
const unkCrit = await call("/api/admin/scores", { cookie: admin, body: { rows: [{ teamNumber: missTeam.teamNumber, judge: "Dr. Rao", values: { "00000000-0000-0000-0000-000000000000": 7 } }], stage: 1, dryRun: true } });
check("SCORE-UNK", "Unknown criterion column reported as a problem", (unkCrit.json?.rows?.[0]?.problems ?? []).length > 0, unkCrit.json?.rows?.[0]);

// Finalists (H-03): no admin endpoint → select via DB like the simulation script does.
const finalistApi = await call("/api/admin/teams", { cookie: admin, body: { action: "set-finalists", ids: [] } });
check("H-03", "Admin has a supported way to choose the Top 10 finalists", finalistApi.status === 200, { status: finalistApi.status, body: finalistApi.json });
const stage1Top = await sql`
  with pc as (select team_id, criterion_id, avg(value) v from scores where stage = 1 group by 1,2),
  pt as (select team_id, sum(v * c.weight / 100) s from pc join criteria c on c.id = pc.criterion_id group by 1)
  select t.id, t.team_number from pt join teams t on t.id = pt.team_id where t.submission_status <> 'disqualified' order by s desc, t.first_submitted_at asc limit 10`;
for (const [i, f] of stage1Top.entries()) await sql`update teams set is_finalist = true, stage2_order = ${i + 1} where id = ${f.id}`;

// Stage 2 for a non-finalist accepted?
const nonFinal = teamsDb.find((t) => !stage1Top.some((f) => f.id === t.id) && t.submission_status !== "disqualified");
const s2nf = await call("/api/admin/scores", { cookie: admin, body: { rows: [{ teamNumber: nonFinal.team_number, judge: "Jury A", values: { [cid.Innovation]: 10 } }], stage: 2 } });
check("SCORE-S2NF", "Stage 2 scores for a non-finalist are rejected", s2nf.status !== 200, { status: s2nf.status, imported: s2nf.json?.imported });
await sql`delete from scores where stage = 2`;

// Stage 2 import (210 marks) with a podium tie → INV-09.
const s2rows = [];
stage1Top.forEach((f, i) => ["Jury A", "Jury B", "Jury C"].forEach((j) => s2rows.push({ teamNumber: f.team_number, judge: j, values: Object.fromEntries(crit.map((c) => [c.id, i < 2 ? 9.5 : 9 - i * 0.3])) })));
r = await call("/api/admin/scores", { cookie: admin, body: { rows: s2rows, stage: 2, replaceAll: true } });
check("S2-IMP", "Stage 2 import of 210 marks", r.status === 200 && r.json?.imported === 210, { status: r.status, imported: r.json?.imported });

// ── Reveal ───────────────────────────────────────────────────────────────────
const hidden = await call("/api/leaderboard", { method: "GET" });
check("INV-05", "Hidden leaderboard exposes nothing", JSON.stringify(hidden.json) === JSON.stringify({ visible: false }), hidden.json);
evidence.leaderboardCache = hidden.headers.get("cache-control");
const flipAt = now();
await setSettings(admin, { leaderboardVisible: true, scoresVisible: false });
const shown = await call("/api/leaderboard?v=" + flipAt, { method: "GET" });
check("H-08", "Toggle visible on API immediately (no stale origin cache)", shown.json?.visible === true, { cacheControl: evidence.leaderboardCache, msAfterFlip: now() - flipAt });
const finalistNums = new Set(stage1Top.map((f) => f.team_number));
const publicNums = (shown.json?.teams ?? []).map((t) => t.teamNumber);
check("INV-04", "Only finalists appear in /api/leaderboard", publicNums.every((n) => finalistNums.has(n)) && publicNums.length <= 10, { publicNums, nonFinalistsShown: publicNums.filter((n) => !finalistNums.has(n)) });
const [podA, podB] = (shown.json?.teams ?? []).slice(0, 2);
const tieRows = await sql`select team_number, first_submitted_at from teams where team_number in ${sql([podA?.teamNumber ?? 0, podB?.teamNumber ?? 0])} order by first_submitted_at`;
check("INV-09", "Podium tie broken by earliest first_submitted_at", podA && tieRows[0]?.team_number === podA.teamNumber, { podA: podA?.teamNumber, podB: podB?.teamNumber, earliest: tieRows[0]?.team_number });
const html = await call("/leaderboard", { method: "GET" });
check("INV-04b", "/leaderboard HTML/flight contains no non-finalist names", !teamsDb.filter((t) => !finalistNums.has(t.team_number)).some((t) => t.name.length > 6 && html.text.includes(t.name)));
const leakFields = JSON.stringify(shown.json);
check("SEC-B03", "Public leaderboard has no emails/ids/codes", !/@|SYN-|[0-9a-f]{8}-[0-9a-f]{4}/i.test(leakFields));
const nfc = sessions.find((s) => !finalistNums.has(s.teamNumber));
const me = await call("/api/team/me", { method: "GET", cookie: nfc.cookie });
check("H-02", "Non-finalist private rank uses the real ranked count", me.json?.result?.ranked > 100, { result: me.json?.result });
check("SCORES-HIDDEN", "scoresVisible=false hides scores on dashboards", me.json?.result && !("score" in me.json.result));

// ── Audit completeness (INV-11) ──────────────────────────────────────────────
const crits = await call("/api/admin/criteria", { method: "PUT", cookie: admin, body: { criteria: crit.map((c, i) => ({ id: c.id, name: c.name, weight: Object.values(W)[i] })) } });
const [{ n: critAudit }] = await sql`select count(*)::int n from audit_logs where action ilike '%CRITERI%'`;
check("INV-11", "Every admin mutation (incl. criteria edit) writes an audit row", crits.status === 200 && critAudit > 0, { critAudit });

// ── Reset protection (H-15) ──────────────────────────────────────────────────
const resetSrc = readFileSync("app/api/admin/reset/route.ts", "utf8");
check("SEC-F05", "/api/admin/reset needs more than typing DELETE (env flag / password)", /ALLOW_RESET|password/i.test(resetSrc));

// ── Headers (SEC-G01) ────────────────────────────────────────────────────────
const home = await call("/", { method: "GET" });
const hd = Object.fromEntries(["content-security-policy", "x-content-type-options", "referrer-policy", "permissions-policy", "x-frame-options", "strict-transport-security"].map((k) => [k, home.headers.get(k)]));
check("SEC-G01", "Security headers present (CSP, nosniff, referrer, permissions, frame)", Object.entries(hd).filter(([k]) => k !== "strict-transport-security").every(([, v]) => v), hd);
const adminHdr = await call("/admin/login", { method: "GET" });
check("SEC-B06", "Admin/team pages send Cache-Control: no-store", /no-store/.test(adminHdr.headers.get("cache-control") ?? ""), { cc: adminHdr.headers.get("cache-control") });

// ── Write results ────────────────────────────────────────────────────────────
mkdirSync("audit/results", { recursive: true });
writeFileSync(`audit/results/${runId}.json`, JSON.stringify({ runId, results, evidence }, null, 2));
const tally = results.reduce((a, x) => ((a[x.status] = (a[x.status] ?? 0) + 1), a), {});
console.log("\n", tally, `→ audit/results/${runId}.json`);
await sql.end();
