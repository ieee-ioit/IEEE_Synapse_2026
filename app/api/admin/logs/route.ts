import { db } from "@/lib/db";
import { fail, failWithReference, ok } from "@/lib/http";
import { getAdmin } from "@/lib/session";

export async function GET(req: Request) {
  try {
    const admin = await getAdmin();
    if (!admin) return fail(401, "Your admin session has expired. Log in again.");

    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") || "audit";
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || 50)));
    const offset = Math.max(0, Number(searchParams.get("offset") || 0));
    const search = (searchParams.get("q") || "").trim().toLowerCase();

    const sql = db();

    // Stats
    const [[{ count: totalAudits }], [{ count: totalErrors }], [{ count: recentErrors }]] =
      await Promise.all([
        sql<{ count: number }[]>`select count(*)::int as count from audit_logs`,
        sql<{ count: number }[]>`select count(*)::int as count from error_logs`,
        sql<{ count: number }[]>`select count(*)::int as count from error_logs where created_at >= now() - interval '24 hours'`,
      ]);

    if (tab === "error") {
      let rows;
      if (search) {
        rows = await sql`
          select id, level, endpoint, message, stack, context, ip, user_agent, created_at
          from error_logs
          where lower(endpoint) like ${"%" + search + "%"} 
             or lower(message) like ${"%" + search + "%"} 
             or lower(level) = ${search}
          order by created_at desc
          limit ${limit} offset ${offset}`;
      } else {
        rows = await sql`
          select id, level, endpoint, message, stack, context, ip, user_agent, created_at
          from error_logs
          order by created_at desc
          limit ${limit} offset ${offset}`;
      }
      return ok({
        tab: "error",
        stats: { totalAudits, totalErrors, recentErrors },
        logs: rows,
      });
    }

    // Default: audit
    let rows;
    if (search) {
      rows = await sql`
        select id, actor_type, actor_id, action, target_type, target_id, details, ip, user_agent, created_at
        from audit_logs
        where lower(action) like ${"%" + search + "%"}
           or lower(actor_id) like ${"%" + search + "%"}
           or lower(target_type) like ${"%" + search + "%"}
           or lower(actor_type) = ${search}
        order by created_at desc
        limit ${limit} offset ${offset}`;
    } else {
      rows = await sql`
        select id, actor_type, actor_id, action, target_type, target_id, details, ip, user_agent, created_at
        from audit_logs
        order by created_at desc
        limit ${limit} offset ${offset}`;
    }

    return ok({
      tab: "audit",
      stats: { totalAudits, totalErrors, recentErrors },
      logs: rows,
    });
  } catch (err) {
    return failWithReference(err, req);
  }
}
