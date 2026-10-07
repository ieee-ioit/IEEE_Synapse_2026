import type { Metadata } from "next";
import { db } from "@/lib/db";
import LogsViewer from "./LogsViewer";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Logs & Audit Trail" };
export const dynamic = "force-dynamic";

export default async function LogsPage() {
  await requireAdmin();
  const sql = db();

  const [
    [{ count: totalAudits }],
    [{ count: totalErrors }],
    [{ count: recentErrors }],
    initialLogs,
  ] = await Promise.all([
    sql<{ count: number }[]>`select count(*)::int as count from audit_logs`,
    sql<{ count: number }[]>`select count(*)::int as count from error_logs`,
    sql<{ count: number }[]>`select count(*)::int as count from error_logs where created_at >= now() - interval '24 hours'`,
    sql`
      select id, actor_type, actor_id, action, target_type, target_id, details, ip, user_agent, created_at
      from audit_logs
      order by created_at desc
      limit 50`,
  ]);

  const stats = { totalAudits, totalErrors, recentErrors };

  return (
    <>
      <h1 className="admin-h1">
        Audit &amp; <em>Error Logs</em>
      </h1>
      <p className="admin-sub">
        Real-time operational visibility into all administrative imports, settings modifications,
        team deliverable updates, and application runtime exceptions.
      </p>

      <section className="admin-section">
        <LogsViewer
          initialTab="audit"
          initialStats={stats}
          initialLogs={initialLogs as any[]}
        />
      </section>
    </>
  );
}
