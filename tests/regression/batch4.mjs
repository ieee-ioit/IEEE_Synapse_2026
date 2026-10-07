// Batch 4 regression: BP-005/013/014/015/016/018/022/025/027/029 (BP-020 is measured in the full run).
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { call, adminLogin, teamLogin, seedTeams, cleanup, sql, check, finish, sleep } from "./lib.mjs";

const MAIL = "http://127.0.0.1:8025";
const admin = await adminLogin(1);
const admin2 = await adminLogin(2);
const act = (body, cookie = admin) => call("/api/admin/teams", { cookie, body });

// ── BP-005: two admins send at once → one email per leader ──────────────────
{
  await sql`update teams set credentials_sent_at = now() where credentials_sent_at is null`;
  const teams = await seedTeams(admin, "b4mail", 30);
  await fetch(MAIL + "/api/v1/messages", { method: "DELETE" });
  const loop = async (cookie) => {
    for (let i = 0; i < 20; i++) {
      const r = await call("/api/admin/credentials", { cookie, body: {} });
      if (r.status !== 200 || r.json.remaining === 0 || r.json.sent.length === 0) return r;
    }
  };
  await Promise.all([loop(admin), loop(admin2)]);
  const inbox = await (await fetch(MAIL + "/api/v1/messages")).json();
  const per = {};
  inbox.messages.forEach((m) => m.To.forEach((t) => (per[t] = (per[t] ?? 0) + 1)));
  const ours = Object.entries(per).filter(([t]) => t.startsWith("b4mail-"));
  check("BP-005", "two admins sending at once: exactly one email per leader", ours.length === 30 && ours.every(([, n]) => n === 1), { leaders: ours.length, duplicates: ours.filter(([, n]) => n > 1).length });
  const [audit] = await sql`select details::text d from audit_logs where action = 'CREDENTIALS_EMAILED' order by id desc limit 1`;
  check("BP-014a", "credential sends write CREDENTIALS_EMAILED (counts/team numbers, no codes)", audit && /teamNumbers/.test(audit.d) && !/SYN-[A-Z0-9]{6}/.test(audit.d), { d: audit?.d?.slice(0, 120) });
  const codeInMail = inbox.messages.find((m) => m.To.includes(teams[0].leaderEmail))?.Text?.match(/SYN-[A-Z0-9]{6}/)?.[0];
  check("BP-005b", "emailed code logs the team in", codeInMail && (await teamLogin(teams[0].teamNumber, codeInMail)).status === 200);
  await cleanup("b4mail");
}

const teams = await seedTeams(admin, "b4", 6);

// ── BP-013: generic errors with a reference ─────────────────────────────────
{
  const r = await act({ action: "disqualify", ids: ["------------------------------------"] });
  const ref = r.json?.requestId;
  const [logged] = ref ? await sql`select message from error_logs where context::text like ${"%" + ref + "%"}` : [];
  check("BP-013", "500s return a generic message + reference; details only in error_logs", r.status === 500 && !/uuid|syntax|postgres/i.test(r.text) && /Reference/.test(r.json?.error) && Boolean(logged), { status: r.status, body: r.json, loggedMessage: logged?.message?.slice(0, 60) });
}

// ── BP-014: criteria edits audited; failed team actions not audited ─────────
{
  const crit = await sql`select id, name, weight::float8 w from criteria order by position`;
  const put = await call("/api/admin/criteria", { method: "PUT", cookie: admin, body: { criteria: crit.map((c) => ({ id: c.id, name: c.name, weight: c.w })) } });
  const [{ n }] = await sql`select count(*)::int n from audit_logs where action = 'CRITERIA_UPDATED'`;
  check("BP-014b", "criteria edit writes CRITERIA_UPDATED", put.status === 200 && n >= 1, { status: put.status, n });
  const before = (await sql`select count(*)::int n from audit_logs where action = 'TEAM_REGENERATE_CODE'`)[0].n;
  const bad = await act({ action: "regenerate-code", ids: [teams[0].id, teams[1].id] });
  const after = (await sql`select count(*)::int n from audit_logs where action = 'TEAM_REGENERATE_CODE'`)[0].n;
  check("BP-014c", "a rejected team action is not logged as done", bad.status === 400 && after === before, { status: bad.status, before, after });
  await act({ action: "unlock", ids: [teams[0].id] });
  const [{ n: unlockRows }] = await sql`select count(*)::int n from audit_logs where action = 'TEAM_UNLOCK' and details::text like ${"%" + teams[0].id + "%"}`;
  check("BP-014d", "a successful team action is logged", unlockRows === 1, { unlockRows });
}

// ── BP-015: reset needs ALLOW_RESET + password + DELETE ─────────────────────
{
  const off = await call("/api/admin/reset", { cookie: admin, body: { scope: "scores", confirm: "DELETE", password: process.env.AUDIT_ADMIN1_PASSWORD } });
  check("BP-015a", "reset refused when ALLOW_RESET is not set (403)", off.status === 403 && /ALLOW_RESET/.test(off.json?.error), { status: off.status, body: off.json });
  const port = 3298;
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], { cwd: process.env.APP_DIR, env: { ...process.env, ALLOW_RESET: "1" }, stdio: "ignore" });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base + "/api/health")).ok) break; } catch {} await sleep(500); }
  let a;
  try { a = await adminLogin(1, base); } catch (e) { a = ""; }
  const wrongPw = await call("/api/admin/reset", { base, cookie: a, body: { scope: "scores", confirm: "DELETE", password: "not-the-password" } });
  const noDelete = await call("/api/admin/reset", { base, cookie: a, body: { scope: "scores", confirm: "delete", password: process.env.AUDIT_ADMIN1_PASSWORD } });
  const good = await call("/api/admin/reset", { base, cookie: a, body: { scope: "scores", confirm: "DELETE", password: process.env.AUDIT_ADMIN1_PASSWORD } });
  child.kill();
  check("BP-015b", "with ALLOW_RESET=1: wrong password 403, missing DELETE 400, all three → 200", wrongPw.status === 403 && noDelete.status === 400 && good.status === 200, { wrongPw: wrongPw.status, noDelete: noDelete.status, good: good.status });
}

// ── BP-022: https only ──────────────────────────────────────────────────────
{
  const now = Date.now();
  await call("/api/admin/settings", { method: "PUT", cookie: admin, body: { eventStart: new Date(now - 5 * 3600_000).toISOString(), submissionDeadline: new Date(now + 3600_000).toISOString(), videoUnlockAt: "" } });
  const c = (await teamLogin(teams[2].teamNumber, teams[2].code)).cookie;
  const httpVid = await call("/api/team/video", { cookie: c, body: { url: "http://youtube.com/watch?v=1" } });
  const httpsVid = await call("/api/team/video", { cookie: c, body: { url: "https://youtube.com/watch?v=1" } });
  const httpRepo = await call("/api/team/repo", { cookie: c, body: { url: "http://github.com/b4/clean-x" } });
  const bareRepo = await call("/api/team/repo", { cookie: c, body: { url: "github.com/b4/clean-x" } });
  check("BP-022", "http:// video and repo links rejected; https and bare github.com accepted", httpVid.status === 400 && httpsVid.status === 200 && httpRepo.status === 400 && bareRepo.status === 200, { httpVid: httpVid.status, httpsVid: httpsVid.status, httpRepo: httpRepo.status, bareRepo: bareRepo.status });
  await call("/api/admin/settings", { method: "PUT", cookie: admin, body: { eventStart: "2026-10-09T09:00:00+05:30", submissionDeadline: "2026-10-09T15:00:00+05:30", videoUnlockAt: "" } });
}

// ── BP-016 / BP-027: shared repo and README in the teams table ───────────────
{
  await sql`update teams set github_repo_url = 'https://github.com/b4/noreadme-shared' where id in ${sql([teams[3].id, teams[4].id])}`;
  await act({ action: "recheck-github", ids: [teams[3].id] });
  const [row] = await sql`select github_status, github_has_readme from teams where id = ${teams[3].id}`.catch(() => [{ error: "column github_has_readme missing" }]);
  const page = await call("/admin/teams", { method: "GET", cookie: admin });
  check("BP-016", "teams table marks a repo shared by two teams", /shared repo/.test(page.text));
  check("BP-027", "README missing is stored and shown, status unchanged", row.github_has_readme === false && row.github_status === "clean" && /no README/.test(page.text), row);
}

// ── BP-018 / BP-025 / BP-029 ────────────────────────────────────────────────
{
  const sched = await call("/schedule", { method: "GET" });
  check("BP-018", "schedule says to create the repo only after 09:00", /Create your GitHub repo only after 09:00/.test(sched.text));
  const h = sched.headers;
  check("BP-025", "nosniff, DENY, referrer, Permissions-Policy and report-only CSP sent; CSP not enforced",
    h.get("x-content-type-options") === "nosniff" && h.get("x-frame-options") === "DENY" && !!h.get("referrer-policy") && !!h.get("permissions-policy") && !!h.get("content-security-policy-report-only") && !h.get("content-security-policy"),
    { pp: h.get("permissions-policy"), cspro: !!h.get("content-security-policy-report-only"), csp: h.get("content-security-policy") });
  const nextVersion = JSON.parse(readFileSync(`${process.env.APP_DIR}/node_modules/next/package.json`, "utf8")).version;
  check("BP-029", "Next.js on the latest 15.5.x patch (15.5.27)", nextVersion === "15.5.27", { nextVersion });
}

await cleanup("b4");
await finish("Batch 4");
