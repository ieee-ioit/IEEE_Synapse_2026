import Link from "next/link";
import { LogoMark, Sparkle } from "@/components/icons";
import { event } from "@/lib/event";
import { formatDateRange } from "@/lib/format";
import { formatCloseTime, tbc, trackedUrl, type Action } from "./content";
import PhaseLink, { PhaseOnly } from "./PhaseLink";
import StickyRegisterBar from "./StickyRegisterBar";

// Everything below reads lib/event.ts. The only literals here are headlines and labels, never facts.

const { hero } = event;
const dates = { start: event.defaults.eventStart, deadline: event.defaults.submissionDeadline };
const dateLine = formatDateRange(event.defaults.eventStart, event.defaults.eventStart); // single-day event
const closeLabel = formatCloseTime(event.registrationCloseAt, event.timezone);

/** Register and WhatsApp before the event; team login and leaderboard during and after. `content` tags the placement in the UTM. */
function actions(content: string): { register: [Action, Action]; whatsapp: [Action, Action] } {
  return {
    register: [
      {
        label: hero.primaryCta,
        href: trackedUrl(event.registerUrl, event.utm.register, content),
        external: true,
        pending: "Registration link coming soon",
      },
      { label: "Team Login", href: "/team/login" },
    ],
    whatsapp: [
      {
        label: hero.secondaryCta,
        href: trackedUrl(event.whatsappUrl, event.utm.whatsapp, content),
        external: true,
        pending: "WhatsApp link coming soon",
      },
      { label: "Live Leaderboard", href: "/leaderboard" },
    ],
  };
}

const Em = ({ children }: { children: string }) => <em>{children}</em>;

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="gh-eyebrow">
      <span className="gh-dot" aria-hidden="true" />
      {children}
    </p>
  );
}

function CtaRow({ id, content }: { id: string; content: string }) {
  const a = actions(content);
  return (
    <div className="gh-actions" id={id}>
      <PhaseLink {...dates} pre={a.register[0]} live={a.register[1]} className="btn btn-solid" />
      <PhaseLink {...dates} pre={a.whatsapp[0]} live={a.whatsapp[1]} className="btn btn-ghost" />
    </div>
  );
}

export function Chapters() {
  // Rules summary for chapter 3. Picked by position from event.rules and event.stats:
  // build window, nothing pre-built, private repo with the reviewer added as collaborator.
  const rulesSummary = [event.stats[0], event.rules[0], event.rules[2]];

  return (
    <main>
      {/* 1. Sunrise */}
      <section id="top" className="gh-chapter gh-chapter--hero" data-chapter="sunrise" aria-labelledby="hero-title">
        <div className="gh-card">
          <p className="gh-eyebrow">{event.name}</p>
          <span className="badge">
            <Sparkle />
            {dateLine} · {tbc(hero.badgeFallback)}
          </span>
          <h1 id="hero-title" className="gh-title gh-title--hero">
            <span className="gh-line">
              {hero.line1.before}
              <Em>{hero.line1.em}</Em>
              {hero.line1.after}
            </span>
            <span className="gh-line">{hero.line2}</span>
          </h1>
          <p className="gh-lede">{tbc(hero.lede)}</p>
          <CtaRow id="hero-actions" content="hero" />
          <PhaseOnly {...dates} when="pre">
            <p className="gh-note">Registrations close {closeLabel}</p>
          </PhaseOnly>
        </div>
      </section>

      {/* 2. Morning */}
      <section className="gh-chapter" data-chapter="morning" aria-labelledby="ch-morning">
        <div className="gh-card">
          <Eyebrow>Morning</Eyebrow>
          <h2 id="ch-morning" className="gh-title">
            Bring a team. <Em>Leave with a product.</Em>
          </h2>
          <p className="gh-lede">{tbc(event.about.intro)}</p>
          <ol className="steps gh-steps">
            {event.about.format.map((step) => (
              <li key={tbc(step)}>{tbc(step)}</li>
            ))}
          </ol>
        </div>
      </section>

      {/* 3. Midday */}
      <section className="gh-chapter" data-chapter="midday" aria-labelledby="ch-midday">
        <div className="gh-card">
          <Eyebrow>Midday</Eyebrow>
          <h2 id="ch-midday" className="gh-title">
            The rules, <Em>in brief.</Em>
          </h2>
          <ul className="ticks gh-steps">
            {rulesSummary.map((rule) => (
              <li key={tbc(rule)}>{tbc(rule)}</li>
            ))}
          </ul>
          <Link className="gh-link" href="/rules">
            Read all the rules <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* 4. Afternoon */}
      <section className="gh-chapter" data-chapter="afternoon" aria-labelledby="ch-afternoon">
        <div className="gh-card">
          <Eyebrow>Afternoon</Eyebrow>
          <h2 id="ch-afternoon" className="gh-title">
            How the <Em>day</Em> runs.
          </h2>
          <ol className="gh-timeline">
            {event.schedule.map((item) => (
              <li key={item.title}>
                <span className="gh-time">{tbc(item.time)}</span>
                <span>{item.title}</span>
              </li>
            ))}
          </ol>
          <Link className="gh-link" href="/schedule">
            See the full schedule <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* 5. Golden hour */}
      <section className="gh-chapter" data-chapter="golden" aria-labelledby="ch-golden">
        <div className="gh-card">
          <Eyebrow>Golden hour</Eyebrow>
          <h2 id="ch-golden" className="gh-title">
            What&rsquo;s on <Em>the line.</Em>
          </h2>
          <div className="gh-prizes">
            {event.about.prizes.map((prize) => (
              <div className="gh-prize" key={prize.place}>
                <span className="gh-prize-place">{prize.place}</span>
                <strong className="gh-prize-reward">{tbc(prize.reward)}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Dusk */}
      <section className="gh-chapter" data-chapter="dusk" aria-labelledby="ch-dusk">
        <div className="gh-card">
          <Eyebrow>Dusk</Eyebrow>
          <h2 id="ch-dusk" className="gh-title">
            Last light. <Em>Save your spot.</Em>
          </h2>
          <PhaseOnly {...dates} when="pre">
            <p className="gh-lede">Registrations close {closeLabel}.</p>
          </PhaseOnly>
          <CtaRow id="final-actions" content="final" />
          {/* UNCLEAR: the plan asks for a contact line here and in the footer, but lib/event.ts has no contact
              field and the plan allows no structural change to that file. A neutral placeholder is shown.
              Needs a decision: add `contact` (and `organisers`, `sponsors`) to lib/event.ts. */}
          <p className="gh-note">Questions? Contact details to be announced.</p>
        </div>
      </section>
    </main>
  );
}

/** Phone-only bar pinned to the bottom once the hero buttons scroll away. */
export function StickyBar() {
  const a = actions("sticky");
  return <StickyRegisterBar {...dates} pre={a.register[0]} live={a.register[1]} />;
}

export function LandingFooter() {
  return (
    <footer className="gh-foot">
      <div className="gh-foot-inner">
        <div className="gh-foot-brand">
          <LogoMark />
          <span>
            {event.wordmark.main}
            <span className="logo-suffix">{event.wordmark.suffix}</span>
          </span>
        </div>
        <p className="gh-foot-line">Organised by the IEEE Student Branch.</p>
        <dl className="gh-foot-facts">
          <div>
            <dt>Date</dt>
            <dd>{dateLine}</dd>
          </div>
          <div>
            <dt>Venue</dt>
            <dd>{tbc(event.venue, "To be announced")}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>To be announced</dd>
          </div>
        </dl>
        {/* Sponsor slot: reserved, no sponsors are named in lib/event.ts yet. */}
        <div className="gh-sponsor">Sponsors to be announced</div>
        <nav className="gh-foot-nav" aria-label="Footer">
          {event.nav.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link href="/team/login">Team login</Link>
        </nav>
      </div>
    </footer>
  );
}
