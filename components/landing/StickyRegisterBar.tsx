"use client";

import { useEffect, useState } from "react";
import { cx, type Action } from "./content";
import { ActionLink } from "./PhaseLink";
import { usePhase } from "./usePhase";

/**
 * Bottom action bar for phones. It appears once the hero buttons have scrolled out of view
 * and hides again while the final call-to-action is on screen, so only one register
 * button is ever visible. Desktop never shows it (see landing.css).
 */
export default function StickyRegisterBar({
  start,
  deadline,
  pre,
  live,
}: {
  start: string;
  deadline: string;
  pre: Action;
  live: Action;
}) {
  const phase = usePhase(start, deadline);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero-actions");
    const final = document.getElementById("final-actions");
    if (!hero || typeof IntersectionObserver === "undefined") return;

    let heroGone = false;
    let finalOnScreen = false;
    const update = () => setVisible(heroGone && !finalOnScreen);

    const heroObserver = new IntersectionObserver(([entry]) => {
      // "Gone" means scrolled past the top, not merely below the fold on a short screen.
      heroGone = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      update();
    });
    heroObserver.observe(hero);

    const finalObserver = final
      ? new IntersectionObserver(([entry]) => {
          finalOnScreen = entry.isIntersecting;
          update();
        })
      : null;
    if (final) finalObserver?.observe(final);

    return () => {
      heroObserver.disconnect();
      finalObserver?.disconnect();
    };
  }, []);

  const action = phase === "pre" ? pre : live;
  if (action.href === null) return null; // nothing useful to pin while the link is unconfirmed

  return (
    <div className={cx("gh-bar", visible && "is-visible")}>
      <ActionLink action={action} className="btn btn-solid gh-bar-btn" />
    </div>
  );
}
