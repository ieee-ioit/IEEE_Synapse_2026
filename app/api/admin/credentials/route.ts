import { decryptCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { siteUrlProblem } from "@/lib/format";
import { adminRoute, clientInfo, fail, ok } from "@/lib/http";
import { logAudit } from "@/lib/logger";
import { mailConfigured, sendCredentials } from "@/lib/mail";

const BATCH = 8; // small batches keep each request well inside the serverless time limit

type T = { id: string; team_number: number; name: string; leader_name: string; leader_email: string; login_code_enc: string };

/**
 * Sends one batch of credential emails. The admin page calls this repeatedly until
 * `remaining` hits 0, showing progress. Teams are claimed atomically (stamped before
 * sending, un-stamped if the send fails), so two admins sending at once never email
 * the same leader twice, and re-running never double-sends.
 */
export const POST = adminRoute<{ ids?: string[]; skip?: number[] }>(async (admin, body, req) => {
  if (!mailConfigured()) return fail(400, "Email isn't configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS.");
  const urlProblem = siteUrlProblem();
  if (urlProblem) return fail(400, urlProblem);
  const sql = db();
  const ids = Array.isArray(body.ids) ? body.ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)) : null;
  // Teams that already failed in this run, so one bad batch can't stop the rest from being sent.
  const skip = Array.isArray(body.skip) ? body.skip.filter((n) => Number.isInteger(n)).slice(0, 1000) : [];

  // Explicit ids = a deliberate resend; otherwise the next unsent teams.
  const batch = ids
    ? await sql<T[]>`
        update teams set credentials_sent_at = now()
        where id in (select id from teams where id = any(${ids}::uuid[]) and leader_email <> ''
                     order by team_number limit ${BATCH} for update skip locked)
        returning id, team_number, name, leader_name, leader_email, login_code_enc`
    : await sql<T[]>`
        update teams set credentials_sent_at = now()
        where id in (select id from teams where credentials_sent_at is null and leader_email <> ''
                     and not (team_number = any(${skip}::int[]))
                     order by team_number limit ${BATCH} for update skip locked)
        returning id, team_number, name, leader_name, leader_email, login_code_enc`;
  batch.sort((a, b) => a.team_number - b.team_number);

  const sent: number[] = [];
  const failed: { teamNumber: number; error: string }[] = [];
  for (const t of batch) {
    const code = decryptCode(t.login_code_enc);
    try {
      if (!code) throw new Error("Code can't be decrypted (CODE_SECRET changed?) — regenerate it.");
      await sendCredentials({ email: t.leader_email, leaderName: t.leader_name, teamName: t.name, teamNumber: t.team_number, code });
      sent.push(t.team_number);
    } catch (err) {
      await sql`update teams set credentials_sent_at = null where id = ${t.id}`;
      failed.push({ teamNumber: t.team_number, error: (err as Error).message.slice(0, 200) });
    }
  }

  if (sent.length || failed.length) {
    const { ip, userAgent } = clientInfo(req);
    await logAudit({
      actorType: "admin",
      actorId: admin.email,
      action: "CREDENTIALS_EMAILED",
      targetType: "teams",
      details: { sent: sent.length, failed: failed.length, teamNumbers: sent, failedTeamNumbers: failed.map((f) => f.teamNumber), resend: Boolean(ids) },
      ip,
      userAgent,
    });
  }

  const [{ remaining }] = await sql<{ remaining: number }[]>`
    select count(*)::int as remaining from teams where credentials_sent_at is null and leader_email <> ''`;
  return ok({ sent, failed, remaining });
});
