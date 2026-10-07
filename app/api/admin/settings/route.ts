import { revalidatePath } from "next/cache";
import { adminRoute, clientInfo, fail, ok } from "@/lib/http";
import { logAudit } from "@/lib/logger";
import { getSettings, updateSettings, type Settings } from "@/lib/settings";

const PUBLIC_PAGES = ["/", "/about", "/rules", "/schedule", "/leaderboard"];

export const PUT = adminRoute<Partial<Settings>>(async (admin, body, req) => {
  const patch: Partial<Settings> = {};

  for (const k of ["eventStart", "submissionDeadline"] as const) {
    if (body[k] === undefined) continue;
    const t = Date.parse(String(body[k]));
    if (Number.isNaN(t)) return fail(400, `Invalid date for ${k}.`);
    patch[k] = new Date(t).toISOString();
  }
  for (const k of ["leaderboardVisible", "scoresVisible", "themeRevealed"] as const) {
    if (body[k] === undefined) continue;
    if (typeof body[k] !== "boolean") return fail(400, `${k} must be true or false.`);
    patch[k] = body[k];
  }
  if (body.themeTitle !== undefined) patch.themeTitle = String(body.themeTitle).trim().slice(0, 140);
  if (body.themeDescription !== undefined) patch.themeDescription = String(body.themeDescription).trim().slice(0, 4000);
  if (body.videoUnlockAt !== undefined) {
    // "" resets to the default (event start + 4 h).
    const v = String(body.videoUnlockAt).trim();
    if (v && Number.isNaN(Date.parse(v))) return fail(400, "Invalid date for videoUnlockAt.");
    patch.videoUnlockAt = v ? new Date(Date.parse(v)).toISOString() : "";
  }
  if (body.finalistCount !== undefined) {
    const n = Number(body.finalistCount);
    if (!Number.isInteger(n) || n < 1 || n > 50) return fail(400, "finalistCount must be a whole number from 1 to 50.");
    patch.finalistCount = n;
  }
  if (body.expectedJudges !== undefined) patch.expectedJudges = String(body.expectedJudges).trim().slice(0, 500);

  const current = await getSettings();
  const start = patch.eventStart ?? current.eventStart;
  const end = patch.submissionDeadline ?? current.submissionDeadline;
  if (Date.parse(end) <= Date.parse(start)) return fail(400, "The submission deadline must be after the event start.");
  if ((patch.themeRevealed ?? current.themeRevealed) && !(patch.themeTitle ?? current.themeTitle)) {
    return fail(400, "Add a theme title before revealing it.");
  }

  await updateSettings(patch);

  const { ip, userAgent } = clientInfo(req);
  await logAudit({
    actorType: "admin",
    actorId: admin.email,
    action: "SETTINGS_UPDATE",
    targetType: "settings",
    details: patch as Record<string, unknown>,
    ip,
    userAgent,
  });

  PUBLIC_PAGES.forEach((p) => revalidatePath(p));
  return ok({ settings: await getSettings() });
});
