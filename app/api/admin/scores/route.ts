import { getCriteria } from "@/lib/criteria";
import { db } from "@/lib/db";
import { adminRoute, clientInfo, fail, ok } from "@/lib/http";
import { logAudit } from "@/lib/logger";
import { getSettings } from "@/lib/settings";

type Row = { teamNumber?: unknown; judge?: unknown; stage?: unknown; values?: Record<string, unknown>; notes?: unknown };
type Body = { rows?: Row[]; stage?: number; dryRun?: boolean; replaceAll?: boolean };

/** "Dr. Rao", "dr rao " and "DR RAO" are the same judge. */
const judgeKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const TITLES = new Set(["dr", "prof", "professor", "mr", "mrs", "ms", "miss", "sir", "madam", "er", "shri", "smt"]);
const withoutTitles = (key: string) => key.split(" ").filter((w) => !TITLES.has(w)).join(" ");

function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/**
 * Judges' paper sheets → Excel template → upload.
 * Supports stage 1 (preliminary) and stage 2 (live demo finalists).
 */
export const POST = adminRoute<Body>(async (admin, body, req) => {
  if (!Array.isArray(body.rows) || !body.rows.length) return fail(400, "No score rows found in the file.");
  if (body.rows.length > 5000) return fail(400, "Too many rows.");

  const defaultStage = body.stage === 2 ? 2 : 1;

  const sql = db();
  const [criteria, teams, settings] = await Promise.all([
    getCriteria(),
    sql<{ id: string; team_number: number; name: string; is_finalist: boolean }[]>`select id, team_number, name, is_finalist from teams`,
    getSettings(),
  ]);
  const teamByNumber = new Map(teams.map((t) => [t.team_number, t]));
  const criterionIds = new Set(criteria.map((c) => c.id));

  const checked = body.rows.map((r, index) => {
    const teamNumber = Number(r.teamNumber);
    const team = Number.isInteger(teamNumber) ? teamByNumber.get(teamNumber) : undefined;
    const judgeName = String(r.judge ?? "").trim().slice(0, 80);
    const judge = judgeKey(judgeName);
    const notes = String(r.notes ?? "").trim().slice(0, 1000);
    const rowStage = r.stage === 2 ? 2 : r.stage === 1 ? 1 : defaultStage;
    const values: { criterionId: string; value: number }[] = [];
    const problems: string[] = [];
    const warnings: string[] = [];
    for (const [cid, raw] of Object.entries(r.values ?? {})) {
      if (!criterionIds.has(cid)) continue;
      if (raw === null || raw === undefined || raw === "") continue;
      const v = Number(raw);
      if (!Number.isFinite(v) || v < 0 || v > 10) problems.push(`${criteria.find((c) => c.id === cid)?.name}: "${raw}" is not 0–10`);
      else values.push({ criterionId: cid, value: Math.round(v * 100) / 100 });
    }
    if (!team) problems.unshift(`Team ${String(r.teamNumber ?? "?")} not found`);
    else if (rowStage === 2 && !team.is_finalist) problems.unshift(`Team ${team.team_number} isn't a finalist (Stage 2 is for finalists only)`);
    else if (!values.length && !problems.length) problems.push("No scores in this row");
    if (values.length && values.length < criteria.length) warnings.push(`incomplete: ${values.length} of ${criteria.length} criteria`);
    return { index, teamNumber, teamName: team?.name ?? "", teamId: team?.id ?? null, judge, judgeName, stage: rowStage, notes, values, problems, warnings };
  });

  const valid = checked.filter((r) => r.teamId && !r.problems.length);

  // Judges in this file: one entry per normalised name, with the spellings seen.
  const judges = new Map<string, { key: string; names: Set<string>; rows: number }>();
  for (const r of valid) {
    const j = judges.get(r.judge) ?? { key: r.judge, names: new Set<string>(), rows: 0 };
    j.names.add(r.judgeName || "(blank)");
    j.rows++;
    judges.set(r.judge, j);
  }
  const judgeWarnings: string[] = [];
  // Compare this file's judges with each other and with judges already imported for this stage
  // (sheets are often uploaded one judge at a time).
  const stored = await sql<{ judge: string; name: string }[]>`
    select judge, max(coalesce(nullif(judge_name, ''), judge)) as name from scores where stage = ${defaultStage} group by judge`;
  const label = (key: string) => (judges.has(key) ? [...judges.get(key)!.names][0] : stored.find((s) => s.judge === key)?.name ?? key);
  const keys = [...judges.keys()];
  const others = [...new Set([...keys, ...stored.map((s) => s.judge)])];
  const seenPairs = new Set<string>();
  for (const a of keys)
    for (const b of others) {
      if (a === b || seenPairs.has([a, b].sort().join("|"))) continue;
      seenPairs.add([a, b].sort().join("|"));
      if (withoutTitles(a) === withoutTitles(b) || (Math.min(a.length, b.length) >= 4 && editDistance(a, b) <= 2)) {
        judgeWarnings.push(`"${label(a)}" and "${label(b)}" look like the same judge`);
      }
    }
  const expected = settings.expectedJudges.split(",").map((s) => judgeKey(s)).filter(Boolean);
  if (expected.length) {
    for (const j of judges.values()) if (!expected.includes(j.key)) judgeWarnings.push(`"${[...j.names][0]}" isn't in the expected judges list`);
  }
  const perTeam = new Map<string, Set<string>>();
  for (const r of valid) perTeam.set(r.teamId!, (perTeam.get(r.teamId!) ?? new Set()).add(r.judge));
  const freq = new Map<number, number>();
  for (const s of perTeam.values()) freq.set(s.size, (freq.get(s.size) ?? 0) + 1);
  const typical = [...freq.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
  const odd = [...perTeam.entries()].filter(([, s]) => s.size !== typical);
  if (typical && odd.length) {
    judgeWarnings.push(`${odd.length} team(s) have a different number of judges than the usual ${typical}: ${odd.slice(0, 10).map(([id]) => teams.find((t) => t.id === id)?.team_number).join(", ")}`);
  }

  const summary = {
    rows: checked.length,
    valid: valid.length,
    invalid: checked.length - valid.length,
    scores: valid.reduce((n, r) => n + r.values.length, 0),
    teams: new Set(valid.map((r) => r.teamId)).size,
    incomplete: valid.filter((r) => r.warnings.length).length,
    judges: [...judges.values()].map((j) => ({ name: [...j.names].join(" / "), rows: j.rows })),
    judgeWarnings,
  };

  if (body.dryRun) {
    return ok({
      summary,
      rows: checked.map(({ teamId: _teamId, ...r }) => r),
    });
  }
  if (!valid.length) return fail(400, "No valid rows to import.");

  const records = valid.flatMap((r) =>
    r.values.map((v) => ({
      team_id: r.teamId!,
      criterion_id: v.criterionId,
      judge: r.judge,
      judge_name: r.judgeName,
      stage: r.stage,
      value: v.value,
      notes: r.notes,
    })),
  );
  // Last row wins if the same team/criterion/judge/stage appears twice in one file.
  const deduped = [...new Map(records.map((x) => [`${x.team_id}|${x.criterion_id}|${x.judge}|${x.stage}`, x])).values()];

  await sql.begin(async (tx) => {
    if (body.replaceAll) await tx`delete from scores where stage = ${defaultStage}`;
    await tx`
      insert into scores ${tx(deduped)}
      on conflict (team_id, criterion_id, judge, stage)
      do update set value = excluded.value, notes = excluded.notes, judge_name = excluded.judge_name, imported_at = now()`;
  });

  const { ip, userAgent } = clientInfo(req);
  await logAudit({
    actorType: "admin",
    actorId: admin.email,
    action: "SCORES_IMPORT",
    targetType: "scores",
    details: {
      stage: defaultStage,
      importedScores: deduped.length,
      teamsCount: summary.teams,
      judges: summary.judges.length,
      incompleteRows: summary.incomplete,
      replaceAll: Boolean(body.replaceAll),
    },
    ip,
    userAgent,
  });

  return ok({ summary, imported: deduped.length });
});
