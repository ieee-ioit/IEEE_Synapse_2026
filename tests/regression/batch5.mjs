// Batch 5 regression: BP-031 tie-break must not depend on floating-point noise; BP-032 audit details are JSON objects.
import { call, adminLogin, seedTeams, cleanup, sql, check, finish } from "./lib.mjs";

const admin = await adminLogin();
await sql`delete from scores`;
await sql`update teams set is_finalist = false, stage2_order = null`;
const teams = await seedTeams(admin, "b5", 8);
const crit = await sql`select id from criteria order by position`;
const all95 = Object.fromEntries(crit.map((c) => [c.id, 9.5]));
// The trial failure: identical marks (3 judges × 7 criteria, all 9.5) for several teams.
await call("/api/admin/scores", { cookie: admin, body: { rows: teams.flatMap((t) => ["J1", "J2", "J3"].map((judge) => ({ teamNumber: t.teamNumber, judge, values: all95 }))), stage: 1 } });
// Same float expression as lib/scoring.ts, to confirm the noise actually happens in this run.
const sums = await sql`
  with pc as (select s.team_id, s.criterion_id, avg(s.value)::float8 v from scores s where s.stage = 1 group by 1, 2)
  select pc.team_id, sum(pc.v * c.weight / 100.0)::float8 s from pc join criteria c on c.id = pc.criterion_id group by pc.team_id`;
const noisy = new Set(sums.map((x) => x.s)).size > 1;

// Earliest submission = highest team index, so the expected order is the reverse of seeding.
for (const [i, t] of teams.entries()) {
  await sql`update teams set first_submitted_at = now() - make_interval(mins => ${i + 1}), submitted_at = now(), submission_status = 'submitted' where id = ${t.id}`;
}
await call("/api/admin/settings", { method: "PUT", cookie: admin, body: { leaderboardVisible: true, scoresVisible: false } });
const lb = await call("/api/leaderboard?v=b5" + Date.now(), { method: "GET" });
await call("/api/admin/settings", { method: "PUT", cookie: admin, body: { leaderboardVisible: false } });
const got = (lb.json?.teams ?? []).map((t) => t.teamNumber).slice(0, teams.length);
const want = [...teams].reverse().map((t) => t.teamNumber);
if (!noisy) check("BP-031", "inconclusive: no floating-point difference occurred in this run (re-run)", false, { sums: sums.map((x) => x.s) });
else check("BP-031", "8 exactly tied teams rank by earliest first_submitted_at despite float noise", JSON.stringify(got) === JSON.stringify(want), { got, want, distinctFloatTotals: [...new Set(sums.map((x) => x.s))] });
const [a] = teams;

// BP-032: audit details stored as a JSON object, not a string.
await call("/api/admin/teams", { cookie: admin, body: { action: "unlock", ids: [a.id] } });
const [{ t }] = await sql`select jsonb_typeof(details) t from audit_logs where action = 'TEAM_UNLOCK' order by id desc limit 1`;
check("BP-032", "audit_logs.details is a JSON object", t === "object", { jsonb_typeof: t });

await sql`delete from scores`;
await cleanup("b5");
await finish("Batch 5");
