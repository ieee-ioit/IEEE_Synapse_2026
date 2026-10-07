# Fix log (Phase 6)

| BP | Branch / commit | Regression test | Before | After | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| BP-001 | `fix/admin-auth` @ `05f8980` (from `origin/main` `6abf865`) | `tests/regression/bp-001-admin-auth.mjs` | 120 of 360 probes fail. **60 leak** codes, emails and names: 20 each on `/admin/teams`, `/admin/scores`, `/admin/send-credentials` (every non-admin cookie × plain, RSC, `?_rsc`, state-tree) → `audit/results/bp-001-before.log` | 0 of 360 fail; a real admin still sees all 7 pages → `audit/results/bp-001-after.log` | FIXED locally, tested against `main`'s build. **Waiting for production deploy and verification (HUMAN_CHECKS #1)** |

## BP-001 notes
* **What changed:** `requireAdmin()` added to `lib/session.ts`. It is the first line of the overview, import, teams, scores, leaderboard and send-credentials pages, and the first line of `getAdminTeams()`. The layout check stays.
  * `/admin/print` was already safe and is unchanged; the test covers it.
  * `/admin/logs` doesn't exist on `main`. It gets the guard when `main` is merged into `event_module`.
* **Cookie cases tested:** none, expired (signed with an exp in the past), tampered signature, a real team cookie, and a team-kind JWT in the admin cookie slot.
* **Request variants tested:** plain, `RSC: 1`, `RSC: 1` + `Next-Router-Prefetch: 1`, `?_rsc=x`, and a forged `Next-Router-State-Tree`. Also every `/api/admin/*` route × GET/POST/PUT/DELETE × every cookie case.
* **What a non-admin gets back:**
  * Plain requests get **307 → `/admin/login`** with no data.
  * RSC requests get **200**, because Next.js can't send an HTTP 3xx to its client router. The body is the public root shell plus `NEXT_REDIRECT;replace;/admin/login;307`, with no admin markup and no team data. `/admin/print` behaved the same way before the fix.
  * Prefetch requests get 200 with only the route tree and `null` content, because dynamic pages aren't rendered on prefetch.
  * The test accepts only these exact shapes.
  * Getting a real 3xx on RSC requests would need a `middleware.ts`, which FIX_ORDERS doesn't cover. Not done.
* **Defence in depth:** the overview, scores, leaderboard and send-credentials pages run their queries inline. `requireAdmin()` is awaited before any query starts, so no data is fetched without an admin. `getRanking()` and `getSettings()` are also used by public routes, so they can't redirect.
* **Gates passed:** `npx tsc --noEmit` ✅ and `npm run build` ✅ on `fix/admin-auth`. The public `/` and `/leaderboard` pages still return 200.
