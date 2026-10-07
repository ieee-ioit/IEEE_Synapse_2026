// Batch 1 regression: BP-012 import validation, BP-021 control chars, BP-024 body size, BP-019 localhost links guard.
// Needs APP_DIR (the built app) to start a second server for BP-019.
import { spawn } from "node:child_process";
import { call, adminLogin, sql, check, finish, sleep } from "./lib.mjs";

const admin = await adminLogin();
await sql`delete from teams where leader_email like 'b1-%' or leader_email in ('not-an-email','') or name like 'B1 %'`;
await sql`insert into teams (team_number, name, leader_email, login_code_hash, login_code_enc) values (99001, 'B1 Existing', 'b1-existing@mock.example.test', 'x', 'x')`;

const T = (name, extra = {}) => ({ name, leaderName: "Lead", leaderEmail: `b1-${name.replace(/\W/g, "").toLowerCase().slice(0, 30)}@mock.example.test`, college: "PICT", members: [], ...extra });
const rows = [
  T("B1 Good"),
  T("B1 DupEmailExisting", { leaderEmail: "b1-existing@mock.example.test" }),
  T("B1 DupInFileA", { leaderEmail: "b1-shared@mock.example.test" }),
  T("B1 DupInFileB", { leaderEmail: "b1-shared@mock.example.test" }),
  T("B1 BadEmail", { leaderEmail: "not-an-email" }),
  T("B1 NoEmail", { leaderEmail: "" }),
  T("B1 Five", { members: [1, 2, 3, 4].map((k) => ({ name: `M${k}`, email: `b1-five${k}@mock.example.test` })) }),
  T("B1 " + "L".repeat(140)),
  T("B1 Ctrl\r\nBcc: x@y", { leaderName: "Lead\r\nX-Evil: 1", college: "PICT\u0000\u2028Pune", members: [{ name: "Mem\tber", email: "b1-ctrlmem@mock.example.test" }] }),
  T("B1 LeaderIsMember", { leaderEmail: "b1-lim@mock.example.test", members: [{ name: "Same", email: "b1-lim@mock.example.test" }, { name: "Other", email: "b1-other@mock.example.test" }] }),
];
const dry = await call("/api/admin/import", { cookie: admin, body: { teams: rows, dryRun: true } });
const st = (i) => dry.json?.rows?.[i];
check("BP-012a", "Duplicate leader email vs an existing team is rejected with a reason", st(1)?.status === "invalid" && /already used/i.test(st(1)?.reason), st(1));
check("BP-012b", "Duplicate leader email within the file is rejected", st(2)?.status === "new" && st(3)?.status === "invalid" && /also used/i.test(st(3)?.reason), [st(2), st(3)]);
check("BP-012c", "Invalid leader email is rejected", st(4)?.status === "invalid" && /valid/i.test(st(4)?.reason), st(4));
check("BP-012d", "Missing leader email is rejected", st(5)?.status === "invalid" && /email/i.test(st(5)?.reason), st(5));
check("BP-012e", "Team of 5 is rejected (max 4)", st(6)?.status === "invalid" && /max 4/i.test(st(6)?.reason), st(6));
check("BP-012f", "Name over 120 characters is rejected, not truncated", st(7)?.status === "invalid" && /120/.test(st(7)?.reason), st(7));
check("BP-012g", "Valid row still classified new", st(0)?.status === "new", st(0));

const real = await call("/api/admin/import", { cookie: admin, body: { teams: rows } });
const createdNames = (real.json?.created ?? []).map((c) => c.name);
check("BP-012h", "Real import skips invalid rows and reports them", real.status === 200 && real.json.summary.invalid >= 6 && createdNames.length === 4, { status: real.status, summary: real.json?.summary, createdNames });
const [ctrl] = await sql`select t.name, t.leader_name, t.college, (select string_agg(name, '|') from members m where m.team_id = t.id) mem from teams t where leader_email like 'b1-b1ctrl%'`;
const hasCtrl = ctrl && /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/.test(ctrl.name + ctrl.leader_name + ctrl.college + ctrl.mem);
check("BP-021", "CR/LF and other control characters stripped from every text field", ctrl && !hasCtrl, ctrl && Object.fromEntries(Object.entries(ctrl).map(([k, v]) => [k, JSON.stringify(v)])));
const [{ n: limMembers }] = await sql`select count(*)::int n from members m join teams t on t.id = m.team_id where t.leader_email = 'b1-lim@mock.example.test'`;
check("BP-012i", "Member whose email equals the leader's is dropped (not double-counted)", limMembers === 1, { limMembers });

// BP-024: body caps.
const bigTeams = Array.from({ length: 1000 }, (_, i) => T(`B1 Big ${i} ` + "x".repeat(1100)));
const bigImport = await call("/api/admin/import", { cookie: admin, body: { teams: bigTeams, dryRun: true } });
check("BP-024a", "Import body over 1 MB returns 413", bigImport.status === 413, { status: bigImport.status, bytes: JSON.stringify({ teams: bigTeams }).length });
const bigScores = await call("/api/admin/scores", { cookie: admin, body: { rows: Array.from({ length: 4000 }, () => ({ teamNumber: 1, judge: "j".repeat(300), values: {} })), dryRun: true } });
check("BP-024b", "Scores body over 1 MB returns 413", bigScores.status === 413, { status: bigScores.status });
const [{ n: bigLeft }] = await sql`select count(*)::int n from teams where name like 'B1 Big%'`;
check("BP-024c", "Nothing from the oversized import was stored", bigLeft === 0, { bigLeft });

// BP-019: production build whose links point at localhost must refuse to send / warn — run a 2nd server
// of the same build with a non-local SMTP host (".invalid" never resolves, so nothing can be sent).
const port = 3299;
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  cwd: process.env.APP_DIR, env: { ...process.env, SMTP_HOST: "smtp.invalid", PORT: String(port) }, stdio: "ignore",
});
const base = `http://localhost:${port}`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(base + "/api/health")).ok) break; } catch {} await sleep(500); }
const admin2 = await adminLogin(1, base);
const send = await call("/api/admin/credentials", { base, cookie: admin2, body: {} });
check("BP-019a", "Credential send refused when production links point at localhost", send.status === 400 && /NEXT_PUBLIC_SITE_URL/.test(send.json?.error ?? ""), { status: send.status, body: send.json });
const print = await call("/admin/print", { base, method: "GET", cookie: admin2 });
check("BP-019b", "/admin/print shows the localhost warning", /NEXT_PUBLIC_SITE_URL/.test(print.text), { status: print.status });
const sc = await call("/admin/send-credentials", { base, method: "GET", cookie: admin2 });
check("BP-019c", "/admin/send-credentials shows the localhost warning", /NEXT_PUBLIC_SITE_URL/.test(sc.text), { status: sc.status });
const sentAny = await sql`select count(*)::int n from teams where credentials_sent_at is not null and leader_email like 'b1-%'`;
check("BP-019d", "No team marked as emailed by the refused send", sentAny[0].n === 0, sentAny[0]);
child.kill();

await sql`delete from teams where leader_email like 'b1-%' or name like 'B1 %'`;
await finish("Batch 1");
