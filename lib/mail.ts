import "server-only";
import nodemailer from "nodemailer";
import { event, reviewerFor } from "./event";
import { siteUrl } from "./format";

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
function transport() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      pool: true,
      maxConnections: 2,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const ORGANIZER = "IEEE AISSMS IOIT Student Branch";
const AI_TOOLS = "ChatGPT, Claude, Gemini, GitHub Copilot, Cursor, etc.";

/** The event guidelines, shared by the plain-text and HTML versions so they always match. */
function guidelines(reviewer: string) {
  return [
    {
      title: "Mandatory requirements & check-in",
      items: [
        "Reporting & registration opens at 7:00 AM.",
        "College ID card is STRICTLY COMPULSORY for entry and verification.",
        "Team composition is locked upon registration (no additions, swaps or team merging).",
      ],
    },
    {
      title: "Development & GitHub rules",
      items: [
        "The 9:00 AM rule: planning and UI/architecture discussions are allowed beforehand, but your first line of implementation code must be written at or after 9:00 AM.",
        `Repository setup: create your GitHub repository at or after 9:00 AM and immediately add your reviewer (@${reviewer}) as a collaborator.`,
        "Commit regularly throughout the build phase. Single bulk commits at the end will be heavily scrutinized during Git auditing.",
      ],
    },
    {
      title: "Submission deadline",
      items: [
        "Submissions close sharply at 3:00 PM.",
        "Save your GitHub repository link on your team dashboard. The demo video link opens at 1:00 PM (YouTube, Google Drive, Loom or Vimeo).",
        "Required deliverables: GitHub repository link, a comprehensive README.md, a demo video link, and a working project demo ready for live testing.",
      ],
    },
    {
      title: "AI policy",
      items: [
        `AI assistants (${AI_TOOLS}) are allowed; however, your team must completely understand your codebase and architecture and be prepared to defend it during evaluations.`,
      ],
    },
  ];
}

export async function sendCredentials(to: { email: string; leaderName: string; teamName: string; teamNumber: number; code: string }) {
  const loginUrl = `${siteUrl()}/team/login`;
  const reviewer = reviewerFor(to.teamNumber);
  const greeting = to.leaderName ? `Dear ${to.leaderName} and team,` : "Dear participants,";
  const rules = guidelines(reviewer.username);

  const details: [string, string][] = [
    ["Team name", to.teamName],
    ["Team number", String(to.teamNumber)],
    ["Login code", to.code],
    ["Log in at", loginUrl],
    ["Your reviewer (GitHub)", `@${reviewer.username} (${reviewer.url})`],
  ];

  const text = [
    greeting,
    "",
    `Welcome to SYNAPSE 2026, organized by the IEEE AISSMS IOIT Student Branch and Sensors Council Chapter!`,
    "",
    "Please find your official login credentials and your assigned reviewer below.",
    "",
    "YOUR CREDENTIALS & TEAM DETAILS",
    ...details.map(([k, v]) => `- ${k}: ${v}`),
    "",
    "Keep the login code within your team. Use the team number and login code to sign in on event day.",
    "",
    "ESSENTIAL GUIDELINES & EVENT RULES",
    ...rules.flatMap((r, i) => [`${i + 1}. ${r.title}`, ...r.items.map((x) => `   - ${x}`)]),
    "",
    "If you have any questions or need technical assistance during setup, reach out to your assigned reviewer or approach the help desk.",
    "",
    "Best of luck,",
    ORGANIZER,
  ].join("\n");

  const td = "padding:6px 16px 6px 0;color:#555;vertical-align:top";
  const html = `<div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:640px">
<p>${escape(greeting)}</p>
<p>Welcome to <strong>SYNAPSE 2026</strong>, organized by the IEEE AISSMS IOIT Student Branch and Sensors Council Chapter!</p>
<p>Please find your official login credentials and your assigned reviewer below.</p>
<h3 style="margin:20px 0 8px;font-size:16px">Your credentials &amp; team details</h3>
<table style="border-collapse:collapse">
<tr><td style="${td}">Team name</td><td style="padding:6px 0"><strong>${escape(to.teamName)}</strong></td></tr>
<tr><td style="${td}">Team number</td><td style="padding:6px 0;font-family:monospace;font-size:18px"><strong>${to.teamNumber}</strong></td></tr>
<tr><td style="${td}">Login code</td><td style="padding:6px 0;font-family:monospace;font-size:18px"><strong>${escape(to.code)}</strong></td></tr>
<tr><td style="${td}">Log in at</td><td style="padding:6px 0"><a href="${escape(loginUrl)}">${escape(loginUrl)}</a></td></tr>
<tr><td style="${td}">Your reviewer (GitHub)</td><td style="padding:6px 0"><a href="${escape(reviewer.url)}">@${escape(reviewer.username)}</a></td></tr>
</table>
<p style="color:#555">Keep the login code within your team. Use the team number and login code to sign in on event day.</p>
<h3 style="margin:20px 0 8px;font-size:16px">Essential guidelines &amp; event rules</h3>
<ol style="padding-left:20px">
${rules.map((r) => `<li style="margin-bottom:10px"><strong>${escape(r.title)}</strong><ul style="padding-left:18px">${r.items.map((x) => `<li>${escape(x)}</li>`).join("")}</ul></li>`).join("\n")}
</ol>
<p>If you have any questions or need technical assistance during setup, reach out to your assigned reviewer or approach the help desk.</p>
<p>Best of luck,<br>${escape(ORGANIZER)}</p>
</div>`;

  await transport().sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: to.email,
    subject: `${event.name}: your team login and reviewer (Team ${to.teamNumber})`,
    text,
    html,
  });
}
