"use client";

import { useEffect, useState } from "react";
import type { Phase } from "./content";

/**
 * Event phase from the dates in lib/event.ts, never from the database.
 * The server render and the first client render are always "pre", so the static HTML shows the
 * register links and hydration matches; the real phase is applied right after mount.
 */
export function usePhase(start: string, deadline: string): Phase {
  const [phase, setPhase] = useState<Phase>("pre");
  useEffect(() => {
    const s = Date.parse(start);
    const e = Date.parse(deadline);
    const read = (): Phase => {
      const now = Date.now();
      return now < s ? "pre" : now < e ? "live" : "closed";
    };
    setPhase(read());
    const id = setInterval(() => setPhase(read()), 30_000);
    return () => clearInterval(id);
  }, [start, deadline]);
  return phase;
}
