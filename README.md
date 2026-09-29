# IEEE Hackathon Platform

An enterprise-grade, real-time hackathon management platform engineered for 24-hour build sprints. Built with **Next.js 15 (App Router)**, **React 19**, **TypeScript**, **PostgreSQL / Supabase**, and **Vanilla CSS** with a custom dark-mode aesthetic.

---

## Table of Contents

- [Overview &amp; Architecture](#overview--architecture)
- [Visual Tour &amp; Site Walkthrough](#visual-tour--site-walkthrough)
  - [1. Landing Page (Hero)](#1-landing-page-hero)
  - [2. About &amp; Event Format](#2-about--event-format)
  - [3. Rules &amp; Judging Criteria](#3-rules--judging-criteria)
  - [4. Event Schedule &amp; Timeline](#4-event-schedule--timeline)
  - [5. Live Real-Time Leaderboard](#5-live-real-time-leaderboard)
- [System Features &amp; Capabilities](#system-features--capabilities)
  - [Public Portal](#public-portal)
  - [Team Authentication &amp; Dashboard](#team-authentication--dashboard)
  - [Automated GitHub Anti-Cheat &amp; Verification](#automated-github-anti-cheat--verification)
  - [Real-Time Leaderboard Engine](#real-time-leaderboard-engine)
  - [Admin Command Center](#admin-command-center)
- [Database Architecture &amp; Schema](#database-architecture--schema)
- [Security &amp; Cryptography Design](#security--cryptography-design)
- [Scoring Mathematical Formulation](#scoring-mathematical-formulation)
- [Environment Variables &amp; Configuration](#environment-variables--configuration)
- [Installation &amp; Setup Runbook](#installation--setup-runbook)
- [Event-Day Operational Playbook](#event-day-operational-playbook)
- [Project Directory Structure](#project-directory-structure)

---

## Overview & Architecture

This platform provides an end-to-end operational pipeline for managing an IEEE hackathon from registration through to final judging and closing ceremonies:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          IEEE Hackathon Site                           │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
         ┌───────────────────────────┼──────────────────────────┐
         ▼                           ▼                          ▼
  ┌──────────────┐            ┌──────────────┐           ┌──────────────┐
  │ Public Pages │            │ Team Portal  │           │ Admin Panel  │
  ├──────────────┤            ├──────────────┤           ├──────────────┤
  │ • Landing    │            │ • Login      │           │ • KPIs       │
  │ • About      │            │ • Countdown  │           │ • Team Import│
  │ • Rules      │            │ • Repo Save  │           │ • Print Chits│
  │ • Schedule   │            │ • Submission │           │ • Commit Aud.│
  │ • Leaderbrd. │            │ • Live Rank  │           │ • Scoring    │
  └──────────────┘            └──────────────┘           └──────────────┘
         │                           │                          │
         └───────────────────────────┼──────────────────────────┘
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
       ┌───────────────────────────┐   ┌───────────────────────────┐
       │   PostgreSQL (Supabase)   │   │     GitHub REST API       │
       ├───────────────────────────┤   ├───────────────────────────┤
       │ • Direct SQL Pool         │   │ • First-commit verification│
       │ • Realtime publication    │   │ • Rate-limit resilient    │
       │ • Row Level Security (RLS)│   │ • Anti-plagiarism flags   │
       └───────────────────────────┘   └───────────────────────────┘
```

### Key Architectural Highlights

- **Framework**: Next.js 15.5+ App Router with React 19 server and client components.
- **Styling**: Tailored Vanilla CSS design system (`landing.css`, `site.css`) utilizing dark mode, micro-animations, glassmorphism, and responsive CSS Grid layouts without third-party utility bloat.
- **Real-Time Data Distribution**: Powered by PostgreSQL database triggers that update a minimal `live_signals` table broadcasted via Supabase Realtime with fallback 30-second polling.
- **Stateless Session Management**: Signed JWT session cookies using `jose` with `HttpOnly`, `SameSite=Lax`, and `Secure` attributes.
- **Cryptographic Access Control**: Dual-layer login code security using HMAC-SHA256 for verification and AES-256-GCM for administrative lookup.

---

## Visual Tour & Site Walkthrough

### 1. Landing Page (Hero)

The landing page establishes an immersive, sleek aesthetic featuring an animated particle wave video backdrop, dynamic event countdown badge, and context-aware primary call-to-actions.

![Landing Page Preview](<ss/Screenshot%202026-09-29%20115027.png>)

#### Highlights:

- **Phase-Aware CTAs**: Automatically transitions buttons depending on the hackathon phase:
  - *Pre-Event*: **"Register on Unstop"** & **"Join the WhatsApp group"**.
  - *During / Post-Event*: **"Team Login"** & **"Live Leaderboard"**.
- **Dynamic Countdown**: Displays remaining days, hours, minutes, and seconds until kick-off or deadline.
- **Key Metrics Pill Bar**: Displays the 24-hour build window, ₹1,00,000 prize pool, and capacity for up to 60 teams.

---

### 2. About & Event Format

Located at `/about`, this section details the challenge structure, submission workflow, team eligibility, and prize distribution.

![About Page Preview](<ss/Screenshot%202026-09-29%20115104.png>)

#### Highlights:

- **Locked Theme Card**: Keeps the competition theme concealed with a lock icon until organizers flip the reveal toggle in the admin dashboard.
- **5-Step Format**: Walks teams through registration, theme drop, 24-hour private GitHub repository build, submission, and judging.
- **Eligibility Criteria**: Clarifies undergraduate/postgraduate requirements, cross-college team allowance, and check-in checklist.
- **Prize Tiers**: Prominently highlights the cash rewards:
  - 🥇 **Winner**: ₹50,000
  - 🥈 **Runner-up**: ₹30,000
  - 🥉 **Second runner-up**: ₹20,000

---

### 3. Rules & Judging Criteria

Located at `/rules`, this page sets clear, non-negotiable expectations regarding build integrity, commit discipline, and scoring transparency.

![Rules Page Preview](<ss/Screenshot%202026-09-29%20115112.png>)

#### Highlights:

- **Core Rules**:
  1. All code must be authored during the event; first commit must post-date kick-off.
  2. Open-source libraries and AI coding assistants are allowed; pre-built templates/projects are banned.
  3. Repositories must remain private during building, adding the organizer reviewer account as a collaborator.
  4. Frequent commits are required; massive single commits are audited manually.
  5. Only team leaders can submit before the deadline cutoff.
- **Weighted Judging Matrix**:| Criterion             | Weight | Focus                                                |
  | :-------------------- | :----: | :--------------------------------------------------- |
  | **Innovation**  |  25%  | Novelty of approach and problem difficulty           |
  | **Execution**   |  30%  | Working demo, completeness, and technical robustness |
  | **Design**      |  20%  | User experience, interface polish, and usability     |
  | **Problem Fit** |  25%  | Relevance and direct alignment with the theme        |

---

### 4. Event Schedule & Timeline

Located at `/schedule`, this page presents a chronological sequence of events spanning the 24-hour sprint.

![Schedule Page Preview](<ss/Screenshot%202026-09-29%20115118.png>)

#### Highlights:

- **Day 1**:
  - `08:00`: Check-in opens & physical login chit distribution.
  - `09:00`: Opening ceremony, theme reveal & build window starts.
  - `13:00`: Lunch & mentor floor walkthroughs.
  - `18:00`: Mandatory progress check-in with mentors.
  - `21:00`: Dinner break.
- **Day 2**:
  - `02:00`: Midnight snacks & sprint checkpoint.
  - `09:00`: **Submission deadline** (repository links lock).
  - `10:00`: Pitch & live demo judging sessions.
  - `13:00`: Leaderboard goes live & prize distribution.

---

### 5. Live Real-Time Leaderboard

Located at `/leaderboard`, this dashboard streams live ranking updates directly to browsers without requiring manual page refreshes.

![Leaderboard Page Preview](<ss/Screenshot%202026-09-29%20115130.png>)

#### Highlights:

- **Real-Time Push Updates**: Powered by Supabase Realtime channel subscriptions listening to `live_signals` updates.
- **Graceful Fallback**: Automatically falls back to background polling if WebSockets are unavailable or disconnected.
- **Admin Visibility Gates**: Organizers can hide the leaderboard entirely or reveal rankings while masking numeric scores until the final ceremony.

---

## System Features & Capabilities

### Public Portal

- Responsive, SEO-optimized metadata, OpenGraph cards (`app/opengraph-image.tsx`), `sitemap.ts`, and `robots.ts`.
- Zero render-blocking script dependencies; video hero starts playing immediately before hydration.

### Team Authentication & Dashboard

- **Team Login (`/team/login`)**:
  - Teams log in using their assigned `Team Number` and a human-friendly `6-character access code` (e.g., `HK-X7P2M9`).
  - Brute-force protection: Locks teams out for 5 minutes after 5 consecutive failed attempts.
- **Team Workspace (`/team/dashboard`)**:
  - Displays team status: `Building` (amber), `Submitted` (green), or `Disqualified` (red).
  - Synchronized countdown timer to submission cutoff.
  - Real-time GitHub repository input validation and lock upon submission.
  - Displays live ranking and score feedback once published.

### Automated GitHub Anti-Cheat & Verification

The platform includes an automated GitHub commit verifier in `lib/github.ts`:

1. Validates repository format (`github.com/owner/repo`).
2. Leverages the GitHub Commits REST API with link header pagination to locate the very first commit.
3. Compares the earliest author/committer timestamp against the event kick-off timestamp.
4. Categorizes the repository into:
   - **`clean`**: First commit created after kick-off.
   - **`flagged`**: Commit timestamps precede the official event start.
   - **`review`**: Repo is private, inaccessible, empty, or requires manual collaborator check.

### Real-Time Leaderboard Engine

- Prevents database connection exhaustion by decoupling client browsers from raw score tables.
- PostgreSQL database triggers update a single row in `live_signals`:
  ```sql
  create or replace function bump_leaderboard_signal() returns trigger
  language plpgsql as $$
  begin
    insert into live_signals (key, bumped_at) values ('leaderboard', clock_timestamp())
    on conflict (key) do update set bumped_at = excluded.bumped_at;
    return null;
  end $$;
  ```
- Browsers subscribe only to this timestamp pulse. When bumped, clients fetch the server-gated `/api/leaderboard` endpoint.

### Admin Command Center

Accessible at `/admin`, the organizer control panel provides:

1. **Overview & KPI Cards**: Active team count, submitted count, building count, flagged repos, scored teams, and credentials sent.
2. **Team Import (`/admin/import`)**: Drag-and-drop ingestion of Unstop CSV or Excel (`.xlsx`) rosters with automatic team number and credential generation.
3. **Printable Credential Slips (`/admin/print`)**: Printer-friendly sheet formatting team number, team name, leader name, and secret login code with dashed cut lines for physical check-in.
4. **Credential Mailer (`/admin/send-credentials`)**: SMTP integration via Nodemailer to send customized email chits to team leaders.
5. **Team Management (`/admin/teams`)**: View all teams, trigger GitHub commit audits, toggle submission statuses, and reset locks.
6. **Judging & Scores (`/admin/scores`)**: Ingest judge scoring sheets, manage criteria weights, and verify average scores.
7. **Leaderboard Controls (`/admin/leaderboard`)**: Toggles to reveal the leaderboard, publish scores, or freeze standings.

---

## Database Architecture & Schema

The PostgreSQL database schema resides in `db/schema.sql` and is safe to execute idempotently:

```
 ┌─────────────────┐       ┌─────────────────┐
 │      teams      │───┬──<│     members     │
 └─────────────────┘   │   └─────────────────┘
          │            │
          │            │   ┌─────────────────┐
          │            └──<│  login_events   │
          │                └─────────────────┘
          ▼
 ┌─────────────────┐       ┌─────────────────┐
 │     scores      │>─────-│    criteria     │
 └─────────────────┘       └─────────────────┘
          ▲
          │ (Trigger updates)
 ┌─────────────────┐       ┌─────────────────┐
 │  live_signals   │       │    settings     │
 └─────────────────┘       └─────────────────┘
```

### Table Definitions

| Table            | Purpose                           | Key Attributes                                                                                                                    |
| :--------------- | :-------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| `teams`        | Master roster of registered teams | `team_number`, `name`, `login_code_hash`, `login_code_enc`, `github_repo_url`, `github_status`, `submission_status` |
| `members`      | Student team participants         | `team_id` (FK), `name`, `email`                                                                                             |
| `criteria`     | Judging criteria & weights        | `name`, `weight` (0–100%), `position`                                                                                      |
| `scores`       | Assigned judge evaluations        | `team_id` (FK), `criterion_id` (FK), `judge`, `value` (0–10)                                                             |
| `admins`       | Organizer user accounts           | `email`, `password_hash` (bcrypt), `name`                                                                                   |
| `settings`     | Dynamic runtime configurations    | `event_start_time`, `submission_deadline`, `leaderboard_visible`, `scores_visible`, `theme_revealed`, `theme_title`   |
| `login_events` | Security audit trail              | `kind` (team/admin), `identifier`, `success`, `ip`, `user_agent`                                                        |
| `live_signals` | Lightweight Realtime signaling    | `key` ('leaderboard'), `bumped_at`                                                                                            |

---

## Security & Cryptography Design

### 1. Ambiguity-Free Access Codes

Codes use the character set `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (excluding `0`, `O`, `1`, `I`, `L`) to avoid transcription errors when teams read physical paper chits or email notifications.

### 2. Dual-Layer Storage

- **Verification Hash**: Generated via `HMAC-SHA256` using keys derived through `HKDF`. Verifications execute using constant-time comparison `crypto.timingSafeEqual` to eliminate timing attacks.
- **Reversible Admin Encryption**: Stored as `AES-256-GCM` ciphertext with authenticated initialization vectors (IVs) and authentication tags. This allows organizers to recover a lost code for a participant while keeping the plaintext secure against raw database dumps.

```
Master Secret (CODE_SECRET)
   │
   ├─► HKDF("hash")    ──► HMAC-SHA256(Code) ──► login_code_hash
   └─► HKDF("encrypt") ──► AES-256-GCM(Code) ──► login_code_enc
```

### 3. Database Row-Level Security (RLS)

The database enforces strict RLS policies:

- Tables `teams`, `members`, `scores`, `admins`, `settings`, and `login_events` have all permissions revoked from the public `anon` role.
- Only the `live_signals` table is readable by anonymous subscribers.
- Application code accesses PostgreSQL as the table owner via direct connection pooling.

---

## Scoring Mathematical Formulation

Each team's cumulative score is calculated as the sum of weighted judge averages:

$$
\text{Final Score} = \sum_{c \in \text{Criteria}} \left( \overline{S}_c \times \frac{W_c}{100} \right)
$$

Where:

- $\overline{S}_c$ is the arithmetic mean of all judge evaluations for criterion $c$:
  $$
  \overline{S}_c = \frac{1}{|J_c|} \sum_{j \in J_c} \text{score}(j, c)
  $$
- $W_c$ is the percentage weight assigned to criterion $c$ ($\sum W_c = 100$).

### Tie-Breaking Hierarchy

1. **Weighted Score**: Highest aggregate score wins.
2. **Submission Timestamp**: Earlier repository submission wins ties.
3. **Team Number**: Ascending numerical order as the final deterministic fallback.

---

## Environment Variables & Configuration

Create a `.env.local` file in the project root:

```env
# Database Connection (Direct Connection Pooler)
DATABASE_URL=postgres://postgres:[PASSWORD]@[HOST]:5432/postgres

# Supabase Client Credentials (for Realtime Broadcasts)
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_PROJECT_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_ANON_PUBLIC_KEY]

# Cryptographic Keys (minimum 32 random characters each)
CODE_SECRET=generate_a_random_32_character_string_here
SESSION_SECRET=generate_another_random_32_character_string

# GitHub API Token (Optional, boosts rate limits to 5000 req/hr)
GITHUB_TOKEN=ghp_yourPersonalAccessTokenHere

# SMTP Credentials for Emailing Credential Chits (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=hackathon@yourdomain.org
SMTP_PASS=yourAppSpecificPassword
MAIL_FROM="IEEE Hackathon <hackathon@yourdomain.org>"

# Public URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## Installation & Setup Runbook

### 1. Prerequisites

- **Node.js**: `>= 20.12.0`
- **PostgreSQL**: Local instance or Supabase project.

### 2. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd hackathon-site
npm install
```

### 3. Initialize Database

Execute the database schema setup script:

```bash
npm run db:setup
```

*Applies `db/schema.sql`, configures tables, seed defaults, database triggers, and RLS policies.*

### 4. Create Initial Administrator Account

Generate your first organizer login:

```bash
npm run admin:create
```

Follow the interactive CLI prompts to enter the admin name, email, and password.

### 5. Launch Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Event-Day Operational Playbook

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Event-Day Organizer Flow                        │
└────────────────────────────────────────────────────────────────────────┘
                                    │
  1. 3 Days Before     Import Unstop CSV at /admin/import
                       └─► Automatically assigns team numbers & codes
                                    │
  2. 1 Day Before      Email credentials at /admin/send-credentials
                       Print check-in slips at /admin/print
                                    │
  3. Kick-Off (09:00)  Set Event Start Time & Reveal Theme at /admin
                       └─► Builds start; first-commit timer begins
                                    │
  4. Build Window      Monitor incoming repositories at /admin/teams
                       Check GitHub commit integrity flags
                                    │
  5. Deadline (09:00)  Repository links automatically lock
                       Run final GitHub integrity audits
                                    │
  6. Judging Phase     Import judges' score sheets at /admin/scores
                       Preview calculated rankings
                                    │
  7. Closing Ceremony  Publish Live Leaderboard at /admin/leaderboard
                       Distribute prizes to top teams!
```

---

## Project Directory Structure

```
hackathon-site/
├── app/
│   ├── (panel)/                     # Admin sub-routes (teams, scores, import, etc.)
│   ├── about/                       # /about event details & prize tiers
│   ├── admin/                       # Admin login & management panel
│   │   ├── (panel)/                 # Overview, teams, scores, leaderboard, import
│   │   ├── login/                   # Organizer authentication
│   │   └── print/                   # Printable credential check-in chits
│   ├── api/                         # Backend route handlers
│   │   ├── admin/                   # Admin action APIs (settings, teams, scores)
│   │   ├── health/                  # Realtime & database diagnostics
│   │   ├── leaderboard/             # Public & authenticated leaderboard API
│   │   └── team/                    # Team auth, dashboard, and submission APIs
│   ├── leaderboard/                 # /leaderboard live rankings page
│   ├── rules/                       # /rules guidelines & evaluation criteria
│   ├── schedule/                    # /schedule event timeline
│   ├── team/                        # /team participant portal
│   │   ├── dashboard/               # Team repository submission dashboard
│   │   └── login/                   # Team access-code authentication
│   ├── landing.css                  # Custom styling for hero landing page
│   ├── layout.tsx                   # Root HTML shell & meta configuration
│   ├── page.tsx                     # Landing page hero component
│   └── site.css                     # Global typography & design system
├── components/                      # Reusable React components
│   ├── Countdown.tsx                # High-precision countdown timer
│   ├── InnerShell.tsx               # Content container wrapper
│   ├── PageEnhancer.tsx             # Interactive micro-animations
│   ├── SiteFooter.tsx               # Global footer
│   ├── SiteHeader.tsx               # Navigation bar & dynamic CTA
│   └── useLiveVersion.ts            # Supabase Realtime synchronization hook
├── db/
│   └── schema.sql                   # Full PostgreSQL schema, triggers & RLS
├── lib/                             # Core server-only modules
│   ├── codes.ts                     # Code generation, HMAC hashing & AES encryption
│   ├── db.ts                        # Direct PostgreSQL connection pool
│   ├── event.ts                     # Hackathon static content & defaults
│   ├── github.ts                    # GitHub REST commit verification engine
│   ├── mail.ts                      # Nodemailer SMTP credential delivery
│   ├── scoring.ts                   # Weighted rank calculation & tie-breaking
│   ├── session.ts                   # JOSE JWT cookie authentication
│   └── settings.ts                  # Event phases & database settings cache
├── scripts/
│   ├── create-admin.mjs             # CLI script to create administrator accounts
│   └── db-setup.mjs                 # CLI script to apply database schema
├── ss/                              # Site screenshots
│   ├── Screenshot 2026-09-29 115027.png  # Landing page
│   ├── Screenshot 2026-09-29 115104.png  # About & Prizes
│   ├── Screenshot 2026-09-29 115112.png  # Rules & Judging
│   ├── Screenshot 2026-09-29 115118.png  # Schedule
│   └── Screenshot 2026-09-29 115130.png  # Live Leaderboard
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # TypeScript compiler configuration
└── vercel.json                      # Vercel deployment headers & region config
```

---

*Built with precision for the IEEE Student Branch Hackathon.*
