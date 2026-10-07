# Audit progress

## 6 Oct 2026

### Done

* **Phase 0:** branch `audit/eventday-hardening` cut from `event_module`. Baseline written to `BASELINE.md`.
* **Phase 1:** test environment set up.
  * Local Postgres on `:54329` (`embedded-postgres`, because Docker is not installed).
  * SMTP sink with a Mailpit-style API on `:1025` / `:8025`.
  * Mock GitHub on `:4010`.
  * Safety guard `scripts/audit/assert-safe-env.mjs`.
  * `.env.audit` (git-ignored).
  * `GITHUB_API_BASE_URL` seam added in `lib/github.ts`.
* **Phase 2:** `scripts/audit/generate-mock-150.mjs` (seed 2026) wrote `audit/data/*`.
* **Phases 3–4:** `scripts/audit/run-eventday.mjs` (63 checks) and `scripts/audit/github-scenarios.mjs`.
* **Phase 5:** `REVIEW_SUMMARY.md`. **STOPPED. Waiting for Devesh's approved BP IDs.**

### Next, after approval

* **Phase 6:** fix the approved IDs in order S0 → S1 → S2, with one commit and one regression assertion per fix.
* **Phase 7:** two clean full runs, then `FINAL_REPORT.md` and `EVENT_DAY_RUNBOOK.md`.

### Open questions for Devesh

* BP-001: regenerate all codes?
* BP-003: how are finalists chosen?
* BP-011: private repos with the reviewer token, or public repos?
* BP-015: disable reset in production?
* BP-018: 08:30 repo preparation vs the 09:00 first-commit rule?
* BP-020: accept the risk?

### How to re-run

1. Start the services.
2. `set -a; . ./.env.audit; set +a`
3. `npm run build && npx next start`
4. `node scripts/audit/mock-github.mjs`
5. `node scripts/audit/run-eventday.mjs`

## 7 Oct 2026: Phase 6 (approval: `FIX_ORDERS.md`, all of BP-001 to BP-030)

### Batch 0 (BP-001): done, waiting on the human deploy
* Wrote `audit/BRANCH_DIFF.md`.
* Worktree `../IEEE_Synapse_2026-fix-admin-auth` holds branch `fix/admin-auth`, cut from `origin/main` `6abf865`.
* Test DB `synapse_main` built from `main`'s schema. Server on `:3100`.
* Regression test `tests/regression/bp-001-admin-auth.mjs`, 360 probes:
  * failed on unfixed `main` (120 failures, 60 leaks);
  * passes on the fix (0 failures, admin control OK).
* Commit `05f8980` contains app code only. **Not pushed.** The user pushes.
* `FIX_LOG.md` and `HUMAN_CHECKS.md` started.

### Next
1. User pushes, opens the PR, merges, and verifies production (`HUMAN_CHECKS.md` #1–3).
2. Merge `main` into `event_module` (add the guard to `/admin/logs` too).
3. Batch 1 on `audit/eventday-hardening`: BP-012, 021, 024, 019.

### Constraints
* User rule: **Claude never pushes.** Give the user the commands instead.
* Audit and test material stays local; the repo is public.
