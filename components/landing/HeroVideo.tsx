"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "./content";

type Connection = { saveData?: boolean };

/**
 * The particle ridge. The poster is a CSS background, so the first paint never waits for video.
 * The video element is only created after hydration and only when it is welcome:
 *   - not with prefers-reduced-motion
 *   - not with data saver on (navigator.connection.saveData)
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
    const saveData = Boolean((navigator as Navigator & { connection?: Connection }).connection?.saveData);
    const tiny = window.matchMedia("(max-width: 359px)").matches;
    const phone = window.matchMedia("(max-width: 700px)").matches;
    const chosen = phone ? mobileSrc : desktopSrc;
    if (reduced.matches || saveData || tiny || !chosen) return;

    setSrc(chosen);
    const onReduced = () => {
      if (reduced.matches) video.current?.pause();
    };
    reduced.addEventListener("change", onReduced);
    return () => reduced.removeEventListener("change", onReduced);
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
