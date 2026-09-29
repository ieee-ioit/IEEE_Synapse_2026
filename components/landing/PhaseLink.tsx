"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cx, type Action, type Phase } from "./content";
import { usePhase } from "./usePhase";

type Dates = { start: string; deadline: string };

function ActionLink({ action, className }: { action: Action; className: string }) {
  if (action.href === null) {
    // Unconfirmed target: a neutral, non-interactive placeholder instead of a dead link.
    return (
      <span className={cx(className, "is-pending")} aria-disabled="true">
        {action.pending ?? "Coming soon"}
      </span>
    );
  }
  if (action.external) {
    return (
      <a className={className} href={action.href} target="_blank" rel="noopener noreferrer">
        {action.label}
      </a>
    );
  }
  return (
    <Link className={className} href={action.href}>
      {action.label}
    </Link>
  );
}

/** Pre-event shows `pre` (register / WhatsApp). During and after the event shows `live` (team login / leaderboard). */
export default function PhaseLink({
  start,
  deadline,
  pre,
  live,
  className,
}: Dates & { pre: Action; live: Action; className: string }) {
  const phase = usePhase(start, deadline);
  return <ActionLink action={phase === "pre" ? pre : live} className={className} />;
}

/** Renders its children only in the given phases. Children are server-rendered; only the visibility is decided here. */
export function PhaseOnly({ start, deadline, when, children }: Dates & { when: Phase | Phase[]; children: ReactNode }) {
  const phase = usePhase(start, deadline);
  const phases = Array.isArray(when) ? when : [when];
  return phases.includes(phase) ? <>{children}</> : null;
}

export { ActionLink };
