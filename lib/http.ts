import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdmin, type AdminUser } from "./session";

export const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });

export const ok = (data: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });

/**
 * CSRF guard for cookie-authenticated mutations: the body must be JSON (plain
 * cross-site forms can't send that without a CORS preflight) and, when the
 * browser sends an Origin, it must be this site.
 */
export const MAX_BODY_BYTES = 1_000_000;
export class BodyTooLarge extends Error {}

export async function readJsonBody<T>(req: Request, maxBytes?: number): Promise<T | null> {
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return null;
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    try {
      if (new URL(origin).host !== host) return null;
    } catch {
      return null;
    }
  }
  if (maxBytes && Number(req.headers.get("content-length") ?? 0) > maxBytes) throw new BodyTooLarge();
  let text: string;
  try {
    text = await req.text();
  } catch {
    return null;
  }
  if (maxBytes && text.length > maxBytes) throw new BodyTooLarge();
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function clientInfo(req: Request) {
  return {
    ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64),
    userAgent: (req.headers.get("user-agent") ?? "").slice(0, 300),
  };
}

import { logError } from "./logger";

/**
 * Logs the full error to error_logs and returns a generic message with a short reference
 * the organizer can search for in /admin/logs. Never sends error details to the browser.
 */
export async function failWithReference(err: unknown, req: Request, status = 500) {
  const requestId = randomUUID().slice(0, 8);
  const { ip, userAgent } = clientInfo(req);
  let endpoint = "api";
  try {
    endpoint = new URL(req.url).pathname;
  } catch {}
  await logError(err, { endpoint, ip, userAgent, context: { requestId } });
  return fail(status, `Something went wrong. Reference: ${requestId}`, { requestId });
}

type AdminHandler<T> = (admin: AdminUser, body: T, req: Request) => Promise<Response>;

/** Wraps an admin-only JSON endpoint: auth + CSRF + error handling. */
export function adminRoute<T>(handler: AdminHandler<T>) {
  return async (req: Request) => {
    let admin: AdminUser | null;
    try {
      admin = await getAdmin();
    } catch (err) {
      // e.g. the database is unreachable — don't reveal anything to an unauthenticated caller.
      return failWithReference(err, req, 503);
    }
    if (!admin) return fail(401, "Your admin session has expired. Log in again.");
    try {
      const body = await readJsonBody<T>(req, MAX_BODY_BYTES);
      if (body === null) return fail(400, "Expected a JSON request from this site.");
      return await handler(admin, body, req);
    } catch (err) {
      if (err instanceof BodyTooLarge) return fail(413, "That upload is too large (max 1 MB). Split the file and try again.");
      return failWithReference(err, req);
    }
  };
}
