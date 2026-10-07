import { compare } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { adminRoute, clientInfo, fail, ok } from "@/lib/http";
import { logAudit } from "@/lib/logger";

/**
 * Wipes dry-run data (plan §14, step 7.5). Three locks: the deployment must allow it
 * (ALLOW_RESET=1, unset in production by default), the admin re-enters their password,
 * and types DELETE.
 */
export const POST = adminRoute<{ scope?: string; confirm?: string; password?: string }>(async (admin, body, req) => {
  if (process.env.ALLOW_RESET !== "1") return fail(403, "Reset is disabled on this deployment (set ALLOW_RESET=1 to enable it).");
  if (body.confirm !== "DELETE") return fail(400, 'Type "DELETE" to confirm.');
  const sql = db();
  const [row] = await sql<{ password_hash: string }[]>`select password_hash from admins where id = ${admin.id}`;
  if (!row || !(await compare(String(body.password ?? ""), row.password_hash))) return fail(403, "Wrong password.");
  if (body.scope === "scores") {
    await sql`delete from scores`;
  } else if (body.scope === "everything") {
    await sql.begin(async (tx) => {
      await tx`delete from teams`; // cascades to members and scores
      await tx`delete from login_events where kind = 'team'`;
      await tx`update settings set value = 'false', updated_at = now()
               where key in ('leaderboard_visible', 'scores_visible', 'theme_revealed')`;
    });
    ["/", "/about", "/rules", "/schedule", "/leaderboard"].forEach((p) => revalidatePath(p));
  } else {
    return fail(400, "Unknown scope.");
  }

  const { ip, userAgent } = clientInfo(req);
  await logAudit({
    actorType: "admin",
    actorId: admin.email,
    action: `RESET_${body.scope.toUpperCase()}`,
    targetType: "database",
    details: { scope: body.scope },
    ip,
    userAgent,
  });

  return ok();
});
