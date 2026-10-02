# LANDING_DEPLOYMENT_PLAN.md: Release 1 (Golden Hours landing)

> **AGENT INSTRUCTIONS (Claude Code / Antigravity):** Build ONLY what this file lists. Do not add features, infer requirements, or improve on the spec. If anything is unclear, write a `// UNCLEAR: [question]` comment at that point and stop. Do not continue past an unclear point. Read section 8 (rules and sandbox) before touching any file.

This is an addendum to the existing repo (Next.js 15.5, React 19, TypeScript, Vanilla CSS, Supabase Postgres). The platform pages (`/about`, `/rules`, `/schedule`, `/leaderboard`, `/team`, `/admin`, `/api`) were built by a teammate and are **not part of this task** except where listed.

---

## 1. Goal and scope

**Goal:** put a fast, static, marketing-grade landing page live on the public domain as early as possible, and structure it so event-day modules attach later without rework.

**In scope (Release 1)**

- Landing page at `/` with the Golden Hours scroll experience merged into the existing visual system
- Correct, confirmed event copy in one config file
- Production deployment, domain, link previews, analytics, launch checks

**Out of scope (Release 1)**

- Any change to team login, admin, scoring, GitHub verification, database schema, or API routes
- Three.js or any new 3D. That is a later optional upgrade
- New dependencies of any kind

---

## 2. Facts gate (public launch is BLOCKED until these are confirmed)

Current site copy was written on assumptions. Every value below lives in `lib/event.ts`. Anything not confirmed must be marked `TODO_CONFIRM` in that file and must not ship on the public domain.

| Value                           | Current in repo                                                         | Status                                                                                                                                                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Event duration and format       | 24-hour build sprint, two days                                          | CONFIRMED by organiser: offline, one day of 10-12 hours, 6-hour build window. Every 24-hour and two-day string in the repo must change                                                                                    |
| Dates, kick-off, deadline       | Oct 24-25, 2026, 09:00 to 09:00                                         | Date CONFIRMED: Oct 9, 2026, single day. Kick-off time, build start and submission deadline: DECISION NEEDED. Unstop registration closes Oct 7, 2026 at 12 AM IST (CONFIRMED; read as 00:00 on Oct 7, the night of Oct 6) |
| Prize amounts                   | Winner 50,000, runner-up 30,000, second runner-up 20,000; pool 1,00,000 | DECISION NEEDED                                                                                                                                                                                                           |
| Judging weights                 | Innovation 25, Execution 30, Design 20, Problem Fit 25                  | DECISION NEEDED (originally an example, never approved by judges)                                                                                                                                                         |
| Team size                       | 2 to 4                                                                  | DECISION NEEDED                                                                                                                                                                                                           |
| Max teams                       | 60                                                                      | DECISION NEEDED                                                                                                                                                                                                           |
| AI coding tools allowed         | Yes                                                                     | DECISION NEEDED                                                                                                                                                                                                           |
| Venue, college name             | "Venue to be announced"                                                 | DECISION NEEDED                                                                                                                                                                                                           |
| Unstop URL, WhatsApp invite URL | placeholders                                                            | DECISION NEEDED                                                                                                                                                                                                           |
| IEEE logo and brand colours     | placeholder mark                                                        | DECISION NEEDED (official assets and brand guide from the student branch)                                                                                                                                                 |

**Rule for the agent:** never invent a value for this table. Read it from `lib/event.ts`, and if it is `TODO_CONFIRM`, render a neutral placeholder and log it in the final report.

**Timestamps:** every date and time in `lib/event.ts` must be an absolute timestamp with an explicit IST offset (+05:30), so countdowns and phase switches are correct on every visitor's device.

---

## 3. Architecture: how event-day modules attach later

The landing page must stay static so it can never fail because of the database. Event-day features arrive as separate routes that reuse shared pieces.

```
app/
  page.tsx                  Landing (this task). STATIC. No database imports.
  landing.css               Landing-only styles (this task)
  about/ rules/ schedule/   Existing, untouched
  leaderboard/ team/ admin/ api/   Existing, untouched
  event/                    RESERVED for Release 2 (countdown, sun clock, announcements, big screen). Do not create it in this task.
components/
  landing/                  NEW. Landing-only components (this task)
  sky/SkyScene.tsx          NEW. Presentational scene, shared with Release 2
lib/
  event.ts                  Single source of truth for event facts (edit values only)
```

### Extension points (designed now, used later)

1. **`SkyScene` takes a `progress` prop (0 to 1) and nothing else that is time-related.** On the landing page the scroll position feeds it. On the future `/event` page the current time of day feeds it, which becomes the live sun clock. One component, two sources.
2. **Phase is decided from dates in `lib/event.ts`, not from the database**, on the landing page. Pre-event shows Register and WhatsApp. During and after the event show Team Login and Leaderboard. This works even when Supabase is unreachable.
3. **Navigation stays a single list in `SiteHeader`.** Adding an event module later means adding one entry, not restructuring.
4. **Design tokens live in `:root` variables in `site.css`.** Landing adds new tokens (gold, blue, sky colours) and never hard-codes colours in components, so inner pages and future modules inherit the palette.
5. **New database tables for Release 2 (for example announcements) go in new migration files**, never by editing `schema.sql` in this task.

---

## 4. Landing design spec

### 4.1 Keep from the existing build

Dark base, single sans typeface with serif-italic accent words in headlines, the inner-page grid, and the particle-wave asset.

### 4.2 Golden Hours merge

- **Concept:** scroll is the clock. The sun travels an arc from sunrise to sundown as the visitor scrolls. Chapters land at their time of day.
- **The particle ridge is the horizon.** The sun rises behind it. The ridge is tinted by sky colour as you scroll (white at sunrise, gold at golden hour, indigo at dusk) using a blend mode over the existing asset. The existing asset stays; do not regenerate or replace it.
- **Sky:** CSS gradient driven by one CSS variable (`--progress`, 0 to 1) updated in a `requestAnimationFrame` scroll handler. Stars fade in after 0.72.
- **Headline style:** serif-italic accent words, for example "Start at sunrise with an *empty repo*." Final copy comes from `lib/event.ts` and section 2.

### 4.3 Chapters (order is fixed)

| #      | Time of day    | Content source                                                                                               |
| ------ | -------------- | ------------------------------------------------------------------------------------------------------------ |
| 1      | Sunrise (hero) | Event name, one-line pitch, Register on Unstop, Join WhatsApp, and a "Registrations close Oct 7, 12 AM" line |
| 2      | Morning        | What it is (format, theme reveal statement)                                                                  |
| 3      | Midday         | Rules summary (build window, private repo, reviewer collaborator, nothing pre-built)                         |
| 4      | Afternoon      | Day preview with link to`/schedule`                                                                        |
| 5      | Golden hour    | Prizes                                                                                                       |
| 6      | Dusk, stars    | Final call: Register, WhatsApp, contact, registration close time                                             |
| Footer | Night          | Organisers, contact, sponsor slot, IEEE branding                                                             |

No countdown and no full schedule on the landing page. A single kick-off date line and a single "registrations close" line are allowed. The live timer belongs to Release 2.

### 4.4 Mobile first (most visitors arrive from WhatsApp)

- Sticky bottom **Register on Unstop** bar that appears after the hero CTA scrolls out of view
- Tap targets at least 48 px; no hover-only interactions
- `svh` units, `env(safe-area-inset-*)` padding, native scrolling only (no scroll hijacking)
- Chapters stack: scene on top, text card below; desktop uses side-by-side with pinned scene

### 4.5 Particle asset handling

- Autoplay muted, `playsInline`, with a poster image so first paint never waits for video
- Provide a smaller mobile source; target under about 1.5 MB (agent reports the actual sizes)
- Do not autoplay when `prefers-reduced-motion` is on, when data saver is on (`navigator.connection.saveData`), or on very small viewports; show the poster instead
- Video must never block text or buttons from rendering

### 4.6 Rendering tiers

- **Tier 0:** all text and links render with JavaScript disabled
- **Tier 1:** CSS/SVG sky, sun and scroll chapters (this task)
- **Tier 2 (3D crystal):** not in Release 1

### 4.7 Accessibility

Visible keyboard focus, sufficient contrast for text over the sky (use a panel or scrim behind copy, not bare text on gradient), reduced-motion respected, meaningful heading order, decorative scene marked `aria-hidden`.

---

## 5. Deployment plan

### 5.1 Environments and branches

- `main` deploys to production on Vercel; every branch and PR gets a preview URL
- This task works on branch `feat/landing-golden-hours`. The teammate's platform work stays on other branches. Do not commit to `main` directly
- Vercel keeps previous deployments, so **rollback is one click**. Test the rollback once before launch

### 5.2 Two-stage launch (marketing never waits for the redesign)

**Stage A: Safe-live (target: today or tomorrow, the event is on Oct 9)**

1. Confirm facts (section 2) and update `lib/event.ts`
2. Deploy the existing landing page with corrected copy and real Unstop and WhatsApp links
3. Attach the domain, verify HTTPS, verify link preview in WhatsApp
4. Turn on analytics; use UTM parameters on Unstop and WhatsApp links
5. Begin promotion

**Stage B: Golden Hours (optional; only if Stage A is live and the platform dry run is on track; must be merged by Oct 4)**

1. Build on the feature branch; review on the preview URL on real phones
2. Merge to `main` only after section 9 acceptance criteria pass
3. Compare analytics before and after; keep the old landing page reachable in git history for rollback

### 5.2b Timeline to the event (Oct 9, 2026)

| Date            | What happens                                                                                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sep 29 to 30    | Confirm facts (section 2); fix every 24-hour and two-day string;**Stage A live**; promotion starts                                                                                     |
| Sep 30 to Oct 2 | Platform owner: pooler connection string, leaderboard caching, single-day schedule; test Unstop CSV import with a real export (a partial one is fine if Unstop lets you export before close) |
| Oct 3 to 4      | Golden Hours on the feature branch, review on real phones, merge by Oct 4 only if the items above are done                                                                                   |
| Oct 5           | Full dry run: about 60 fake team logins, submission burst, leaderboard reveal                                                                                                                |
| Oct 6           | **Code freeze** (code only). Final marketing push; registrations are still open until midnight                                                                                         |
| Oct 7, 12 AM    | Unstop registrations close                                                                                                                                                                   |
| Oct 7           | Import the final roster, fix any CSV surprises, confirm every team appears in`/admin/teams`. This is the buffer day                                                                        |
| Oct 8           | Email credentials and print login chits                                                                                                                                                      |
| Oct 9           | Event day                                                                                                                                                                                    |

If any earlier row slips, drop Stage B first. The event platform matters more than the redesign.

**Search-and-fix list for the single-day format** (values live in `lib/event.ts` and the pages that render them): "twenty-four", "24-hour", "24 hours", "Day 1", "Day 2", "Midnight", "Oct 24", "25 Oct", "one weekend", and the `event_start_time` and `submission_deadline` settings in the admin panel.

### 5.3 Production configuration

- `NEXT_PUBLIC_SITE_URL` must be the real domain (used for OG image, sitemap, canonical)
- The landing page needs **no** database variables. The other routes need `DATABASE_URL`, `SESSION_SECRET`, `CODE_SECRET` and Supabase keys; set them, but the landing page must render even if they are wrong
- `next build` must succeed with the database unreachable
- `robots.ts`: disallow `/admin`, `/team`, `/api`. Confirm the existing file does this; do not weaken it

### 5.4 Domain and hosting notes

- Buy the domain now; point it at Vercel and confirm HTTPS
- Vercel's free Hobby plan is intended for non-commercial use. A student branch event normally fits, but check current Vercel terms, especially if sponsors are involved

---

## 6. Tasks (ordered; each has acceptance criteria)

### Task 0: Dependency patch

- Update Next.js to the latest **15.5.x patch** (do not change major or minor). Recent security releases include hardening for `next/og`, which the OG image route uses
- Commit the lockfile
- **Accept:** `npm run build` passes; installed version printed in the final report

### Task 1: Config is the source of truth

- All event facts used by the landing page come from `lib/event.ts`
- Unconfirmed values are `TODO_CONFIRM` and render as neutral placeholders
- **Accept:** searching `app/page.tsx` and `components/landing/` finds no hard-coded dates, prizes, amounts or URLs

### Task 2: Prove the landing page is static

- `app/page.tsx` and everything it imports must not import `lib/db.ts`, `lib/settings.ts` or anything that opens a database connection
- Phase logic uses dates from `lib/event.ts` on the client
- **Accept:** the `next build` output lists `/` as static; a build with `DATABASE_URL` unset still succeeds and `/` renders

### Task 3: SkyScene component

- `components/sky/SkyScene.tsx`, presentational, props: `progress` (0 to 1), optional `className`
- Renders sky gradient, sun on arc, star layer; reads no scroll or time itself
- **Accept:** renders correctly for progress 0, 0.5 and 1 in isolation; no scroll listeners inside the component

### Task 4: Hero merge

- Compose `SkyScene`, the existing particle asset (as horizon, tinted), headline, CTAs
- Scroll handler in a landing-only wrapper writes `--progress` with `requestAnimationFrame`, passive listener
- **Accept:** on a throttled mobile profile, text and buttons are visible before the video loads; poster shown when reduced motion or data saver applies

### Task 5: Chapters and footer

- Implement the six chapters and footer from section 4.3 with copy from `lib/event.ts`
- **Accept:** all chapters readable with JavaScript disabled (sky simply stays at sunrise)

### Task 6: Mobile CTA bar and small header change

- Sticky Register bar (section 4.4)
- `SiteHeader.tsx`: **style-only** change so nav links are plain text links and Register appears once. Requires teammate approval before merge because the header is shared by every page
- **Accept:** header works on `/about`, `/rules`, `/schedule`, `/leaderboard`, `/team/login` at widths 360, 768, 1440

### Task 7: SEO and sharing

- Update title, description and existing `app/opengraph-image.tsx` copy; keep `sitemap.ts` and `robots.ts`
- **Accept:** preview image renders at 1200×630 with the event name and no placeholder text

### Task 8: Analytics and UTM

- Add one cookie-free analytics option already available on the platform (Vercel Analytics) if it needs no new dependency; otherwise **stop and report**, do not add a package
- UTM parameters on Unstop and WhatsApp links, defined in `lib/event.ts`
- **Accept:** events visible in the dashboard after a test visit

### Task 9: Performance and report

- Measure on a throttled mobile profile; write results into the final report
- **Accept:** see section 9

---

a

h

## 7. Requests for the platform owner (NOT for the landing agent)

These came from reading the README and are outside this task. Record them; do not act on them.

1. **Connection pooling:** use Supabase's pooler connection string for `DATABASE_URL` on Vercel, keep the `pg` pool size small, and confirm no named prepared statements are used with transaction-mode pooling
2. **Leaderboard reveal stampede:** cache `/api/leaderboard` for a few seconds and add a small random delay before clients refetch after a pulse
3. **Leaderboard pre-reveal state:** show a friendly "Opens after judging" message instead of an error before reveal
4. **Admin login:** confirm lockout or rate limiting exists for the admin login as well as team login
5. **Supabase pausing:** keep the project active (scheduled ping or paid plan for the event month)
6. **Dry run:** simulate roughly 60 team logins and a burst of submissions before the event

---

## 8. Rules and sandbox (applies to every agent working from this file)

### DO NOT

- Do not add any feature not listed here
- Do not install any package. If a task seems to need one, stop and report
- Do not rename or move existing files or folders
- Do not modify shared contracts: database schema, API shapes, environment variable names, session or code logic
- Do not use your own judgment to "improve" or restyle pages outside the landing scope
- Do not invent event facts; use `lib/event.ts` and `TODO_CONFIRM`
- Do not commit secrets, `.env.local`, or real credentials
- Do not push to `main`

### File ownership

| Path                                                                                                                                 | Owner          | Landing agent may                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `app/page.tsx`, `app/landing.css`                                                                                                | Landing        | Edit freely                                                                                                                 |
| `components/landing/*`, `components/sky/*`                                                                                       | Landing        | Create and edit                                                                                                             |
| `lib/event.ts`                                                                                                                     | Shared         | Edit**values only**. The one allowed structural change is adding a `registrationCloseAt` field if it does not exist |
| `app/opengraph-image.tsx`                                                                                                          | Shared         | Copy edits only                                                                                                             |
| `components/SiteHeader.tsx`                                                                                                        | Platform owner | Style-only change, with owner approval                                                                                      |
| `site.css`                                                                                                                         | Platform owner | **Add** new `:root` tokens only; never change existing ones                                                         |
| `app/api/**`, `app/team/**`, `app/admin/**`, `app/leaderboard/**`, `lib/**` except `event.ts`, `db/**`, `scripts/**` | Platform owner | **Read only**                                                                                                         |
| `package.json`                                                                                                                     | Shared         | Only the Task 0 Next.js patch                                                                                               |

### Stop conditions

Stop and report if: a required value is `TODO_CONFIRM` and blocks a build step; a task needs a new package; a change would touch a read-only path; `next build` fails for a reason outside your files.

---

## 9. Definition of done and launch checklist

**Acceptance criteria**

- `/` is static in the build output and renders with the database unreachable
- On a throttled mobile profile (4G-class), text and CTAs are usable before the video loads; largest contentful paint at or under 2.5 s using the poster; layout shift at or under 0.1
- Works with JavaScript disabled (all content and links visible)
- Reduced-motion and data-saver visitors get the poster, not video
- No console errors; no unconfirmed placeholder visible on the public domain
- Existing pages (`/about`, `/rules`, `/schedule`, `/leaderboard`, `/team/login`, `/admin/login`) render as before

**Launch checklist**

- [ ] Section 2 facts confirmed and merged
- [ ] Unstop and WhatsApp links tested on phone and desktop
- [ ] Link preview checked in WhatsApp using the final URL (previews are cached)
- [ ] Official IEEE assets in place per the brand guide
- [ ] Real-device pass: low-end Android, mid-range Android, iPhone Safari, desktop Chrome and Firefox
- [ ] Domain, HTTPS, analytics, sitemap, robots, 404 working
- [ ] Rollback tested once

---

## 10. Release 2 attachment plan (for later, not this task)

With the event on Oct 9, the platform's existing countdown, schedule and leaderboard are enough for the day. The modules below are stretch goals; do them only after the dry run passes.

| Module                                      | Route                | Plugs into                                                                |
| ------------------------------------------- | -------------------- | ------------------------------------------------------------------------- |
| Event page: countdown, schedule, NOW marker | `/event`           | Dates from`lib/event.ts`; reuses `SkyScene` with time-of-day progress |
| Pinned announcements                        | `/event` and admin | New migration file, new admin form; polling every 30 seconds              |
| Big screen mode                             | `/event/screen`    | Same data as`/event`, larger type, auto-refresh                         |
| Phase-aware CTAs everywhere                 | Header               | Phase from dates, already in place from this task                         |
| Reveal experience                           | `/leaderboard`     | Existing leaderboard engine, caching per section 7                        |

Code freeze about three days before the event, followed by a full dry run.

---

## 11. Risks

| Risk                                         | Mitigation                                                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Wrong facts go public (24h, prizes, weights) | Section 2 gate;`TODO_CONFIRM` rule                                                                                          |
| Landing goes down with the database          | Task 2: static, database-free, verified in build output                                                                       |
| Video hurts mobile load                      | Poster first, small mobile source, reduced-motion and data-saver fallbacks                                                    |
| Landing restyle breaks inner pages           | Add tokens only; header change needs owner approval                                                                           |
| Two people edit shared files                 | Branch rules and ownership table                                                                                              |
| Redesign delays marketing                    | Two-stage launch; Stage A goes live first                                                                                     |
| Only about 10 days to the event              | Timeline in section 5.2b; Stage B is optional and drops first; dry run on Oct 5 and code freeze on Oct 6                      |
| Registration rush on the last night          | Landing page live, static and fast well before Oct 6; final promotion push that day; roster import on Oct 7 with a buffer day |
