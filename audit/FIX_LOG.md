# Fix log (Phase 6)

**Approval:** `FIX_ORDERS.md` (Devesh, 7 Oct 2026). All of BP-001 to BP-030; BP-020 is accepted as a risk.

**Branches:**
* `fix/admin-auth` (from `main`): BP-001 only, waiting for the human PR and deploy.
* local `event_module`: everything else, in worktree `../IEEE_Synapse_2026-event`.
* **Nothing has been pushed by Claude.**

**How every fix was tested:**
1. Write the regression test first.
2. Run it against the build *before* the batch. It fails.
3. Apply the batch, then `npx tsc --noEmit` and `npm run build`.
4. Run it again; it passes.
5. Re-run all earlier suites.

Logs are in `audit/results/<batch>-before.log` and `<batch>-after.log`. Tests live in `tests/regression/` (local only).

| Batch | Suite | Before | After |
| :--- | :--- | :--- | :--- |
| 0 | `bp-001-admin-auth.mjs` (360 probes) | 120 failures, 60 leaking codes/emails/names (on `main`'s build) | 0 failures on `main` and on `event_module` |
| 1 | `batch1.mjs` | 3 of 17 passed | 17/17 |
| 2 | `batch2.mjs` | 6 of 23 passed (recheck with a hanging GitHub took **284 s**) | 23/23 |
| 3 | `batch3.mjs` | 2 of 19 passed | 19/19 |
| 4 | `batch4.mjs` | 3 of 15 passed (BP-029 already passed: the package was upgraded before this run) | 15/15 |

After Batch 4, every suite passes together on one build: 360 + 17 + 23 + 19 + 15 checks.

## Per finding

| BP | Sev | Commit (`event_module` unless noted) | What changed | Status |
| :--- | :-: | :--- | :--- | :--- |
| 001 | S0 | `05f8980` (`fix/admin-auth`, merged as `df3a240`), `45e4c83` | `requireAdmin()` first in every admin page and in `getAdminTeams()`; logs page too | FIXED. Production verification is a human step |
| 002 | S1 | `dbfe674`, `aaadc14` | `videoUnlockAt` setting (default start + 4 h); `/api/team/video` returns 403 before it; dashboard reads the server value | FIXED |
| 003 | S1 | `dbfe674`, `4718f8e` | `set-finalists` action + Finalists panel: exactly N, Stage-1-scored, not DQ, tie and incomplete confirmations, locked once Stage 2 exists, one transaction, `FINALISTS_SET` audit | FIXED |
| 004 | S1 | `dbfe674`, `d53b296` | Judge names normalised (key + display name, migration 006); preview lists judges and warns on near-duplicates (also against already-imported judges) and on names outside `expectedJudges` | FIXED |
| 005 | S1 | `5e18c97` | Batches claimed with `FOR UPDATE SKIP LOCKED`; claim released on failure | FIXED |
| 006 | S1 | `71a1f51` | Session carries a login-code fingerprint, checked on every request (also rejects DQ); DQ login refused (after the code check) | FIXED. Sessions from before the deploy must log in again |
| 007 | S1 | `25e33fc` | Repo saved after submit → `after(checkTeamRepo)`; "Re-check unchecked" button + filter | FIXED |
| 008 | S2 | `71a1f51` | Attempt reserved atomically before verifying | FIXED (50 parallel → at most 5 evaluated) |
| 009 | S2 | `71a1f51`, `25e33fc` | Lock per (team, IP) (migration 004) + per-team cap of 100 failures / 10 min across IPs; Unlock / Unlock all | FIXED. **Limitation:** teams on the attacker's own network (same venue NAT IP) can still be locked. Use "Unlock all logins" |
| 010 | S2 | `d53b296` | Stage 2 rows for non-finalists rejected per row | FIXED |
| 011 | S2 | `25e33fc` | Private, 404, rate-limit, 5xx and timeout give `unchecked` (migration 005), never `review`/`flagged`; no collaborator call in the app; `scripts/reviewer-access-report.mjs` (local, reviewer token from env only) | FIXED |
| 012 | S2 | `82e16f1` | Import rejects missing, invalid or duplicate leader emails, more than 4 members, and names over 120; per-row reason | FIXED |
| 013 | S2 | `e252e7f` | Generic message + 8-character reference; details only in `error_logs`; 503 if the admin lookup itself fails | FIXED |
| 014 | S2 | `621ce3f`, `5e18c97` | `CRITERIA_UPDATED`, `CREDENTIALS_EMAILED` (counts and team numbers only); team actions logged after success | FIXED |
| 015 | S2 | `4dcb750` | Reset needs `ALLOW_RESET=1` + admin password + `DELETE` | FIXED |
| 016 | S2 | `8bc7c62` | "shared repo" badge + filter | FIXED |
| 017 | S2 | `d53b296` | "incomplete: N of 7 criteria" in the import preview, admin ranking and Finalists panel; formula unchanged | FIXED |
| 018 | S2 | `23eb3c8` | 08:30 schedule entry: "Create your GitHub repo only after 09:00 AM" | FIXED (copy). **UNCLEAR:** the judging time. The site says 04:00 PM; the guide says judging 15:00–17:30. Not edited; waiting for Devesh |
| 019 | S1 | `899da5e` | Production + localhost links → credential send refused and a warning on Print and Send credentials; guide env vars corrected | FIXED in code. **Setting `NEXT_PUBLIC_SITE_URL` in Vercel is a human step** |
| 020 | S2 | — | — | **ACCEPTED-RISK**: pool `max` 3, `prepare:false` confirmed; stagger check-in (runbook) |
| 021 | S3 | `82e16f1` | Control characters become spaces in every imported field (a NUL byte previously crashed the import with a 500) | FIXED |
| 022 | S3 | `8bc7c62` | Video and repo links must be https (bare `github.com/...` still accepted) | FIXED |
| 023 | S3 | `927da11` | Repeated submit returns 200 with no second audit row | FIXED |
| 024 | S3 | `7677d58` | Admin request bodies capped at 1 MB, returning 413 | FIXED |
| 025 | S3 | `0215039` | `Permissions-Policy` + `Content-Security-Policy-Report-Only` (nosniff, DENY and referrer were already set) | FIXED |
| 026 | S3 | `71a1f51` | Unknown team and wrong code: same 401 and message | FIXED |
| 027 | S3 | `8bc7c62` | `github_has_readme` (migration 007) + badge/filter; status logic unchanged | FIXED |
| 028 | S3 | `25e33fc` | Max 5 per recheck request, 4 s timeout per call | FIXED |
| 029 | S3 | `104c581` | `npm audit fix` + Next 15.5.27 (latest 15.5.x): 0 vulnerabilities | FIXED |
| 030 | S3 | `25e33fc` | Failed check clears `first_commit_at` | FIXED |

**Also on `event_module`:** `38c5955` adds the `GITHUB_API_BASE_URL` test seam (defaults to the real API).

## Deviations from FIX_ORDERS (please review)
* **"One commit per finding":** findings that change the same lines share one commit, named after all of them (for example `fix(BP-006, BP-008, BP-009, BP-026)`, all in the login route).
* **Migration numbering:** the next free numbers were `004`–`007`. FIX_ORDERS said "005 onward", but no 004 existed, and FIX_ORDERS also says to check the latest number first.
* **BP-001 RSC responses:** these return 200 with a redirect-only payload (Next.js behaviour); see the Batch 0 notes. A real 3xx would need `middleware.ts`, which is not done.

## New findings during Phase 6 (not in FIX_ORDERS, not fixed, approval needed)
* **BP-031 (S1), podium tie-break defeated by floating point.** `lib/scoring.ts` sorts on a float `score`. Two teams with identical marks summed to 9.5 and 9.4999999999999982, so the later submitter ranked first and INV-09 failed in the trial full run.
  * Proposed one-line fix: sort on `round(pt.score::numeric, 6)`.
  * It changes no scores, only which of two exactly tied teams ranks first, as the existing rule intends.
* **BP-032 (S3), audit `details` double-encoded.** `logAudit()` stores `details` as a JSON *string* inside jsonb, because it `JSON.stringify`s before `::jsonb`.
  * Readable, but awkward to query.
  * Fix: pass the object (`sql.json(details)`). Only affects new rows.
