# Admin files: `main` vs `event_module`

**Checked:** 7 Oct 2026, after `git fetch`.
* `origin/main` = `6abf865` (the branch Vercel deploys)
* `origin/event_module` = `3f6b96e`

Paths compared: `app/admin/**`, `app/api/admin/**` and `lib/**`. `package.json` and `package-lock.json` are identical on both branches.

## Pages under `app/admin/(panel)/` and `app/admin/`

| File | main | event_module | Same content? | BP-001 guard needed |
| :--- | :-: | :-: | :-: | :-: |
| `(panel)/layout.tsx` | ✅ | ✅ | same | keep the layout check |
| `(panel)/page.tsx` (overview) | ✅ | ✅ | same | ✅ |
| `(panel)/import/page.tsx` | ✅ | ✅ | same | ✅ (no data, but guard anyway) |
| `(panel)/teams/page.tsx` | ✅ | ✅ | same | ✅ (codes + emails) |
| `(panel)/scores/page.tsx` | ✅ | ✅ | same | ✅ |
| `(panel)/leaderboard/page.tsx` | ✅ | ✅ | same | ✅ |
| `(panel)/send-credentials/page.tsx` | ✅ | ✅ | same | ✅ (emails) |
| `(panel)/logs/page.tsx` | ❌ | ✅ | event_module only | ✅ (added when `main` is merged into `event_module`) |
| `print/page.tsx` | ✅ | ✅ | same | already checks inside the page; regression test only |
| `login/page.tsx` | ✅ | ✅ | same | public |

## API routes under `app/api/admin/`

| Route | main | event_module | Same? |
| :--- | :-: | :-: | :-: |
| credentials, criteria, login, logout | ✅ | ✅ | same |
| import, reset, scores, settings, teams | ✅ | ✅ | **different** (the event-day changes and audit logging) |
| logs | ❌ | ✅ | event_module only |

Every `main` API route except login and logout uses `adminRoute()`. The audit found these routes already return 401 (SEC-B01 PASS). Batch 0 changes no API code; the routes are covered by regression tests only.

## `lib/`

* **Identical:** `session.ts`, `db.ts`, `codes.ts`, `mail.ts`, `settings.ts`, `criteria.ts`, `format.ts`.
* **Different:** `admin-teams.ts`, `event.ts`, `github.ts`, `http.ts`, `scoring.ts`, `team.ts`.
* **event_module only:** `logger.ts`.

**Batch 0 touches `lib/session.ts`** (adds `requireAdmin()`) and `lib/admin-teams.ts` (adds a guard). The `session.ts` change applies cleanly to both branches. `admin-teams.ts` differs, so the one-line guard may need a hand merge into `event_module`.

## Database

`main` has `db/schema.sql` only, with **no `db/migrations/`**. The Batch 0 tests against `main` use a separate local DB, `synapse_main`, built from `main`'s schema.
