import type { CSSProperties } from "react";
import "./sky.css";

/**
 * The sky: gradient, sun on its arc, stars. Purely presentational.
 *
 * `progress` runs 0 (sunrise) to 1 (sundown). The component reads no scroll position and
 * no clock. Whoever renders it decides what progress means:
 *   - landing page: scroll position (a landing-only wrapper writes `--progress` on an
 *     ancestor with requestAnimationFrame, which wins over this prop)
 *   - future /event page (Release 2): the current time of day, passed as this prop
 *
 * All motion is CSS driven by that one number, see sky.css. Size it with `className`
 * (it fills its positioned parent) and put the horizon line with the `--sky-horizon`
 * custom property.
 */
export default function SkyScene({ progress, className }: { progress: number; className?: string }) {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  return (
    <div
      className={className ? `sky-scene ${className}` : "sky-scene"}
      style={{ "--sky-progress": p } as CSSProperties}
      aria-hidden="true"
    >
      <div className="sky-sky">
        <div className="sky-layer sky-layer--sunrise" />
        <div className="sky-layer sky-layer--morning" />
        <div className="sky-layer sky-layer--midday" />
        <div className="sky-layer sky-layer--afternoon" />
        <div className="sky-layer sky-layer--golden" />
        <div className="sky-layer sky-layer--dusk" />
        <div className="sky-stars" />
        <div className="sky-sun">
          <span className="sky-sun-warm" />
          <span className="sky-sun-bright" />
        </div>
      </div>
    </div>
  );
}
