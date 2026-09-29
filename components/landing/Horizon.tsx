import SkyScene from "@/components/sky/SkyScene";
import { RIDGE_POSTER, RIDGE_VIDEO, RIDGE_VIDEO_MOBILE } from "./assets";
import HeroVideo from "./HeroVideo";

/**
 * The fixed backdrop: sky, hill, and the particle ridge tinted by the time of day.
 *
 * Tint: the ridge media is white particles on black. It is multiplied by a colour that moves from white
 * (sunrise) through gold to indigo (dusk), then the whole group is screened over the sky, so the black
 * drops out and only the tinted particles remain. The existing asset is not changed.
 */
export default function Horizon() {
  return (
    <>
      <SkyScene progress={0} />
      <div className="gh-ground" />
      <div className="gh-horizon">
        <div className="gh-tint gh-tint--gold" />
        <div className="gh-tint gh-tint--dusk" />
        <HeroVideo poster={RIDGE_POSTER} desktopSrc={RIDGE_VIDEO} mobileSrc={RIDGE_VIDEO_MOBILE} />
      </div>
    </>
  );
}
