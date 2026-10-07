import { db } from "@/lib/db";
import { event } from "@/lib/event";
import { formatTime } from "@/lib/format";
import { clientInfo, fail, ok, readJsonBody } from "@/lib/http";
import { logAudit, logError } from "@/lib/logger";
import { getTeamSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";

function isValidVideoUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.toLowerCase();
    return event.allowedVideoHosts.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const session = await getTeamSession();
    if (!session) return fail(401, "Your session expired. Log in again.");
    const body = await readJsonBody<{ url?: unknown }>(req);
    if (!body) return fail(400, "Bad request.");

    const url = String(body.url ?? "").trim();
    if (!url) return fail(400, "Please provide a valid video link.");

    if (!isValidVideoUrl(url)) {
      return fail(
        400,
        `Demo video must be hosted on an allowed platform (${event.allowedVideoHosts.join(", ")}).`,
      );
    }

    const { submissionDeadline, videoUnlockAt } = await getSettings();
    if (Date.now() >= Date.parse(submissionDeadline)) return fail(403, "The submission deadline has passed.");
    if (Date.now() < Date.parse(videoUnlockAt)) {
      return fail(403, `Demo video links open at ${formatTime(videoUnlockAt).slice(0, 5)} IST. Focus on your repo until then.`);
    }

    const sql = db();
    const rows = await sql`
      update teams set 
        demo_video_url = ${url},
        first_submitted_at = coalesce(first_submitted_at, now()),
        last_updated_at = now()
      where id = ${session.teamId} and submission_status <> 'disqualified'
      returning id, team_number`;

    if (!rows.length) {
      const [t] = await sql<{ submission_status: string }[]>`select submission_status from teams where id = ${session.teamId}`;
      if (!t) return fail(401, "Team not found.");
      return fail(403, "This team cannot edit its submission.");
    }

    const { ip, userAgent } = clientInfo(req);
    await logAudit({
      actorType: "team",
      actorId: rows[0].team_number,
      action: "VIDEO_UPDATED",
      targetType: "team",
      targetId: session.teamId,
      details: { videoUrl: url },
      ip,
      userAgent,
    });

    return ok({ url });
  } catch (err) {
    const { ip, userAgent } = clientInfo(req);
    await logError(err, { endpoint: "/api/team/video", ip, userAgent });
    return fail(500, "Couldn't save the video link. Try again.");
  }
}
