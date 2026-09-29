// Media for the hero. These are asset locations, not event facts (those live in lib/event.ts).

/** The existing particle-ridge video, unchanged. */
export const RIDGE_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260818_072341_50851634-bbc3-4c33-9acc-7647d4db44aa.mp4";

/**
 * Smaller source for phones (plan §4.5: about 1.5 MB or less). NOT PROVIDED YET: the existing file is
 * about 9.5 MB and no transcoder is available here. Until this is set, phones get the poster only, so
 * they never download the 9.5 MB file. Set it to the path of the transcoded file (for example under /public).
 */
export const RIDGE_VIDEO_MOBILE: string | null = null;

/** Static first frame, painted from CSS so the page never waits for video. Lives in /public/landing. */
export const RIDGE_POSTER = "/landing/ridge-poster.svg";
