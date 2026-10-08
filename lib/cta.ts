import type { Cta } from "@/components/SiteHeader";
import type { Phase } from "./settings";

/** Header CTA: registrations are closed, so teams go to their login before and during the event. */
export function headerCta(_phase: Phase): Cta {
  return { label: "Team Login", href: "/team/login" };
}
