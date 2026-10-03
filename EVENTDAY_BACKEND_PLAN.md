# EVENTDAY_BACKEND_PLAN.md: Release 2 (backend and event day) for IEEE SYNAPSE 2026

> **AGENT INSTRUCTIONS (Claude Code / Antigravity):** Build ONLY what this file lists, in the order listed. Do not add features, infer requirements, or improve on the spec. If anything is unclear, write a `// UNCLEAR: [question]` comment and stop. Read section 9 (rules and sandbox) before touching any file.

**Status date:** Oct 3, 2026. **Event:** Oct 9, 2026. **Days left: 6.**
**Companion docs:** `LANDING_DEPLOYMENT_PLAN.md` (Release 1, landing is live), `hackathon-site-plan.md` (original architecture).
**Code freeze:** Oct 6. **Registrations close:** Oct 7, 12 AM. **Credentials go out:** Oct 8.

---

## 1. What is live and what is confirmed

Live at `https://ieee-synapse-2026.vercel.app/` (checked Oct 2): landing with Golden Hours chapters, `/about`, `/rules`, `/schedule`. The platform side (team login, submission, admin, scoring, leaderboard) is built per the teammate's README but is **not yet verified running in production**. Treat it as untested until Task B1 to B3 pass.

### Confirmed facts (from the live site; these are now the source of truth)
| Item | Value |
|---|---|
| Event | IEEE SYNAPSE 2026, theme "Build Beyond Code", AISSMS IOIT Pune |
| Date and format | Oct 9, 2026, offline, 6-hour build window |
| Day plan (IST) | 07:00 to 07:30 check-in; 08:30 briefing and setup; **09:00 build opens**; **15:00 submission deadline**; 16:00 judging and live demos; 17:30 results and valedictory |
| Tracks | AI & Intelligent Systems; Cybersecurity & Digital Trust; Social Impact & Sustainability; Open Innovation |
| Teams | Solo to 4 members (Unstop fees: Solo 100, 2 members 150, 3 members 200, 4 members 250, in rupees) |
| Prizes | Winner 5,000; runner-up 3,000; second runner-up 2,000 (rupees) |
| Deliverables | GitHub repo + README.md (technical doc) + **demo video link (MANDATORY)**. No PPT. Submission is phased: repo URL early, demo video field unlocks at Hour 4/5 |
| Evaluation | **Two stages.** Stage 1: Preliminary judge scores from hardcopy sheets; admin ranks and determines finalists. Stage 2: Top finalists demo live on stage (3 min + 2 min Q&A); stage judges decide the podium |
| Repo rules | First commit after 09:00; official reviewer (`ieee-synapse-reviewer`) added directly on GitHub as collaborator; private until evaluation |
| Submission | Team leader only, from team dashboard; repo editable until final submit/deadline; strictly locks at 15:00:00 IST |
| Tie-break | The team that **submitted first** (`first_submitted_at`) |
| Public vs Private | Public `/leaderboard` reveals **Podium Winners** (1st, 2nd, 3rd) and Top Finalists only (no score shaming for the rest). Individual teams view their own official rank (`#X of 150`), total score, and criteria breakdown privately on their `/team/dashboard` |

### Judging criteria (7, weights sum to 100)
Innovation 20, Technical Implementation 25, Functionality 20, Problem Relevance 15, Creativity 10, Demo & Explanation 5, Overall Impact 5. Each judge scores each criterion 0 to 10; team score is the weighted sum of the judges' average per criterion, out of 10.

---

## 2. Fix-now list (before the Oct 6 registration push)

1. **Link previews are broken.** The live pages declare `canonical` and `og:image` as `http://localhost:3000/...`. Set `NEXT_PUBLIC_SITE_URL=https://ieee-synapse-2026.vercel.app` (or the final domain) in Vercel production, redeploy, and re-check.
2. **Inconsistent Register links.** Use the single tagged URL from `lib/event.ts` everywhere so analytics are not split.
3. **Criteria and settings must match section 1.** Seed the 7 criteria and set `event_start_time` to `2026-10-09T09:00:00+05:30` and `submission_deadline` to `2026-10-09T15:00:00+05:30`.
4. **Leaderboard before reveal** must show a friendly "Results at 5:30 PM" style message, not an error.
5. **Rules page & copy update:** state mandatory demo video, repo collaborator instructions, and the 2-stage evaluation format.

---

## 3. Priorities (7 days means ruthless scope)

| Tier | Meaning | Items |
|---|---|---|
| **P0: must work on the day** | If this fails the event suffers | Import teams, credentials (SMTP/Mailpit test, printable A4 chits), team login, phased submission (repo $\to$ video at Hr 4/5) locked at 15:00, admin submissions table, score entry (Stage 1 & Stage 2), finalist announcement, private team rank/scores display, public podium reveal |
| **P1: should work** | Valuable, with a manual fallback | GitHub invite auto-acceptor script (`accept-invites.mjs`), on-demand per-team commit & README check, `/event` projector page (countdown to 15:00, schedule with NOW marker) |
| **P2: stretch** | Only after dry run passes | Big-screen mode animations, track filters |

P0 is never cut.

---

## 4. The event day, mapped to the system

| Time (Oct 9) | What happens | System function |
|---|---|---|
| 07:00 | Check-in | Desk hands out printed login chits (`/admin/print`); admin lookup for lost codes |
| 08:30 | Briefing | Announce reviewer account name (`ieee-synapse-reviewer`) and instructions to add collaborator on GitHub |
| 09:00 | Build opens | `event_start_time` baseline for first-commit check; team enters GitHub repo URL |
| 09:00 to ~10:30 | Teams create repos and invite reviewer | Organiser runs `node scripts/accept-invites.mjs` to auto-accept all incoming repo invites in bulk |
| 13:00 / 14:00 (Hr 4/5)| Video preparation | Dashboard unlocks **Demo Video URL** field (YouTube, Google Drive, Loom, Vimeo) |
| 15:00 | Deadline | Submissions lock strictly server-side at 15:00:00 IST; `first_submitted_at` preserved as tie-breaker |
| 15:00 to 15:45 | **Stage 1 scoring** | Judges evaluate teams on physical sheets; organisers enter scores into `/admin/scores`; system computes Stage 1 ranks |
| 15:45 to 16:00 | **Finalists announced** | Public site displays **Finalist Team Names & stage order** (scores hidden to avoid disputes) |
| 16:00 to 17:00 | **Stage 2 live demos** | Top finalists present live on stage (3 min + 2 min Q&A); stage judges grade on paper sheets |
| 17:00 to 17:20 | Stage 2 score entry | Organisers enter Stage 2 marks into `/admin/scores` for finalists |
| 17:30 | **Grand Reveal** | Organiser flips "Publish Leaderboard" toggle. Public site displays **Podium UI** (1st, 2nd, 3rd + Finalists). Each team privately views their official **Rank (`#X of 150`)** and marks on `/team/dashboard` |

---

## 5. Architecture and infrastructure bring-up

- **Hosting:** Vercel (deployed). Region: Mumbai (`bom1`)
- **Database:** Supabase Postgres in Mumbai (`ap-south-1`) (created)
- **Connection:** Use Supabase **Transaction Pooler** (`port 6543`) for `DATABASE_URL` in Vercel
- **Email testing & sending:** Test credentials locally using Mailpit (port 1025); production sending via Brevo or Resend SMTP on Oct 8
- **Secrets:** All in Vercel environment variables; never committed
- **Fallback store:** Supabase dashboard table editor is the emergency manual interface

---

## 6. Tasks (ordered; every task has acceptance criteria)

### B1: Supabase project and schema
- Apply the existing schema plus new migrations (`db/migrations/001_eventday_updates.sql`); confirm RLS is active.
- Columns required:
  - `teams`: `demo_video_url text`, `first_submitted_at timestamptz`, `last_updated_at timestamptz`, `is_finalist boolean default false`, `stage2_order integer`
  - `scores`: `stage integer not null default 1 check (stage in (1, 2))`
- **Accept:** all tables and columns exist; anon client cannot read teams or scores.

### B2: Production connectivity
- Set production env vars; deploy; verify `/api/health` responds.
- **Accept:** database queries succeed without connection exhaustion.

### B3: Seed configuration
- Insert the 7 criteria with confirmed weights; set `event_start_time` (`09:00`) and `submission_deadline` (`15:00`); set `allowedVideoHosts` in `lib/event.ts`.
- **Accept:** admin settings page shows values; weights sum to 100.

### B4: Roster import (Unstop CSV)
- Support teams of 1 to 4 members; dedupe by leader email; show preview with counts before writing.
- **Accept:** real export imports cleanly; re-import adds only new teams.

### B5: Credentials, Mailpit testing, and printable chits
- Generate team numbers (`SYN-xxx`) and login codes.
- Test bulk mailing locally with **Mailpit** without touching real participant inboxes.
- Printable A4 chit sheet (`/admin/print`) formatted for easy physical cutting.
- **Accept:** test email received cleanly in Mailpit; `/admin/print` renders one clean chit per team on A4.

### B6: Team login, phased dashboard, and submission
- Login with team number and code, lockout after repeated failures.
- **Phased submission**:
  - 09:00 AM – 01:00 PM: dashboard asks for **GitHub Repo URL** only.
  - From 01:00 PM (Hour 4): **Demo Video URL** field unlocks (must be https link on allowed host: YouTube, Drive, Loom, Vimeo).
  - Teams can edit their links until 15:00:00 IST. First submission sets `first_submitted_at` (tie-breaker); subsequent edits update `last_updated_at`.
  - Strictly rejects submissions after 15:00:00 IST with a clear error.
- **Accept:** repo editable before 15:00; video field unlocks at the scheduled time; late submission at 15:00:01 is rejected; `first_submitted_at` remains immutable.

### B7: GitHub bulk invite acceptor & on-demand verification
- Provide `scripts/accept-invites.mjs` using the reviewer PAT to list and accept pending collaborator invitations in bulk.
- Admin button checks team repo **one team per request**: checks collaborator access, first commit timestamp vs 09:00 AM, `README.md` presence at repo root, and commit count.
- **Accept:** bulk accept script accepts test invite; admin check accurately returns access, first commit, and README status without serverless timeout.

### B8: Admin operations & submission vault
- Submissions table: team, repo link, demo video link, submitted timestamp, GitHub status.
- Manual overrides with audit log: update repo/video URL on behalf of a team in emergency.
- Export all submissions and statuses to Excel/CSV.
- **Accept:** actions logged to audit trail; export opens cleanly in Excel.

### B9: Score entry & Stage 1 shortlist
- Admin interface to enter paper scores for the 7 criteria (Stage 1).
- System computes Stage 1 totals and ranks (ties broken by `first_submitted_at`).
- Admin finalist selector: pick the top finalists and set stage presentation order.
- **Accept:** scores compute accurately; finalist list generated with one click.

### B10: Final podium reveal & private team rank
- **Public reveal (`/leaderboard`)**:
  - Before 17:30: displays friendly "Results at 5:30 PM" message.
  - Between 15:45 and 16:00: can display "Finalists Announced" stage roster (names only, no scores).
  - At 17:30: flips to **Celebration Podium UI** highlighting 1st, 2nd, 3rd place winners and top finalists with project links. Non-finalists are not publicly displayed or score-shamed.
- **Private Team Dashboard (`/team/dashboard`)**:
  - Once results are published, each logged-in team sees their personalized result: **Official Rank (`#X of 150`)**, total score, and criterion-wise breakdown.
- **Accept:** public page shows podium only; private dashboard shows exact rank and score breakdown.

### B11: Event page `/event` (P1)
- Public minimal projector screen: countdown to 15:00 deadline, live schedule marker, and announcements.
- **Accept:** functions cleanly even if database is offline.

### B12: Dry run and rehearsal (Oct 5)
- Rehearse with 60 fake teams: login, submission, invite accept, score entry, finalist selection, and podium reveal.
- **Accept:** written dry run report and confirmed readiness.

---

## 7. Timeline

| Date | Work |
|---|---|
| **Oct 3** | Fix-now list; B1 to B3 (Supabase live, migration applied, criteria seeded); copy updates on rules & format |
| Oct 4 | B4 (Unstop import), B5 (Mailpit credential test & printable chits), B6 (Phased submission) |
| Oct 5 | B7 (Invite accept script & check), B9 & B10 (Score entry, finalist picker, Podium UI & private rank); **Evening dry run (B12)** |
| Oct 6 | **Code freeze.** Fixes only. Final registration push |
| Oct 7 | Registrations close 12 AM. Final roster import; verify teams in admin |
| Oct 8 | Send real credentials via production SMTP; print chits; staff runbook walkthrough |
| Oct 9 | Event day |

---

## 8. Plan B runbook (print this)

| If this fails | Do this |
|---|---|
| Team can't log in | Admin panel shows the code; read it to them; chit reprint |
| Site slow or down near 15:00 | Teams send repo + video link to organiser on WhatsApp before 15:00; organiser enters with manual override |
| Venue Wi-Fi saturated | Organisers' phones as hotspots for admin laptop; teams submit via mobile data |
| GitHub check errors | Skip automated check; reviewers inspect repos manually via collaborator access |
| Video link broken or private | Team re-sends working link on WhatsApp before 15:00; note in audit log |
| Reviewer invite not accepted | Re-run `node scripts/accept-invites.mjs`; ask team to verify username is `ieee-synapse-reviewer` |
| Score entry issue | Enter scores in Supabase dashboard table editor; leaderboard computes from table |
| Reveal fails | Announce winners directly from the podium on stage; fix site afterwards |

---

## 9. Rules and sandbox

### DO NOT
- Do not add features outside this plan.
- Do not rename or move existing files or folders.
- Do not edit `schema.sql` in place; all schema changes go in new numbered migration files under `db/migrations/`.
- Do not commit secrets, `.env*` files, or real credentials.
- Work on clean feature branches.

### File ownership
| Path | Agent may |
|---|---|
| `app/api/**`, `app/team/**`, `app/admin/**`, `app/leaderboard/**`, `lib/**`, `db/**`, `scripts/**` | Create and edit within the assigned task |
| `app/event/**` | Create (Task B11) |
| `lib/event.ts` | Edit values only; allowed additions: `finalistCount`, `allowedVideoHosts` |
| Landing & marketing pages | Read-only except for copy fixes in section 2 |
| `package.json` | Read-only |
