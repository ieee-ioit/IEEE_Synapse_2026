import type { Metadata } from "next";
import Analytics from "@/components/landing/Analytics";
import { Chapters, LandingFooter, StickyBar } from "@/components/landing/Chapters";
import GoldenHours from "@/components/landing/GoldenHours";
import Horizon from "@/components/landing/Horizon";
import PhaseLink from "@/components/landing/PhaseLink";
import SiteHeader from "@/components/SiteHeader";
import { event } from "@/lib/event";

// STATIC. Nothing here may import lib/db.ts or lib/settings.ts (or anything that opens a database
// connection): the landing page must keep working when the database does not. The event phase is
// decided in the browser from the dates in lib/event.ts.
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return (
    <>
      <GoldenHours scene={<Horizon />}>
        <div className="menu-backdrop" aria-hidden="true" />
        <SiteHeader
          logoHref="#top"
          ctaNode={
            <PhaseLink
              start={event.defaults.eventStart}
              deadline={event.defaults.submissionDeadline}
              pre={{ label: "Team Login", href: "/team/login" }}
              live={{ label: "Team Login", href: "/team/login" }}
              className="btn btn-solid header-cta"
            />
          }
        />
        <Chapters />
        <LandingFooter />
      </GoldenHours>
      <StickyBar />
      <Analytics />
    </>
  );
}
