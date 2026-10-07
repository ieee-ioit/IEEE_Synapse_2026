import { newCredential } from "@/lib/codes";
import { db } from "@/lib/db";
import { setFinalists } from "@/lib/finalists";
import { checkTeamRepo } from "@/lib/github";
import { adminRoute, clientInfo, fail, ok } from "@/lib/http";
import { logAudit } from "@/lib/logger";

const ACTIONS = [
  "recheck-github",
  "disqualify",
  "reinstate",
  "unlock",
  "unlock-all",
  "reset-submission",
  "regenerate-code",
  "delete",
  "set-finalists",
] as const;
type Action = (typeof ACTIONS)[number];

const UUID = /^[0-9a-f-]{36}$/i;

type Body = { action?: string; ids?: string[]; confirmIncomplete?: boolean; confirmTie?: boolean };

export const POST = adminRoute<Body>(async (admin, body, req) => {
  const action = body.action as Action;
  if (!ACTIONS.includes(action)) return fail(400, "Unknown action.");
  const ids = (Array.isArray(body.ids) ? body.ids : []).filter((id) => typeof id === "string" && UUID.test(id));
  if (!ids.length && action !== "unlock-all") return fail(400, "No teams selected.");
  const sql = db();

  const { ip, userAgent } = clientInfo(req);
  const res = await run();
  // Logged only once the action has succeeded (set-finalists writes its own FINALISTS_SET row).
  if (res.ok && action !== "set-finalists") {
    await logAudit({
      actorType: "admin",
      actorId: admin.email,
      action: `TEAM_${action.toUpperCase().replace(/-/g, "_")}`,
      targetType: "teams",
      details: { ids, count: ids.length },
      ip,
      userAgent,
    });
  }
  return res;

  async function run(): Promise<Response> {
    switch (action) {
      case "recheck-github": {
        if (ids.length > 5) return fail(400, "Re-check at most 5 teams per request.");
        const results: Record<string, unknown> = {};
        // Small concurrency keeps us polite to GitHub and inside the function time limit.
        for (let i = 0; i < ids.length; i += 3) {
          const chunk = ids.slice(i, i + 3);
          const out = await Promise.all(chunk.map((id) => checkTeamRepo(id)));
          chunk.forEach((id, j) => (results[id] = out[j]));
        }
        return ok({ results });
      }
      case "disqualify":
        await sql`update teams set submission_status = 'disqualified' where id = any(${ids}::uuid[])`;
        return ok();
      case "reinstate":
        await sql`update teams set submission_status = case when submitted_at is null then 'building' else 'submitted' end
                  where id = any(${ids}::uuid[]) and submission_status = 'disqualified'`;
        return ok();
      case "unlock":
        await sql`delete from team_login_locks where team_id = any(${ids}::uuid[])`;
        await sql`update teams set failed_attempts = 0, locked_until = null where id = any(${ids}::uuid[])`;
        return ok();
      case "unlock-all":
        await sql`delete from team_login_locks`;
        await sql`update teams set failed_attempts = 0, locked_until = null where failed_attempts <> 0 or locked_until is not null`;
        return ok();
      case "reset-submission":
        await sql`update teams set submitted_at = null, submission_status = 'building'
                  where id = any(${ids}::uuid[]) and submission_status = 'submitted'`;
        return ok();
      case "regenerate-code": {
        if (ids.length !== 1) return fail(400, "Regenerate one code at a time.");
        const cred = newCredential();
        await sql`update teams set login_code_hash = ${cred.hash}, login_code_enc = ${cred.enc},
                    credentials_sent_at = null, failed_attempts = 0, locked_until = null
                  where id = ${ids[0]}`;
        await sql`delete from team_login_locks where team_id = ${ids[0]}`;
        return ok({ code: cred.code });
      }
      case "delete":
        await sql`delete from teams where id = any(${ids}::uuid[])`;
        return ok();
      case "set-finalists": {
        const result = await setFinalists(ids, { confirmIncomplete: body.confirmIncomplete === true, confirmTie: body.confirmTie === true });
        if (result.error) return fail(400, result.error);
        await logAudit({
          actorType: "admin",
          actorId: admin.email,
          action: "FINALISTS_SET",
          targetType: "teams",
          details: { teamNumbers: result.teamNumbers, count: result.teamNumbers!.length },
          ip,
          userAgent,
        });
        return ok({ teamNumbers: result.teamNumbers });
      }
    }
    return fail(400, "Unknown action.");
  }
});
