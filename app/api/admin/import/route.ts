import { newCredential } from "@/lib/codes";
import { db } from "@/lib/db";
import { event } from "@/lib/event";
import { adminRoute, clientInfo, fail, ok } from "@/lib/http";
import { logAudit } from "@/lib/logger";

type Member = { name: string; email: string };
type IncomingTeam = {
  teamNumber?: number | null;
  name?: string;
  leaderName?: string;
  leaderEmail?: string;
  college?: string;
  members?: Member[];
};
type Body = { teams?: IncomingTeam[]; dryRun?: boolean; update?: string[] };

export type ImportRowStatus = "new" | "existing" | "duplicate" | "invalid";

// Control characters (CR/LF, tabs, C1, line/paragraph separators) become spaces; runs collapse.
const s = (v: unknown) =>
  String(v ?? "")
    .replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LIMITS = { name: 120, person: 120, college: 200, email: 254 };
const MAX_TEAM_SIZE = 4;

function clean(t: IncomingTeam) {
  const n = t.teamNumber == null || (t.teamNumber as unknown) === "" ? null : Number(t.teamNumber);
  const leaderEmail = s(t.leaderEmail).toLowerCase();
  return {
    teamNumber: n != null && Number.isInteger(n) && n > 0 && n < 1_000_000 ? n : n == null ? null : NaN,
    name: s(t.name),
    leaderName: s(t.leaderName),
    leaderEmail,
    college: s(t.college),
    members: (Array.isArray(t.members) ? t.members : [])
      .slice(0, 12)
      .map((m) => ({ name: s(m?.name), email: s(m?.email).toLowerCase() }))
      .filter((m) => (m.name || m.email) && !(leaderEmail && m.email === leaderEmail)),
  };
}

/** Why this row can't be imported, or "" if it can. */
function problem(t: ReturnType<typeof clean>) {
  if (!t.name) return "Missing team name";
  if (t.name.length > LIMITS.name) return `Team name is longer than ${LIMITS.name} characters`;
  if (!t.leaderEmail) return "Missing leader email (needed to send the login code)";
  if (t.leaderEmail.length > LIMITS.email || !EMAIL.test(t.leaderEmail)) return `Leader email "${t.leaderEmail.slice(0, 60)}" isn't valid`;
  if (t.leaderName.length > LIMITS.person || t.members.some((m) => m.name.length > LIMITS.person)) return `A person's name is longer than ${LIMITS.person} characters`;
  if (t.college.length > LIMITS.college) return `College is longer than ${LIMITS.college} characters`;
  const bad = t.members.find((m) => m.email && (m.email.length > LIMITS.email || !EMAIL.test(m.email)));
  if (bad) return `Member email "${bad.email.slice(0, 60)}" isn't valid`;
  if (1 + t.members.length > MAX_TEAM_SIZE) return `Team has ${1 + t.members.length} members (max ${MAX_TEAM_SIZE})`;
  return "";
}

/**
 * Plan §8: one-way import from the Unstop CSV (parsed in the browser).
 * dryRun → classification for the preview. Otherwise creates new teams with fresh
 * login codes, optionally refreshes selected existing teams, never touches codes
 * or numbers of existing teams, and returns the plaintext codes once for printing.
 */
export const POST = adminRoute<Body>(async (_admin, body, req) => {
  if (!Array.isArray(body.teams) || !body.teams.length) return fail(400, "No teams in the upload.");
  if (body.teams.length > 1000) return fail(400, "That's more than 1,000 teams — split the file.");
  const teams = body.teams.map(clean);
  const updateKeys = new Set((body.update ?? []).map((k) => String(k).toLowerCase()));

  const run = async (sql: ReturnType<typeof db>) => {
    const existing = await sql<{ id: string; team_number: number; key: string; email: string }[]>`
      select id, team_number, lower(name) as key, lower(leader_email) as email from teams`;
    const byName = new Map(existing.map((e) => [e.key, e]));
    const byEmail = new Map(existing.filter((e) => e.email).map((e) => [e.email, e]));
    const seenEmails = new Map<string, string>();
    const taken = new Set(existing.map((e) => e.team_number));
    const seenNames = new Set<string>();
    const fileNumbers = new Set<number>();

    const rows = teams.map((t, index) => {
      const key = t.name.toLowerCase();
      const base = { index, name: t.name, leaderName: t.leaderName, leaderEmail: t.leaderEmail, memberCount: t.members.length };
      const why = problem(t);
      if (why) return { ...base, status: "invalid" as ImportRowStatus, reason: why, teamNumber: null };
      if (seenNames.has(key)) return { ...base, status: "duplicate" as ImportRowStatus, reason: "Appears earlier in this file", teamNumber: null };
      seenNames.add(key);
      const hit = byName.get(key);
      const emailOwner = byEmail.get(t.leaderEmail);
      if (emailOwner && emailOwner !== hit) {
        return { ...base, status: "invalid" as ImportRowStatus, reason: `Leader email is already used by team #${emailOwner.team_number}`, teamNumber: null };
      }
      if (seenEmails.has(t.leaderEmail)) {
        return { ...base, status: "invalid" as ImportRowStatus, reason: `Leader email is also used by "${seenEmails.get(t.leaderEmail)}" earlier in this file`, teamNumber: null };
      }
      seenEmails.set(t.leaderEmail, t.name);
      if (hit) return { ...base, status: "existing" as ImportRowStatus, reason: "", teamNumber: hit.team_number };
      if (Number.isNaN(t.teamNumber)) return { ...base, status: "invalid" as ImportRowStatus, reason: "Team number isn't a whole number", teamNumber: null };
      if (t.teamNumber != null && (taken.has(t.teamNumber) || fileNumbers.has(t.teamNumber))) {
        return { ...base, status: "invalid" as ImportRowStatus, reason: `Team number ${t.teamNumber} is already used`, teamNumber: null };
      }
      if (t.teamNumber != null) fileNumbers.add(t.teamNumber);
      return { ...base, status: "new" as ImportRowStatus, reason: "", teamNumber: t.teamNumber };
    });
    return { rows, byName, taken, fileNumbers };
  };

  const summarize = (rows: { status: ImportRowStatus }[]) => ({
    found: rows.length,
    new: rows.filter((r) => r.status === "new").length,
    existing: rows.filter((r) => r.status === "existing").length,
    duplicate: rows.filter((r) => r.status === "duplicate").length,
    invalid: rows.filter((r) => r.status === "invalid").length,
  });

  if (body.dryRun) {
    const { rows } = await run(db());
    return ok({ rows, summary: summarize(rows) });
  }

  const result = await db().begin(async (sql) => {
    await sql`lock table teams in share row exclusive mode`; // serialize concurrent imports
    const { rows, byName, taken, fileNumbers } = await run(sql as unknown as ReturnType<typeof db>);

    let next = Math.max(event.teamNumberStart - 1, ...taken, 0) + 1;
    const nextFree = () => {
      while (taken.has(next) || fileNumbers.has(next)) next++;
      return next++;
    };

    // New teams: two bulk statements regardless of team count.
    const fresh = rows
      .filter((r) => r.status === "new")
      .map((r) => {
        const t = teams[r.index];
        return { t, teamNumber: t.teamNumber ?? nextFree(), cred: newCredential() };
      });
    if (fresh.length) {
      const inserted = await sql<{ id: string; team_number: number }[]>`
        insert into teams ${sql(
          fresh.map(({ t, teamNumber, cred }) => ({
            team_number: teamNumber,
            name: t.name,
            leader_name: t.leaderName,
            leader_email: t.leaderEmail,
            college: t.college,
            login_code_hash: cred.hash,
            login_code_enc: cred.enc,
          })),
        )}
        returning id, team_number`;
      const idByNumber = new Map(inserted.map((r) => [r.team_number, r.id]));
      const members = fresh.flatMap(({ t, teamNumber }) =>
        t.members.map((m) => ({ team_id: idByNumber.get(teamNumber)!, name: m.name || m.email, email: m.email })),
      );
      if (members.length) await sql`insert into members ${sql(members)}`;
    }

    // Existing teams the admin ticked "update" for: refresh leader/college/members only.
    let updated = 0;
    for (const row of rows) {
      const t = teams[row.index];
      if (row.status !== "existing" || !updateKeys.has(t.name.toLowerCase())) continue;
      const id = byName.get(t.name.toLowerCase())!.id;
      await sql`update teams set leader_name = ${t.leaderName}, leader_email = ${t.leaderEmail}, college = ${t.college} where id = ${id}`;
      await sql`delete from members where team_id = ${id}`;
      if (t.members.length) {
        await sql`insert into members ${sql(t.members.map((m) => ({ team_id: id, name: m.name || m.email, email: m.email })))}`;
      }
      updated++;
    }

    const created = fresh
      .map(({ t, teamNumber, cred }) => ({ teamNumber, name: t.name, leaderName: t.leaderName, leaderEmail: t.leaderEmail, code: cred.code }))
      .sort((a, b) => a.teamNumber - b.teamNumber);

    if (!body.dryRun) {
      const { ip, userAgent } = clientInfo(req);
      await logAudit({
        actorType: "admin",
        actorId: _admin.email,
        action: "TEAMS_IMPORT",
        targetType: "teams",
        details: {
          freshCount: created.length,
          updatedCount: updated,
          totalSubmitted: teams.length,
        },
        ip,
        userAgent,
      });
    }

    return { created, updated, summary: summarize(rows) };
  });

  return ok(result);
});
