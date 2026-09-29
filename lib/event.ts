/**
 * Everything the public site says lives in this file.
 *
 * `TODO_CONFIRM` marks a value the organisers have not confirmed yet
 * (LANDING_DEPLOYMENT_PLAN.md §2). The landing page renders a neutral
 * placeholder for it, and the public launch is blocked until none remain.
 * Timestamps cannot hold the literal (lib/settings.ts parses them when it loads),
 * so unconfirmed times keep a valid IST value and carry a TODO_CONFIRM comment.
 *
 * The event start, submission deadline and the theme can also be changed from
 * /admin without a redeploy; the dates here are only the defaults used until
 * an admin sets them. Keep the real theme OUT of this file (the repo may be
 * public) — enter it in /admin and flip "Reveal theme" when it's time.
 */

export const event = {
  name: "IEEE Hackathon", // TODO: final hackathon name (not in the plan's facts table)
  wordmark: { main: "IEEE", suffix: " Hackathon" }, // logo text; suffix renders at weight 400
  shortTagline: "6-Hour Offline Build Sprint",
  description:
    "A one-day, offline IEEE student hackathon. Form a team, pick a problem, build a working product in a 6-hour window, and pitch it to the judges.",
  venue: "TODO_CONFIRM", // venue and college name
  timezone: "Asia/Kolkata",
  defaults: {
    // Event date Oct 9, 2026 is CONFIRMED. The times of day below are NOT.
    eventStart: "2026-10-09T09:00:00+05:30", // TODO_CONFIRM: kick-off time (also editable in /admin)
    submissionDeadline: "2026-10-09T15:00:00+05:30", // TODO_CONFIRM: build start and deadline (also editable in /admin)
  },
  registrationCloseAt: "2026-10-07T00:00:00+05:30", // CONFIRMED: Unstop closes Oct 7, 2026 at 12 AM IST
  registerUrl: "TODO_CONFIRM", // your Unstop event page
  whatsappUrl: "TODO_CONFIRM", // your WhatsApp group invite link

  // Campaign tags added to the Unstop and WhatsApp links the landing page renders (plan §6 Task 8).
  utm: {
    register: { utm_source: "hackathon_site", utm_medium: "landing", utm_campaign: "register" },
    whatsapp: { utm_source: "hackathon_site", utm_medium: "landing", utm_campaign: "whatsapp" },
  },

  hero: {
    // Shown in the badge next to the event date.
    badgeFallback: "One-day offline student hackathon",
    line1: { before: "Start at sunrise with an ", em: "empty repo", after: "." },
    line2: "Ship it by sundown.",
    lede: "One day, one problem statement, one working product. Register your team, build from scratch in a 6-hour window, and pitch it to the judges.",
    primaryCta: "Register on Unstop",
    secondaryCta: "Join the WhatsApp group",
  },

  // Headline numbers (icons: workflow pills, download tile, avatars).
  stats: ["6-hour build window", "Prize pool: TODO_CONFIRM", "Max teams: TODO_CONFIRM"],

  nav: [
    { label: "About", href: "/about" },
    { label: "Rules", href: "/rules" },
    { label: "Schedule", href: "/schedule" },
    { label: "Leaderboard", href: "/leaderboard" },
  ],

  about: {
    intro:
      "A one-day, offline build sprint for student teams. You get the problem theme at kick-off, a 6-hour build window, and a panel of judges at the end. Everything you ship must be built during the event.",
    format: [
      "Register on Unstop before registrations close. Team size: TODO_CONFIRM.",
      "The theme is revealed at kick-off; you pick a problem inside it.",
      "Build from scratch in a GitHub repo during the 6-hour build window. Add the organizer reviewer as a collaborator.",
      "Submit your repo link from the team dashboard before the deadline.",
      "Top teams demo to the judges; the leaderboard goes live after judging.",
    ],
    eligibility: [
      "Open to currently enrolled undergraduate and postgraduate students.", // TODO
      "Cross-college teams are allowed.",
      "Each participant can be on only one team.",
      "Bring a laptop, charger and a valid college ID for check-in.",
    ],
    prizes: [
      { place: "Winner", reward: "TODO_CONFIRM" },
      { place: "Runner-up", reward: "TODO_CONFIRM" },
      { place: "Second runner-up", reward: "TODO_CONFIRM" },
    ],
  },

  rules: [
    "All code must be written during the event. Your repo's first commit must come after kick-off.",
    "Open-source libraries, frameworks and public APIs are allowed; pre-built projects are not. AI coding tools: TODO_CONFIRM.",
    "Keep the repo private during the build and add the organizer reviewer as a collaborator. Make it public at evaluation time.",
    "Commit early and often. A handful of giant commits will be reviewed manually.",
    "Only the team leader submits, from the team dashboard. Submissions after the deadline are not accepted.",
    "Judges' decisions are final. Any team found breaking the rules may be disqualified.",
  ],

  // Event-day timeline (times in the event timezone). Single day, Oct 9, 2026.
  // Every time is TODO_CONFIRM until the organisers fix the day's run of show.
  schedule: [
    { day: "Oct 9", time: "TODO_CONFIRM", title: "Check-in opens", detail: "Collect your team login chit and find your table." },
    { day: "Oct 9", time: "TODO_CONFIRM", title: "Kick-off & theme reveal", detail: "Opening talk, rules walkthrough, theme announced." },
    { day: "Oct 9", time: "TODO_CONFIRM", title: "Build window opens", detail: "Six hours to build. Commit early and often." },
    { day: "Oct 9", time: "TODO_CONFIRM", title: "Submission deadline", detail: "Submit your repo from the dashboard. Late submissions are not accepted." },
    { day: "Oct 9", time: "TODO_CONFIRM", title: "Judging", detail: "Top teams demo to the judges." },
    { day: "Oct 9", time: "TODO_CONFIRM", title: "Results & closing", detail: "Leaderboard goes live, prizes announced." },
  ],

  reviewerGithub: "your-reviewer-account", // TODO: GitHub username teams add as a collaborator (plan §6)
  codePrefix: "HK", // login codes look like HK-X7P2M9
  teamNumberStart: 101, // first auto-assigned team number when the CSV has none
};

export type EventConfig = typeof event;
