// Pure helpers for the landing page. No database, no server-only imports: the page stays static.

/** Marker used in lib/event.ts for a fact the organisers have not confirmed (plan §2). */
export const TODO = "TODO_CONFIRM";

export const isTodo = (value: string) => value.includes(TODO);

/** Neutral placeholder for any unconfirmed fragment, so the marker itself never reaches a visitor. */
export const tbc = (value: string, fallback = "TBA") => value.split(TODO).join(fallback);

/**
 * Adds the UTM tags from lib/event.ts (plus a per-placement utm_content) to an outbound link.
 * Returns null while the base URL is unconfirmed or malformed, and the caller shows a placeholder.
 */
export function trackedUrl(base: string, tags: Record<string, string>, content: string): string | null {
  if (isTodo(base)) return null;
  try {
    const url = new URL(base);
    for (const [key, value] of Object.entries(tags)) url.searchParams.set(key, value);
    url.searchParams.set("utm_content", content);
    return url.toString();
  } catch {
    return null;
  }
}

/** Short date and time, like "Jan 5, 12 AM", from an absolute timestamp, in the event's timezone (assembled from parts: stable across ICU builds). */
export function formatCloseTime(iso: string, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  const minutes = parts.minute && parts.minute !== "00" ? `:${parts.minute}` : "";
  return `${parts.month} ${parts.day}, ${parts.hour}${minutes} ${parts.dayPeriod}`;
}

/** A link or button the landing page renders. `href: null` means the target is unconfirmed. */
export type Action = { label: string; href: string | null; external?: boolean; pending?: string };

export type Phase = "pre" | "live" | "closed";

export const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");
