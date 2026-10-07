// Batch 2 regression: BP-006/007/008/009/011/023/026/028/030.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { SignJWT } from "jose";
import { call, adminLogin, teamLogin, seedTeams, cleanup, sql, check, finish, sleep } from "./lib.mjs";

const admin = await adminLogin();
const teams = await seedTeams(admin, "b2", 40);
const ip = (n) => ({ "x-forwarded-for": `10.0.0.${n}` });
const act = (action, ids) => call("/api/admin/teams", { cookie: admin, body: { action, ids } });

// ── BP-006 ───────────────────────────────────────────────────────────────────
{
  const t = teams[0];
  const s = (await teamLogin(t.teamNumber, t.code, ip(1))).cookie;
  const regen = await act("regenerate-code", [t.id]);
  const me = await call("/api/team/me", { method: "GET", cookie: s });
  const write = await call("/api/team/repo", { cookie: s, body: { url: "https://github.com/b2/clean-x" } });
  check("BP-006a", "regenerate-code ends the old session (read and write)", regen.status === 200 && me.status === 401 && write.status === 401, { me: me.status, write: write.status });
  const fresh = await teamLogin(t.teamNumber, regen.json.code, ip(1));
  check("BP-006b", "new code works after regenerate", fresh.status === 200);

  const d = teams[1];
  const ds = (await teamLogin(d.teamNumber, d.code, ip(1))).cookie;
  await act("disqualify", [d.id]);
  const dLogin = await teamLogin(d.teamNumber, d.code, ip(1));
  const dMe = await call("/api/team/me", { method: "GET", cookie: ds });
  const dWrite = await call("/api/team/repo", { cookie: ds, body: { url: "https://github.com/b2/clean-dq" } });
  check("BP-006c", "disqualified team cannot log in", dLogin.status === 403, { status: dLogin.status, body: dLogin.json });
  check("BP-006d", "disqualified team's open session is rejected", dMe.status === 401 && dWrite.status === 401, { me: dMe.status, write: dWrite.status });
  const wrongDq = await teamLogin(d.teamNumber, "SYN-AAAAAA", ip(1));
  check("BP-006e", "wrong code for a DQ team doesn't reveal DQ status", wrongDq.status === 401, { status: wrongDq.status });

  const [row] = await sql`select id from teams where id = ${teams[2].id}`;
  const legacy = await new SignJWT({ kind: "team" }).setProtectedHeader({ alg: "HS256" }).setSubject(row.id).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(process.env.SESSION_SECRET));
  const legacyMe = await call("/api/team/me", { method: "GET", cookie: `hk_team=${legacy}` });
  check("BP-006f", "session without a code fingerprint (old format) is rejected", legacyMe.status === 401, { status: legacyMe.status });
}

// ── BP-026 ───────────────────────────────────────────────────────────────────
{
  const unk = await teamLogin(98765, "SYN-AAAAAA", ip(2));
  const wr = await teamLogin(teams[3].teamNumber, "SYN-AAAAAA", ip(2));
  check("BP-026", "unknown team and wrong code: same status and message", unk.status === wr.status && unk.json?.error === wr.json?.error, { unknown: [unk.status, unk.json?.error], wrong: [wr.status, wr.json?.error] });
}

// ── BP-008: 50 parallel wrong codes, one IP ─────────────────────────────────
{
  const t = teams[4];
  const res = await Promise.all(Array.from({ length: 50 }, () => teamLogin(t.teamNumber, "SYN-ZZZZZZ", ip(3))));
  const s401 = res.filter((x) => x.status === 401).length;
  const s429 = res.filter((x) => x.status === 429).length;
  const right = await teamLogin(t.teamNumber, t.code, ip(3));
  check("BP-008", "50 parallel wrong attempts: at most 5 codes evaluated, then locked", s401 <= 5 && s401 + s429 === 50 && right.status === 429, { s401, s429, correctCodeAfter: right.status });
}

// ── BP-009: one client can't lock everyone; backstop; unlock-all ────────────
{
  const victims = teams.slice(10, 30);
  for (const v of victims) for (let i = 0; i < 5; i++) await teamLogin(v.teamNumber, "SYN-ZZZZZZ", ip(66));
  const attackerLocked = (await Promise.all(victims.map((v) => teamLogin(v.teamNumber, v.code, ip(66))))).filter((x) => x.status === 429).length;
  const victimOk = (await Promise.all(victims.map((v) => teamLogin(v.teamNumber, v.code, ip(77))))).filter((x) => x.status === 200).length;
  check("BP-009a", "attacker's lockouts don't block teams on another network", victimOk === 20, { victimLoginsOkFromOtherIp: victimOk, lockedForAttackerIp: attackerLocked });
  check("BP-009b", "attacker's own network is locked after 5 wrong codes", attackerLocked === 20, { attackerLocked });

  const b = teams[31];
  for (let i = 0; i < 100; i++) await teamLogin(b.teamNumber, "SYN-ZZZZZZ", ip(`${100 + (i % 120)}`.slice(0, 3)));
  const capped = await teamLogin(b.teamNumber, b.code, ip(250));
  check("BP-009c", "backstop: 100 failures across many IPs lock the team for 10 min", capped.status === 429, { status: capped.status });

  const ua = await act("unlock-all", []);
  const afterUnlock = await teamLogin(victims[0].teamNumber, victims[0].code, ip(66));
  check("BP-009d", "admin 'Unlock all' clears per-IP locks", ua.status === 200 && afterUnlock.status === 200, { unlockAll: ua.status, login: afterUnlock.status });
  await sql`delete from login_events where identifier = ${String(b.teamNumber)}`;
}

// ── BP-023: double submit ───────────────────────────────────────────────────
{
  const t = teams[5];
  const c = (await teamLogin(t.teamNumber, t.code, ip(4))).cookie;
  await call("/api/team/repo", { cookie: c, body: { url: "https://github.com/b2/clean-double" } });
  const [a, b] = await Promise.all([call("/api/team/submit", { cookie: c, body: {} }), call("/api/team/submit", { cookie: c, body: {} })]);
  const third = await call("/api/team/submit", { cookie: c, body: {} });
  const [{ n }] = await sql`select count(*)::int n from audit_logs where action = 'SUBMISSION_FINALIZED' and target_id = ${t.id}`;
  check("BP-023", "double/triple submit: all 200, exactly one SUBMISSION_FINALIZED row", [a, b, third].every((x) => x.status === 200) && n === 1, { statuses: [a.status, b.status, third.status], auditRows: n });
}

// ── BP-007: repo swapped after submit is re-checked ─────────────────────────
{
  const t = teams[6];
  const c = (await teamLogin(t.teamNumber, t.code, ip(5))).cookie;
  await call("/api/team/repo", { cookie: c, body: { url: "https://github.com/b2/clean-first" } });
  await call("/api/team/submit", { cookie: c, body: {} });
  await sleep(2500);
  await call("/api/team/repo", { cookie: c, body: { url: "https://github.com/b2/early-swapped" } });
  let st = null;
  for (let i = 0; i < 20 && !st; i++) { await sleep(500); [{ github_status: st }] = await sql`select github_status from teams where id = ${t.id}`; }
  check("BP-007", "repo changed after final submit is re-checked automatically", st !== null, { github_status: st });
}

// ── BP-011 / BP-028 / BP-030: GitHub outcomes ────────────────────────────────
{
  const scen = { private: teams[7], ratelimited: teams[8], "server-500": teams[9], "server-hang": teams[32], early: teams[33] };
  for (const [sc, t] of Object.entries(scen)) await sql`update teams set github_repo_url = ${`https://github.com/b2/${sc}-repo`}, first_commit_at = '2026-10-09T03:40:00Z' where id = ${t.id}`;
  const six = await act("recheck-github", teams.slice(7, 13).map((t) => t.id));
  check("BP-028a", "recheck refuses more than 5 teams per request", six.status === 400, { status: six.status });
  const t0 = Date.now();
  const r = await act("recheck-github", Object.values(scen).map((t) => t.id));
  const ms = Date.now() - t0;
  const rows = Object.fromEntries(await Promise.all(Object.entries(scen).map(async ([sc, t]) => [sc, (await sql`select github_status s, github_note n, first_commit_at f from teams where id = ${t.id}`)[0]])));
  check("BP-028b", "5-team recheck with a hanging GitHub finishes within ~10 s", r.status === 200 && ms < 10_000, { status: r.status, ms });
  check("BP-011a", "private/404 repo → 'unchecked' with a clear note (never review/flagged)", rows.private.s === "unchecked" && /private or missing/i.test(rows.private.n), rows.private);
  check("BP-011b", "rate limit and GitHub 5xx → 'unchecked'", rows.ratelimited.s === "unchecked" && rows["server-500"].s === "unchecked", { rl: rows.ratelimited, s500: rows["server-500"] });
  check("BP-028c", "GitHub timeout → 'unchecked', not stuck", rows["server-hang"].s === "unchecked", rows["server-hang"]);
  check("BP-030", "failed check clears the stale first_commit_at", rows["server-hang"].f === null && rows.private.f === null, { hang: rows["server-hang"].f, priv: rows.private.f });
  check("BP-011c", "early commit is still flagged", rows.early.s === "flagged", rows.early);
  const ghSrc = readFileSync(`${process.env.APP_DIR}/lib/github.ts`, "utf8");
  check("BP-011d", "app makes no collaborator call (decision: local script only)", !/collaborators/.test(ghSrc));

  // Local reviewer-access script against the mock.
  const csvIn = `${process.env.TEMP || "/tmp"}/b2-teams.csv`;
  writeFileSync(csvIn, "Team Number,Repo\n101,https://github.com/audit/clean-repo\n102,https://github.com/audit/pending-repo\n103,https://github.com/audit/noreviewer-repo\n104,https://github.com/audit/private-repo\n105,\n");
  const csvOut = `${process.env.TEMP || "/tmp"}/b2-access.csv`;
  execFileSync(process.execPath, [`${process.env.APP_DIR}/scripts/reviewer-access-report.mjs`, csvIn, csvOut], { cwd: process.env.APP_DIR, env: { ...process.env, REVIEWER_GITHUB_TOKEN: "mock-reviewer-token" } });
  const access = readFileSync(csvOut, "utf8").trim().split("\n").slice(1).map((l) => l.split(",").pop().replace(/"/g, ""));
  check("BP-011e", "reviewer-access-report: ok / pending / missing / missing(private) / no-repo", JSON.stringify(access) === JSON.stringify(["ok", "pending", "missing", "missing", "no-repo"]), { access });
}

await cleanup("b2");
await finish("Batch 2");
