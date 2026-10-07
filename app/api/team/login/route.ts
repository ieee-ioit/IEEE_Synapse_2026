import { verifyCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { clientInfo, fail, ok, readJsonBody } from "@/lib/http";
import { codeFingerprint, startSession } from "@/lib/session";

const MAX_ATTEMPTS = 5; // per team and client IP, then locked for 10 minutes (plan §7)
// Backstop across all IPs, so rotating addresses can't brute-force one team. Kept high because a
// whole venue can share one public IP.
const TEAM_CAP = 100;
const NO_MATCH = "That team number and code don't match. Check your chit or ask an organizer.";

export async function POST(req: Request) {
  try {
    const body = await readJsonBody<{ teamNumber?: unknown; code?: unknown }>(req);
    if (!body) return fail(400, "Bad request.");
    const teamNumber = Number(String(body.teamNumber ?? "").trim());
    const code = String(body.code ?? "");
    if (!Number.isInteger(teamNumber) || teamNumber <= 0 || code.replace(/[^A-Za-z0-9]/g, "").length < 6) {
      return fail(400, "Enter your team number and the login code from your chit.");
    }

    const sql = db();
    const { ip, userAgent } = clientInfo(req);
    const lockKey = ip || "unknown";
    const log = (success: boolean, teamId: string | null) =>
      sql`insert into login_events (kind, team_id, identifier, success, ip, user_agent)
          values ('team', ${teamId}, ${String(teamNumber)}, ${success}, ${ip}, ${userAgent})`;
    const locked = (mins: number) =>
      fail(429, `Too many wrong attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}, or ask an organizer.`);

    const [team] = await sql<{ id: string; login_code_hash: string; submission_status: string }[]>`
      select id, login_code_hash, submission_status from teams where team_number = ${teamNumber}`;
    if (!team) {
      await log(false, null);
      return fail(401, NO_MATCH);
    }

    const [{ recent }] = await sql<{ recent: number }[]>`
      select count(*)::int as recent from login_events
      where kind = 'team' and identifier = ${String(teamNumber)} and not success and created_at > now() - interval '10 minutes'`;
    if (recent >= TEAM_CAP) {
      await log(false, team.id);
      return locked(10);
    }

    // Reserve this attempt before checking the code, so parallel requests can't exceed the limit.
    const [slot] = await sql<{ failed_attempts: number }[]>`
      insert into team_login_locks as l (team_id, ip, failed_attempts) values (${team.id}, ${lockKey}, 1)
      on conflict (team_id, ip) do update set
        failed_attempts = case when l.locked_until is not null and l.locked_until <= now() then 1 else l.failed_attempts + 1 end,
        locked_until    = case when l.locked_until is not null and l.locked_until <= now() then null else l.locked_until end,
        updated_at      = now()
      where l.locked_until is null or l.locked_until <= now()
      returning failed_attempts`;
    if (!slot || slot.failed_attempts > MAX_ATTEMPTS) {
      const [l] = await sql<{ locked_until: Date | null }[]>`
        update team_login_locks set locked_until = coalesce(locked_until, now() + interval '10 minutes')
        where team_id = ${team.id} and ip = ${lockKey} returning locked_until`;
      await log(false, team.id);
      return locked(Math.max(1, Math.ceil(((l?.locked_until?.getTime() ?? Date.now()) - Date.now()) / 60000)));
    }

    if (!verifyCode(code, team.login_code_hash)) {
      await log(false, team.id);
      if (slot.failed_attempts >= MAX_ATTEMPTS) {
        await sql`update team_login_locks set locked_until = now() + interval '10 minutes' where team_id = ${team.id} and ip = ${lockKey}`;
        return fail(429, "Too many wrong attempts. This team is locked for 10 minutes on this network, or ask an organizer.");
      }
      return fail(401, NO_MATCH);
    }

    await sql`delete from team_login_locks where team_id = ${team.id} and ip = ${lockKey}`;
    if (team.submission_status === "disqualified") {
      await log(false, team.id);
      return fail(403, "This team can't log in. Please talk to an organizer.");
    }
    await log(true, team.id);
    await startSession("team", team.id, { cv: codeFingerprint(team.login_code_hash) });
    return ok();
  } catch (err) {
    console.error("[team login]", err);
    return fail(500, "Login is having trouble. Try again in a moment, or ask an organizer.");
  }
}
