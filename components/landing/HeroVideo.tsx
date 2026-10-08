"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "./content";

type Connection = { saveData?: boolean; effectiveType?: string; downlink?: number };

/** The video is ~9.5 MB: only worth it on a fast connection. Unknown connection (Safari, Firefox) counts as fast. */
function fastConnection(c: Connection | undefined) {
  if (!c) return true;
  if (c.effectiveType && c.effectiveType !== "4g") return false; // slow-2g, 2g, 3g
  return !(typeof c.downlink === "number" && c.downlink > 0 && c.downlink < 2); // Mbit/s
}

/**
 * The particle ridge. The poster is a CSS background, so the first paint never waits for video.
 * The video element is only created after the page has finished loading and only when it is welcome:
 *   - not with prefers-reduced-motion
 *   - not with data saver on, or on a slow (2G/3G, under 2 Mbit/s) connection
 *   - not on very small viewports
 *   - not on phones until a smaller mobile source exists (see assets.ts)
 * Anything else keeps the poster. Text and buttons never depend on this component.
 */
export default function HeroVideo({
  poster,
  desktopSrc,
  mobileSrc,
}: {
  poster: string;
  desktopSrc: string;
  mobileSrc: string | null;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: Connection }).connection;
    const tiny = window.matchMedia("(max-width: 359px)").matches;
    const phone = window.matchMedia("(max-width: 700px)").matches;
    const chosen = phone ? mobileSrc : desktopSrc;
    if (reduced.matches || connection?.saveData || !fastConnection(connection) || tiny || !chosen) return;

    // Wait until the page itself (fonts, images, scripts) has loaded, so the video never competes with it.
    let cancelled = false;
    const start = () => !cancelled && setSrc(chosen);
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });

    const onReduced = () => {
      if (reduced.matches) video.current?.pause();
    };
    reduced.addEventListener("change", onReduced);
    return () => {
      cancelled = true;
      window.removeEventListener("load", start);
      reduced.removeEventListener("change", onReduced);
    };
  }, [desktopSrc, mobileSrc]);

  useEffect(() => {
    const el = video.current;
    if (!el || !src) return;
    el.muted = true; // React does not reliably render the muted attribute; iOS needs it before autoplay
    el.play().catch(() => {}); // autoplay refused: the poster stays
  }, [src]);

  return (
    <div className="gh-ridge" style={{ backgroundImage: `url(${poster})` }}>
      {src && (
        <video
          ref={video}
          className={cx("gh-ridge-video", ready && "is-ready")}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          onCanPlay={() => setReady(true)}
        />
      )}
    </div>
  );
}
