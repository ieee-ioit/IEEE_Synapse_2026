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

## 7 Oct 2026 (later): user asked for all remaining fixes
* Worktree `../IEEE_Synapse_2026-event` on local `event_module`. BP-001 merged from `fix/admin-auth`, plus the logs-page guard and the GitHub API seam.
* Test DB `synapse_ev`; server on `:3200`; env in the auditenv `.env.ev`.
* Rule learned: on Windows, **stop the server before `next build`** or the build hangs on `.next` locks (use the auditenv `build.sh`).

| Batch | Result before the fix | Result after |
| :--- | :--- | :--- |
| Batch 1 (BP-012/021/024/019) | 3 of 17 pass | **17/17**, commits `7677d58` `82e16f1` `899da5e` |
| Batch 2 (BP-006/007/008/009/011/023/026/028/030) | 6 of 23 pass | **23/23**, commits `71a1f51` `25e33fc` `927da11`. Migrations 004 and 005 applied twice on a populated DB (40 teams) |
| Batch 3 (BP-002/003/004/010/017) | 2 of 19 pass | **19/19**, commits `dbfe674` `aaadc14` `d53b296` `4718f8e`. Migration 006 |

**New finding (not in FIX_ORDERS, not fixed, needs approval):** `logAudit()` stores `details` double-encoded (a JSON string inside jsonb), because `JSON.stringify` is applied before `::jsonb` and postgres.js encodes it again.
| Batch 4 (BP-005/013/014/015/016/018/022/025/027/029) | 3 of 15 pass | **15/15**, commits `5e18c97` … `104c581`. Migration 007 |

### Full event-day runs (`run-eventday.mjs` on a fresh DB, after all fixes)
* **Trial 1:** 60 PASS, 2 FAIL.
  * SEC-D02 was a test artifact: the video window was closed by BP-002. The test now opens it first.
  * **INV-09 is real:** the floating-point tie-break bug, recorded as BP-031.
* **Trial 2:** 62 PASS, 1 ACCEPTED-RISK (L1, p95 1.6 s), 1 N/A (GH-4). INV-09 passed by chance.
* **Not done yet:** the `rc-1` tag and the two final runs. Waiting for Devesh on BP-031, BP-032 and the BP-018 judging time.

### Records written
`FIX_LOG.md`, `HUMAN_CHECKS.md`, `EVENT_DAY_RUNBOOK.md`; banner added to `BREAKPOINTS.md`. Public-safe `docs/SECURITY_REVIEW_SUMMARY.md` is in the event worktree, **uncommitted**.
