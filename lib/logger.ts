import "server-only";
import { db } from "./db";

export interface AuditLogOptions {
  actorType: "admin" | "team" | "system";
  actorId?: string | number | null;
  action: string;
  targetType?: string;
  targetId?: string | null;
  details?: Record<string, unknown> | null;
  ip?: string;
  userAgent?: string;
}

export interface ErrorLogOptions {
  level?: "warn" | "error" | "fatal";
  endpoint: string;
  message?: string;
  stack?: string;
  context?: Record<string, unknown> | null;
  ip?: string;
  userAgent?: string;
}

/**
 * Persists an administrative or system event to audit_logs.
 * Non-blocking: logs any DB failure to console without throwing.
 */
export async function logAudit(options: AuditLogOptions): Promise<void> {
  try {
    const sql = db();
    const actorId = options.actorId != null ? String(options.actorId) : "";
    const targetType = options.targetType || "";
    const targetId = options.targetId != null ? String(options.targetId) : "";
    const details = options.details ? JSON.stringify(options.details) : "{}";
    const ip = (options.ip || "").slice(0, 64);
    const userAgent = (options.userAgent || "").slice(0, 300);

    await sql`
      insert into audit_logs (
        actor_type, actor_id, action, target_type, target_id, details, ip, user_agent
      ) values (
        ${options.actorType},
        ${actorId},
        ${options.action},
        ${targetType},
        ${targetId},
        ${details}::jsonb,
        ${ip},
        ${userAgent}
      )`;
  } catch (err) {
    console.error("[audit_log failure]", err);
  }
}

/**
 * Persists an application error to error_logs.
 * Non-blocking: never crashes callers if logging fails.
 */
export async function logError(err: unknown, options: ErrorLogOptions): Promise<void> {
  const errMsg =
    options.message ||
    (err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error");
  const errStack =
    options.stack || (err instanceof Error && err.stack ? err.stack : "");

  console.error(`[error_log] [${options.endpoint}]`, err);

  try {
    const sql = db();
    const level = options.level || "error";
    const context = options.context ? JSON.stringify(options.context) : "{}";
    const ip = (options.ip || "").slice(0, 64);
    const userAgent = (options.userAgent || "").slice(0, 300);

    await sql`
      insert into error_logs (
        level, endpoint, message, stack, context, ip, user_agent
      ) values (
        ${level},
        ${options.endpoint},
        ${errMsg},
        ${errStack},
        ${context}::jsonb,
        ${ip},
        ${userAgent}
      )`;
  } catch (logErr) {
    console.error("[error_log failure]", logErr);
  }
}
