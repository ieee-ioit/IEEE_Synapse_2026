"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scroll is the clock. This wrapper is the only place that reads the scroll position.
 * It maps scrollY to 0..1 and writes it to `--progress` on the scene wrapper, which SkyScene and the
 * ridge tint read. Writes happen in a requestAnimationFrame, from a passive listener, and touch
 * only that one element, so the chapters never re-render or re-style while scrolling.
 *
 * Chapters carry `data-chapter`. Chapter i of n lands at progress i / (n - 1), when it is centred in
 * the viewport, and progress is linear between chapters. The first chapter is progress 0 at the top
 * of the page; anything after the last chapter (the footer) stays at 1.
 *
 * Without JavaScript nothing here runs and the sky stays at sunrise (progress 0).
 */
export default function GoldenHours({ scene, children }: { scene: ReactNode; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const sceneEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rootEl = root.current;
    const target = sceneEl.current;
    if (!rootEl || !target) return;

    let anchors: number[] = [];
    let frame = 0;
    let last = -1;

    const measure = () => {
      const viewport = window.innerHeight;
      const top = window.scrollY;
      let previous = -Infinity;
      anchors = Array.from(rootEl.querySelectorAll<HTMLElement>("[data-chapter]")).map((chapter, i) => {
        const box = chapter.getBoundingClientRect();
        const centred = i === 0 ? 0 : Math.max(0, box.top + top + box.height / 2 - viewport / 2);
        previous = Math.max(centred, previous + 1); // strictly increasing, so interpolation never divides by zero
        return previous;
      });
    };

    const progressAt = (y: number) => {
      const n = anchors.length;
      if (n < 2 || y <= anchors[0]) return 0;
      if (y >= anchors[n - 1]) return 1;
      let i = 1;
      while (anchors[i] < y) i++;
      const t = (y - anchors[i - 1]) / (anchors[i] - anchors[i - 1]);
      return (i - 1 + t) / (n - 1);
    };

    const write = () => {
      frame = 0;
      const p = progressAt(window.scrollY);
      if (p === last) return;
      last = p;
      target.style.setProperty("--progress", p.toFixed(4));
      rootEl.style.setProperty("--progress", p.toFixed(4));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(write);
    };
    const remeasure = () => {
      measure();
      last = -1;
      schedule();
    };

    remeasure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", remeasure);
    // Fonts and images change chapter heights after first paint.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(remeasure);
    observer?.observe(rootEl);
    document.fonts?.ready.then(remeasure);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", remeasure);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={root} className="gh">
      <div className="gh-progress-bar" aria-hidden="true">
        <div className="gh-progress-bar-fill" />
      </div>
      <div ref={sceneEl} className="gh-scene" aria-hidden="true">
        {scene}
      </div>
      {children}
    </div>
  );
}
