// Batch 3 regression: BP-003 finalists, BP-004 judge names, BP-010 Stage 2 non-finalists,
// BP-017 incomplete marks, BP-002 server-side video unlock.
import { call, adminLogin, teamLogin, seedTeams, cleanup, sql, check, finish } from "./lib.mjs";

const admin = await adminLogin();
await sql`delete from scores`;
await sql`update teams set is_finalist = false, stage2_order = null`;
const teams = await seedTeams(admin, "b3", 14);
const crit = await sql`select id, name from criteria order by position`;
const all = (v) => Object.fromEntries(crit.map((c) => [c.id, v]));
const scores = (rows, stage = 1, extra = {}) => call("/api/admin/scores", { cookie: admin, body: { rows, stage, ...extra } });
const act = (body) => call("/api/admin/teams", { cookie: admin, body });
const settings = (patch) => call("/api/admin/settings", { method: "PUT", cookie: admin, body: patch });

// ── BP-004: judge spelling variants ─────────────────────────────────────────
{
  const t = teams[13];
  const rows = ["Dr. Rao", "dr rao ", "DR RAO"].map((judge, i) => ({ teamNumber: t.teamNumber, judge, values: all(5 + i) }));
  const dry = await scores(rows, 1, { dryRun: true });
  check("BP-004a", "dry run lists 'Dr. Rao' / 'dr rao' / 'DR RAO' as one judge", dry.json?.summary?.judges?.length === 1, dry.json?.summary?.judges);
  await scores(rows);
  const [{ n }] = await sql`select count(distinct judge)::int n from scores where team_id = ${t.id}`;
  check("BP-004b", "stored as one judge (no double counting)", n === 1, { distinctJudges: n });
  const near = await scores([{ teamNumber: t.teamNumber, judge: "Rao", values: all(5) }, { teamNumber: teams[12].teamNumber, judge: "Prof Kulkarni", values: all(5) }, { teamNumber: teams[12].teamNumber, judge: "Prof Kulkarny", values: all(5) }], 1, { dryRun: true });
  const w = near.json?.summary?.judgeWarnings ?? [];
  check("BP-004c", "near-duplicate judges are warned about (title-only and 1-letter differences)", w.some((x) => /Rao/.test(x)) && w.some((x) => /Kulkarn/.test(x)), { warnings: w });
  await settings({ expectedJudges: "Dr. Rao, Prof. Kulkarni" });
  const exp = await scores([{ teamNumber: t.teamNumber, judge: "Mr. Stranger", values: all(5) }], 1, { dryRun: true });
  check("BP-004d", "judge outside expectedJudges gives a warning, not an error", exp.status === 200 && exp.json?.summary?.valid === 1 && !!exp.json?.summary?.judgeWarnings?.some((x) => /expected/.test(x)), exp.json?.summary);
  await settings({ expectedJudges: "" });
  await sql`delete from scores where team_id = ${t.id}`;
}

// ── BP-017: incomplete marks are surfaced ───────────────────────────────────
{
  const t = teams[12];
  const partial = Object.fromEntries(crit.slice(0, 5).map((c) => [c.id, 6]));
  const dry = await scores([{ teamNumber: t.teamNumber, judge: "J1", values: partial }], 1, { dryRun: true });
  check("BP-017a", "score import summary flags 'incomplete: 5 of 7 criteria'", dry.json?.summary?.incomplete === 1 && /incomplete: 5 of 7/.test(dry.json?.rows?.[0]?.warnings?.join()), { incomplete: dry.json?.summary?.incomplete, warnings: dry.json?.rows?.[0]?.warnings });
  await scores([{ teamNumber: t.teamNumber, judge: "J1", values: partial }]);
  const page = await call("/admin/scores", { method: "GET", cookie: admin });
  check("BP-017b", "admin ranking shows 'incomplete: 5 of 7 criteria'", page.text.includes("incomplete: <!-- -->5<!-- --> of <!-- -->7<!-- --> criteria") || /incomplete: 5 of 7 criteria/.test(page.text), {});
  await sql`delete from scores where team_id = ${t.id}`;
}

// ── BP-003: finalist selection ──────────────────────────────────────────────
{
  // Stage 1: teams 0..11 get distinct totals (team 0 best); 12, 13 unscored.
  await scores(teams.slice(0, 12).map((t, i) => ({ teamNumber: t.teamNumber, judge: "J1", values: all(9.5 - i * 0.5) })));
  const ids = (from, to) => teams.slice(from, to).map((t) => t.id);
  const nine = await act({ action: "set-finalists", ids: ids(0, 9) });
  check("BP-003a", "needs exactly finalistCount (10) teams", nine.status === 400 && /exactly 10/.test(nine.json?.error), nine.json);
  const unscored = await act({ action: "set-finalists", ids: [...ids(0, 9), teams[13].id] });
  check("BP-003b", "a team without Stage 1 scores can't be a finalist", unscored.status === 400, unscored.json);
  await act({ action: "disqualify", ids: [teams[3].id] });
  const withDq = await act({ action: "set-finalists", ids: ids(0, 10) });
  check("BP-003c", "a disqualified team can't be a finalist", withDq.status === 400, withDq.json);
  await act({ action: "reinstate", ids: [teams[3].id] });

  const good = await act({ action: "set-finalists", ids: ids(0, 10).reverse() });
  const fin = await sql`select team_number, stage2_order from teams where is_finalist order by stage2_order`;
  const [{ n: audit }] = await sql`select count(*)::int n from audit_logs where action = 'FINALISTS_SET'`;
  check("BP-003d", "exactly 10 finalists, unique stage2_order 1..10 in Stage 1 rank order, audited", good.status === 200 && fin.length === 10 && fin.every((f, i) => f.stage2_order === i + 1 && f.team_number === teams[i].teamNumber) && audit >= 1, { status: good.status, fin: fin.map((f) => f.team_number), audit });

  const swap = await act({ action: "set-finalists", ids: [...ids(0, 9), teams[11].id] });
  const [{ n: count }] = await sql`select count(*)::int n from teams where is_finalist`;
  const [{ f: swapped }] = await sql`select bool_or(is_finalist) f from teams where id = ${teams[11].id}`;
  check("BP-003e", "re-running before Stage 2 replaces the selection (manual swap)", swap.status === 200 && count === 10 && swapped, { status: swap.status, count });

  // Tie at the cut-off: team 10 gets the same total as team 9.
  await scores([{ teamNumber: teams[10].teamNumber, judge: "J1", values: all(9.5 - 9 * 0.5) }]);
  const tie = await act({ action: "set-finalists", ids: ids(0, 10) });
  const tieOk = await act({ action: "set-finalists", ids: ids(0, 10), confirmTie: true });
  check("BP-003f", "tie at the cut-off requires an explicit choice", tie.status === 400 && /tied/.test(tie.json?.error) && tieOk.status === 200, { tie: tie.json, ok: tieOk.status });

  // Incomplete Stage 1 marks need confirmation.
  await sql`delete from scores where team_id = ${teams[0].id} and criterion_id = ${crit[6].id}`;
  const inc = await act({ action: "set-finalists", ids: ids(0, 10), confirmTie: true });
  const incOk = await act({ action: "set-finalists", ids: ids(0, 10), confirmTie: true, confirmIncomplete: true });
  check("BP-003g", "including a team with incomplete marks needs confirmation", inc.status === 400 && /incomplete/.test(inc.json?.error) && incOk.status === 200, { inc: inc.json, ok: incOk.status });

  // ── BP-010 (needs finalists) ──
  const nonFinal = teams[11];
  const s2dry = await scores([{ teamNumber: nonFinal.teamNumber, judge: "Jury A", values: all(10) }], 2, { dryRun: true });
  const s2 = await scores([{ teamNumber: nonFinal.teamNumber, judge: "Jury A", values: all(10) }], 2);
  check("BP-010", "Stage 2 rows for a non-finalist are rejected with a per-row reason", /isn't a finalist/.test(s2dry.json?.rows?.[0]?.problems?.join()) && s2.status === 400, { dry: s2dry.json?.rows?.[0]?.problems, real: s2.status });

  await scores([{ teamNumber: teams[0].teamNumber, judge: "Jury A", values: all(9) }], 2);
  const locked = await act({ action: "set-finalists", ids: ids(0, 10), confirmTie: true, confirmIncomplete: true });
  check("BP-003h", "finalists are locked once Stage 2 scores exist", locked.status === 400 && /locked/.test(locked.json?.error), locked.json);
  const panel = await call("/admin/leaderboard", { method: "GET", cookie: admin });
  check("BP-003i", "admin Leaderboard tab shows the finalists panel", /Stage 2 finalists/.test(panel.text) && /Confirm finalists/.test(panel.text));
}

// ── BP-002: video unlock enforced on the server ─────────────────────────────
{
  const t = teams[5];
  const now = Date.now();
  await settings({ eventStart: new Date(now - 3600_000).toISOString(), submissionDeadline: new Date(now + 5 * 3600_000).toISOString(), videoUnlockAt: "" });
  const c = (await teamLogin(t.teamNumber, t.code)).cookie;
  const early = await call("/api/team/video", { cookie: c, body: { url: "https://youtu.be/abc" } });
  const me = await call("/api/team/me", { method: "GET", cookie: c });
  const expectedDefault = new Date(now - 3600_000 + 4 * 3600_000).toISOString().slice(0, 16);
  check("BP-002a", "video rejected (403) before the unlock time", early.status === 403 && /open at/i.test(early.json?.error), { status: early.status, body: early.json });
  check("BP-002b", "dashboard gets videoUnlockAt from the server (default start + 4 h)", me.json?.videoUnlockAt?.slice(0, 16) === expectedDefault, { got: me.json?.videoUnlockAt, expectedDefault });
  await settings({ videoUnlockAt: new Date(now - 60_000).toISOString() });
  const later = await call("/api/team/video", { cookie: c, body: { url: "https://youtu.be/abc" } });
  const [{ n: audited }] = await sql`select count(*)::int n from audit_logs where action = 'SETTINGS_UPDATE' and details::text like '%videoUnlockAt%'`;
  check("BP-002c", "admin can move the unlock time; change is audit-logged; video then accepted", later.status === 200 && audited >= 1, { status: later.status, audited });
  await settings({ eventStart: "2026-10-09T09:00:00+05:30", submissionDeadline: "2026-10-09T15:00:00+05:30", videoUnlockAt: "" });
}

await sql`delete from scores`;
await sql`update teams set is_finalist = false, stage2_order = null`;
await cleanup("b3");
await finish("Batch 3");
