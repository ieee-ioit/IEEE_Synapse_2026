import { after } from "next/server";
import { db } from "@/lib/db";
import { checkTeamRepo, parseRepoUrl } from "@/lib/github";
import { clientInfo, fail, ok, readJsonBody } from "@/lib/http";
import { logAudit, logError } from "@/lib/logger";
import { getTeamSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export async function POST(req: Request) {
  try {
    const session = await getTeamSession();
    if (!session) return fail(401, "Your session expired. Log in again.");
    const body = await readJsonBody<{ url?: unknown }>(req);
    if (!body) return fail(400, "Bad request.");

    const parsed = parseRepoUrl(String(body.url ?? ""));
    if (!parsed) return fail(400, "Paste the repo link, like https://github.com/your-team/project.");

    const { submissionDeadline } = await getSettings();
    if (Date.now() >= Date.parse(submissionDeadline)) return fail(403, "The submission deadline has passed.");

    const sql = db();
    const rows = await sql`
      update teams set 
        github_repo_url = ${parsed.url}, 
        github_status = null, 
        github_note = null,
        first_commit_at = null, 
        github_checked_at = null,
        first_submitted_at = coalesce(first_submitted_at, now()),
        last_updated_at = now()
      where id = ${session.teamId} and submission_status <> 'disqualified'
      returning id, team_number, submission_status`;
    if (!rows.length) {
      const [t] = await sql<{ submission_status: string }[]>`select submission_status from teams where id = ${session.teamId}`;
      if (!t) return fail(401, "Team not found.");
      return fail(403, "This team cannot edit its submission.");
    }

    const { ip, userAgent } = clientInfo(req);
    await logAudit({
      actorType: "team",
      actorId: rows[0].team_number,
      action: "REPO_UPDATED",
      targetType: "team",
      targetId: session.teamId,
      details: { repoUrl: parsed.url },
      ip,
      userAgent,
    });

    // Already submitted: the repo changed after the integrity check, so check it again.
    if (rows[0].submission_status === "submitted") after(() => checkTeamRepo(session.teamId));
    return ok({ url: parsed.url });
  } catch (err) {
    const { ip, userAgent } = clientInfo(req);
    await logError(err, { endpoint: "/api/team/repo", ip, userAgent });
    return fail(500, "Couldn't save the repo link. Try again.");
  }
}
