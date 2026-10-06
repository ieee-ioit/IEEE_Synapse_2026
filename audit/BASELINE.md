# Phase 0: Baseline

**Run date:** 6 Oct 2026 · **Branch:** `audit/eventday-hardening`, cut from `event_module` @ `3f6b96e` · **Repo:** `ieee-ioit/IEEE_Synapse_2026`

## Toolchain and build

| Item | Result |
| :--- | :--- |
| Node / npm | 24.14.0 / 11.9.0 |
| Next.js / React / react-dom | **15.5.26 / 19.3.0 / 19.3.0** (both newer than the fixes for CVE-2025-29927 and CVE-2025-55182) |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run build` (with `.env.audit`) | ✅ built in 92 s, 31 routes |
| `npm audit --omit=dev` | 1 high: `source-map-js` ≤1.2.1 (via `next → postcss`). Only used at build time; `npm audit fix` resolves it |
| Secrets in git history | None. Only placeholders (`ghp_xxxx…`, `generate_a_random_32_character_string_here`, `[PASSWORD]@[HOST]`) |
| Client bundle (`.next/static`) | No secret values, no `postgresql://` URLs and no source maps found |
| `.gitignore` | Covered `.env`, `.env.local`, `.env.*.local`. **Added** `.env.audit` and `audit/results/` |

## Test environment: differences from the manual

* **This machine has no Docker.** Postgres and Mailpit were replaced with:
  * `embedded-postgres` (real Postgres server binaries) on `127.0.0.1:54329`, `max_connections=60`, database `synapse_audit` (UTF-8). The test-only Supabase roles `anon`, `authenticated` and `service_role` were created first.
  * A Node SMTP sink on `:1025` with a Mailpit-compatible HTTP API on `:8025` (`GET /api/v1/messages`, `DELETE /api/v1/messages`).
  * Both run from a temp folder **outside the repo**, and no `package.json` change was made. To use the manual's `docker-compose.audit.yml` instead, install Docker Desktop.
* The app was served with `npm run build && next start`, `TZ=UTC`.
* The mock GitHub server is `scripts/audit/mock-github.mjs` on `:4010`.
* **One allowed test seam was added:** `lib/github.ts` reads `GITHUB_API_BASE_URL`, which defaults to `https://api.github.com`. This is the only change to application code.
* `npm run db:setup` was run **twice** on the audit DB, and both runs were clean, so the migrations are idempotent.

## The guide (`PROJECT_CODEBASE_GUIDE.md`) compared with the actual code

| Guide says | Code actually does |
| :--- | :--- |
| `ADMIN_SECRET` signs admin cookies | The variable is **`SESSION_SECRET`** (`lib/session.ts`), used for both team and admin cookies |
| `NEXT_PUBLIC_APP_URL` (manual) | The variable is **`NEXT_PUBLIC_SITE_URL`** (`lib/format.ts:8`). It falls back to `http://localhost:3000` |
| `/admin/send-credentials` = "resend / lookup lost chit" | A **real mailer exists**: `lib/mail.ts` (nodemailer) and `POST /api/admin/credentials`, batches of 8, **leader email only** |
| `/api/leaderboard` returns finalists only | It returns teams with `isFinalist` **or** `rank ≤ 10` (before finalists exist, that is the Stage-1 top 10) |
| "Organizers select Top 10 (`is_finalist`)" | **No UI or API for this.** Only `scripts/simulate-eventday.*` sets `is_finalist` |
| Judging 15:00–17:30 | `lib/event.ts` schedule says Judging **04:00 PM** |
| Private rank "of 100 teams" | The count is dynamic (`ranked`), so this is fine |
| Reviewer collaborator is monitored | Nothing in the code checks collaborators |

## Route inventory and auth

| Route | Auth |
| :--- | :--- |
| `app/api/admin/{credentials,criteria,import,reset,scores,settings,teams}` | `adminRoute()` wrapper (admin cookie + JSON content type + Origin check) ✅ |
| `app/api/admin/logs` (GET) | inline `getAdmin()` ✅ |
| `app/api/admin/login`, `logout` | public (login rate-limited to 8 tries / 15 min per email) |
| `app/api/team/{repo,video,submit,me}` | `getTeamSession()` from the cookie only ✅ |
| `app/api/team/login`, `logout` | public (5 tries, then a 10-minute lock per team) |
| `app/api/leaderboard`, `app/api/health` | public |
| `app/admin/print/page.tsx` | checks `getAdmin()` in the page itself ✅ |
| `app/admin/(panel)/*/page.tsx` (teams, send-credentials, logs, scores, leaderboard, import, home) | ⚠️ **checked only in `layout.tsx`.** The pages query the DB without their own check. See BP-001 |
| No `middleware.ts` | Not affected by the middleware-bypass class of bugs |
