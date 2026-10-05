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
  name: "IEEE SYNAPSE 2026",
  wordmark: { main: "IEEE", suffix: " SYNAPSE 2026" }, // logo text; suffix renders at weight 400
  shortTagline: "BUILD BEYOND CODE: 6-Hour Offline Build Sprint",
  description:
    "An offline technology and innovation hackathon organized by the IEEE Student Branch, AISSMS IOIT Pune. Build Intelligent. Build Secure. Build for the Real World.",
  venue: "AISSMS Institute of Information Technology (IOIT), Pune",
  venueUrl: "https://aissmsioit.org/",
  timezone: "Asia/Kolkata",
  defaults: {
    // Event date Oct 9, 2026. Build window 09:00 to 15:00 IST (6 hours).
    eventStart: "2026-10-09T09:00:00+05:30",
    submissionDeadline: "2026-10-09T15:00:00+05:30",
  },
  registrationCloseAt: "2026-10-05T00:00:00+05:30", // Closed early due to capacity reached
  registrationClosed: true,
  registrationClosedMessage: "Registrations closed early — Housefull! Participation exceeded venue capacity.",
  registerUrl: "https://unstop.com/o/9wkXWNc?lb=useiidKW&utm_medium=Share&utm_source=online_coding_challenge&utm_campaign=Nlbkyedh98376",
  paymentFormUrl: "https://forms.gle/UhCtgharsh9VfR899",
  whatsappUrl: "https://chat.whatsapp.com/JlVDNdsMD2w5qGNXXP12tl",

  // Campaign tags added to the Unstop and WhatsApp links the landing page renders (plan §6 Task 8).
  utm: {
    register: { utm_source: "hackathon_site", utm_medium: "landing", utm_campaign: "register" },
    whatsapp: { utm_source: "hackathon_site", utm_medium: "landing", utm_campaign: "whatsapp" },
  },

  hero: {
    // Shown in the badge next to the event date.
    badgeFallback: "AISSMS IOIT Pune · 6-Hour Offline Hackathon",
    line1: { before: "Start at sunrise with an ", em: "empty repo", after: "." },
    line2: "Ship it by sundown.",
    lede: "One day, one problem statement, one working product. Registrations are now closed early as participation exceeded expectations and capacity. Build from scratch in a 6-hour window, and pitch it to the judges.",
    primaryCta: "Registrations Closed",
    secondaryCta: "Join the WhatsApp group",
  },

  // Headline numbers (icons: workflow pills, download tile, avatars).
  stats: ["6-hour build window", "Prize pool: ₹10,000", "Team size: 1–4 members"],

  contacts: [
    { name: "Rahul Gunjkar", phone: "+91 93597 21812", email: "rahulgunjkar74@gmail.com" },
    { name: "Devesh Dolas", phone: "+91 93709 74353", email: "deveshdolas9@gmail.com" },
    { name: "IEEE IOIT", email: "ieeecon@aissmsioit.org" },
  ],

  nav: [
    { label: "About", href: "/about" },
    { label: "Rules", href: "/rules" },
    { label: "Schedule", href: "/schedule" },
  ],

  tracks: [
    {
      title: "Artificial Intelligence & Intelligent Systems",
      description: "Build intelligent solutions using AI/ML, Generative AI, Agentic AI, NLP, Computer Vision, and Automation.",
    },
    {
      title: "Cybersecurity & Digital Trust",
      description: "Develop solutions for Threat Detection, Fraud Prevention, Digital Privacy, Authentication, and Data Protection.",
    },
    {
      title: "Social Impact & Sustainability",
      description: "Tackle real-world challenges in Healthcare, Education, Accessibility, Environment, and Community Development.",
    },
    {
      title: "Open Innovation & Emerging Technologies",
      description: "Explore frontier tech: Web3/Blockchain, FinTech, AR/VR, Data Science, and Cross-domain applications.",
    },
  ],

  about: {
    intro:
      "IEEE SYNAPSE 2026 is an offline technology and innovation hackathon organized by the IEEE Student Branch, AISSMS IOIT Pune. Bring together students across colleges and disciplines to solve real-world problems and demonstrate working prototypes within a 6-hour build period.",
    format: [
      "Register on Unstop and complete payment (Solo ₹100, 2 Members ₹150, 3 Members ₹200, 4 Members ₹250).",
      "Theme — Build Beyond Code: Identify Problem → Design Solution → Build Functional Prototype → Demonstrate Impact.",
      "4 Tracks: AI & Intelligent Systems, Cybersecurity & Digital Trust, Social Impact & Sustainability, Open Innovation.",
      "Build from scratch in a GitHub repo during the 6-hour build window (09:00 AM – 03:00 PM). No PPT required: submit Repo + README.md + Demo.",
      "Add organizer reviewer collaborator to your repository right at initial creation for development monitoring.",
      "Live evaluation: 3 min presentation demo + 2 min judge Q&A (total 5 mins).",
    ],
    eligibility: [
      "Open to students from recognized colleges and institutions (all branches and years).",
      "Inter-college and interdisciplinary teams are welcome.",
      "Team size: 1–4 members (Solo participation permitted).",
      "Each participant may be part of only one team.",
      "Must carry a valid college ID for on-campus verification at AISSMS IOIT, Pune.",
    ],
    prizes: [
      { place: "Winner", reward: "₹5,000" },
      { place: "Runner-up", reward: "₹3,000" },
      { place: "Second runner-up", reward: "₹2,000" },
    ],
  },

  rules: [
    "All code must be written during the 6-hour build window. Your repo's initial commit must come after 09:00 AM.",
    "Teams must add the official reviewer collaborator to their GitHub repo at the start of the event when the repository is first created.",
    "Open-source libraries, frameworks, APIs, and AI coding assistants are allowed; pre-built projects are strictly prohibited.",
    "Commit early and often. Repository commit history will be reviewed to monitor development activity.",
    "Official deliverables: GitHub Repository + README.md documentation + Working Project Demo (No PPT / slide deck required).",
    "Evaluation format: 3 minutes live project demonstration + 2 minutes judge Q&A (5 minutes total).",
    "Only the team leader submits from the team dashboard before the 03:00 PM deadline. Late submissions are not accepted.",
    "Judges' decisions are final. Respect the code of conduct and institute guidelines.",
  ],

  // Event-day timeline (times in IST). Single day, Oct 9, 2026.
  schedule: [
    { day: "Oct 9", time: "07:00 – 07:30 AM", title: "Check-in opens", detail: "Collect team badge, verify college ID, and report to your table at AISSMS IOIT." },
    { day: "Oct 9", time: "08:30 AM", title: "Briefing & Setup", detail: "Final logistical briefing, network setup, and repo preparation." },
    { day: "Oct 9", time: "09:00 AM", title: "Build window opens", detail: "6-hour development sprint begins. Create your repo, add the reviewer collaborator, and commit frequently." },
    { day: "Oct 9", time: "03:00 PM", title: "Submission deadline", detail: "Development ends. Submit your GitHub repo link, README.md, and demo link." },
    { day: "Oct 9", time: "04:00 PM", title: "Judging & Live Demos", detail: "Live evaluations begin: 3 min demo + 2 min judge Q&A per team." },
    { day: "Oct 9", time: "05:30 PM", title: "Results & Valedictory", detail: "Winner announcements and prize distribution." },
  ],

  reviewerGithub: "ieee-synapse-reviewer",
  codePrefix: "SYN",
  teamNumberStart: 101,
};

export type EventConfig = typeof event;
