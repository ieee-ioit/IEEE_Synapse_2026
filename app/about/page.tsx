import type { Metadata } from "next";
import InnerShell from "@/components/InnerShell";
import { Lock, Sparkle } from "@/components/icons";
import { headerCta } from "@/lib/cta";
import { event } from "@/lib/event";
import { formatDateRange, formatDateTime } from "@/lib/format";
import { getSettingsSafe, phaseOf } from "@/lib/settings";

export const revalidate = 300;
export const metadata: Metadata = { title: "About", description: event.about.intro };

export default async function AboutPage() {
  const s = await getSettingsSafe();
  const dates = formatDateRange(s.eventStart, s.submissionDeadline);
  const revealed = s.themeRevealed && s.themeTitle.trim();

  return (
    <InnerShell current="/about" cta={headerCta(phaseOf(s))} dates={dates}>
      <div className="page-head">
        <span className="badge">
          <Sparkle />
          About the event
        </span>
        <h1 className="page-title">
          One day to <em>build it for real</em>
        </h1>
        <p className="page-lede">{event.about.intro}</p>
      </div>

      <section className="section">
        <div className="section-label">Theme &amp; Tracks</div>
        <div className="theme-reveal">
          <div className="panel-title">Theme</div>
          <div className="theme-reveal-title">Build Beyond Code</div>
          <p style={{ marginTop: 8, color: "#d8d8d8" }}>
            Build Intelligent. Build Secure. Build for the Real World. Identify a Problem &rarr; Design a Solution &rarr; Build a Functional Prototype &rarr; Demonstrate its Impact.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginTop: 20 }}>
            {event.tracks.map((t) => (
              <div key={t.title} style={{ padding: 14, borderRadius: 8, background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <strong style={{ display: "block", color: "var(--gold-soft)", fontSize: 15, marginBottom: 4 }}>{t.title}</strong>
                <p style={{ margin: 0, fontSize: 13.5, color: "#bfbfcb", lineHeight: 1.45 }}>{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-label">Format</div>
        <ol className="steps">
          {event.about.format.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>

      <section className="section">
        <div className="section-label">Eligibility</div>
        <ul className="ticks">
          {event.about.eligibility.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="section">
        <div className="section-label">Prizes</div>
        <div className="prizes">
          {event.about.prizes.map((p) => (
            <div className="prize" key={p.place}>
              <div className="prize-place">{p.place}</div>
              <div className="prize-reward">{p.reward}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-label">When &amp; where</div>
        <dl className="kv">
          <dt>Dates</dt>
          <dd>{dates}</dd>
          <dt>Kick-off</dt>
          <dd>{formatDateTime(s.eventStart)}</dd>
          <dt>Deadline</dt>
          <dd>{formatDateTime(s.submissionDeadline)}</dd>
          <dt>Venue</dt>
          <dd>{event.venue}</dd>
        </dl>
      </section>
    </InnerShell>
  );
}
