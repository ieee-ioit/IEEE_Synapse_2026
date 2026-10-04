import { after } from "next/server";
import { db, iso } from "@/lib/db";
import { checkTeamRepo } from "@/lib/github";
import { clientInfo, fail, ok, readJsonBody } from "@/lib/http";
import { logAudit, logError } from "@/lib/logger";
import { getTeamSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";

/**
 * Plan §10: the write is synchronous and instant; the GitHub first-commit check runs
 * after the response is sent, so a deadline rush never waits on GitHub.
 */
export async function POST(req: Request) {
  try {
    const session = await getTeamSession();
    if (!session) return fail(401, "Your session expired. Log in again.");
    if ((await readJsonBody(req)) === null) return fail(400, "Bad request.");

    const { submissionDeadline } = await getSettings();
    if (Date.now() >= Date.parse(submissionDeadline)) return fail(403, "The submission deadline has passed.");

    const sql = db();
    const [row] = await sql<{ submitted_at: Date; team_number: number }[]>`
      update teams set 
        submitted_at = coalesce(submitted_at, now()), 
        first_submitted_at = coalesce(first_submitted_at, now()),
        last_updated_at = now(),
        submission_status = 'submitted'
      where id = ${session.teamId} and submission_status <> 'disqualified' and github_repo_url is not null
      returning submitted_at, team_number`;

    if (!row) {
      const [t] = await sql<{ submission_status: string; github_repo_url: string | null }[]>`
        select submission_status, github_repo_url from teams where id = ${session.teamId}`;
      if (!t) return fail(401, "Team not found.");
      if (t.submission_status === "disqualified") return fail(403, "This team can't submit.");
      return fail(400, "Save your GitHub repo link first before submitting.");
    }

    const { ip, userAgent } = clientInfo(req);
    await logAudit({
      actorType: "team",
      actorId: row.team_number,
      action: "SUBMISSION_FINALIZED",
      targetType: "team",
      targetId: session.teamId,
      details: { submittedAt: iso(row.submitted_at) },
      ip,
      userAgent,
    });

    after(() => checkTeamRepo(session.teamId));
    return ok({ submittedAt: iso(row.submitted_at) });
  } catch (err) {
    const { ip, userAgent } = clientInfo(req);
    await logError(err, { endpoint: "/api/team/submit", ip, userAgent });
    return fail(500, "Submission didn't go through. Try again — nothing was lost.");
  }
}
