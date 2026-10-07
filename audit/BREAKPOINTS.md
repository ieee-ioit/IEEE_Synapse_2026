# Break points

Evidence comes from `node scripts/audit/run-eventday.mjs` (the full log is in `audit/results/run1.log`; the JSON is in `audit/results/*.json`, which git ignores) and from `node scripts/audit/github-scenarios.mjs`. All tests ran against the **local** production build only. Nothing touched Vercel or Supabase. All entries are **Status: OPEN**.

---

### BP-001: Admin pages send every login code and email to anyone, with no login needed
- **Severity:** S0 · **Area:** auth / data-exposure · **Found in:** Phase 3 SEC-B05 · **Invariants:** INV-07, INV-13
- **Steps:** with no cookie, run `curl -s http://localhost:3000/admin/teams | grep -o 'SYN-[A-Z0-9]\{6\}' | sort -u | wc -l`
- **Expected:** a 307 redirect to `/admin/login` with no data.
- **Actual:** the server returns `307` but **the 137 KB body is the fully rendered page: 162 of 162 login codes and 150 leader emails**. Browsers follow the redirect, so nobody notices, but `curl` or a script keeps the body. `/admin/send-credentials` leaks all 161 leader emails the same way. With RSC headers (`RSC: 1`), `/admin/teams` returns **200** with the same data.
- **Root cause:** `app/admin/(panel)/layout.tsx:14` is the only auth check. The layout and the page render **in parallel**, so `teams/page.tsx`, `send-credentials/page.tsx`, `logs/page.tsx`, `scores/page.tsx` and the others run their DB queries and stream the result before the layout's `redirect()` lands. `/admin/print` is safe because it checks inside the page.
- **Proposed fix:** a `requireAdmin()` helper (calls `getAdmin()`, then `redirect('/admin/login')`) as the **first line of every `(panel)` page**. Also add a guard inside `getAdminTeams()` as defence in depth. Effort **S**.
- **Event-day impact:** anyone can take every chit code and log in as any team (change repo or video, submit). **`origin/main` has the same page and layout code.** If teams have been imported into the production DB, the codes may be readable now. I did not test production.
- **Decision needed:** yes. After the fix ships, should we **regenerate all codes** (and re-send emails and reprint chits) in case the production codes have already been harvested?
  Answer (FIX_ORDERS, 7 Oct): the real roster is **not yet imported** into production, so there are no codes to regenerate.
- **Status:** FIXED on `fix/admin-auth` @ `05f8980`. Waiting for production deploy and verification.

### BP-002: Video link is accepted before 13:00 (enforced in the UI only)
- **Severity:** S1 · **Area:** deadline · **Found in:** Phase 4 Repo phase · **Invariant:** INV-02
- **Steps:** with `eventStart = now − 1 min`, send `POST /api/team/video {"url":"https://youtu.be/abc"}` with a team cookie.
- **Expected:** 403. **Actual:** `200 {"ok":true}`.
- **Root cause:** `app/api/team/video/route.ts` has no unlock check. Only `TeamDashboard.tsx:44` hides the field until `start + 4h`.
- **Proposed fix:** in the route, reject when `now < videoUnlockAt`. `videoUnlockAt` should be a setting that defaults to `eventStart + 4h` (13:00 IST). Effort **S**.
- **Event-day impact:** low on its own (it is an honour rule), but it breaks the phased-submission rule as written.

### BP-003: No supported way to pick the Top 10 finalists
- **Severity:** S1 · **Area:** scoring / admin · **Found in:** Judging step 5 · **Hypothesis:** H-03 confirmed
- **Actual:** `is_finalist` and `stage2_order` are set only by `scripts/simulate-eventday.*` (direct SQL). `/api/admin/teams` answers `400 Unknown action` for anything else.
- **Proposed fix:** a `set-finalists` admin action (or a button on the Leaderboard tab) that requires **exactly 10** non-disqualified teams with a unique `stage2_order` and writes an audit row. Effort **M**.
- **Event-day impact:** at about 16:00, someone would have to edit the production DB by hand under time pressure.
- **Decision needed:** yes. Is the Top 10 the automatic Stage-1 order, or do the judges hand-pick?

### BP-004: A judge whose name is typed differently is counted as several judges
- **Severity:** S1 · **Area:** scoring · **Hypothesis:** H-11 confirmed
- **Steps:** import Stage-1 rows for one team under `Dr. Rao`, `dr rao ` and `DR RAO`.
- **Actual:** 5 judge rows for one criterion (3 real judges + 2 variants). The average is skewed by the "extra" judges.
- **Root cause:** `app/api/admin/scores/route.ts:30` only trims the judge name.
- **Proposed fix:** normalise judge names (lower-case, strip punctuation and whitespace) before upsert, and show the list of distinct judges in the dry-run preview. Effort **S**.
- **Event-day impact:** a typo when digitising paper sheets can **change the ranking or the winner**.

### BP-005: Two admins sending credentials at the same time sends duplicate emails
- **Severity:** S1 · **Area:** email · **Invariant:** INV-14
- **Steps:** two admin sessions call `POST /api/admin/credentials` in a loop at the same time.
- **Actual:** 292 emails for 161 leaders, and **131 leaders got 2 emails**. With one admin there are no duplicates. The login code in the email works, and the login link equals `NEXT_PUBLIC_SITE_URL`.
- **Root cause:** `app/api/admin/credentials/route.ts:22` selects unsent rows without claiming them.
- **Proposed fix:** claim the batch atomically: `update … set credentials_sent_at = now() where id in (select … for update skip locked limit 8) returning …`, and set it back to null if the send fails. Effort **S**.

### BP-006: Old sessions survive `regenerate-code`, and disqualified teams can still log in
- **Severity:** S1 · **Area:** auth · **Invariants:** INV-12, INV-10
- **Actual:** after `regenerate-code`, the old code fails (correct), **but the old cookie still reads `/api/team/me` (200) and saves a repo (200)**. A disqualified team **can log in (200)**. Its writes are blocked (403), which is correct.
- **Root cause:** stateless JWT with a 24 h lifetime (`lib/session.ts`). Login does not check `submission_status`.
- **Proposed fix:** put a short fingerprint of `login_code_hash` in the JWT and compare it on every team request (a regenerated code then invalidates every session), and refuse login for disqualified teams. Effort **S**.
- **Event-day impact:** if a chit is lost or stolen, regenerating the code does not kick out whoever already logged in with it.

### BP-007: A repo changed after final submit is never re-checked
- **Severity:** S1 · **Area:** github / deadline
- **Steps:** submit (the check runs), then save a different repo URL before 15:00.
- **Actual:** `github_status` is reset to `null` and nothing runs again. The team stays `submitted` with an **unchecked** repo. The same thing left 4 "edge" teams with a null status in the deadline-rush run.
- **Root cause:** `app/api/team/repo/route.ts:22` clears the status. Only `submit/route.ts:52` schedules `checkTeamRepo`.
- **Proposed fix:** call `after(() => checkTeamRepo(id))` in the repo route whenever the team is already submitted (or on every save), and give the admin teams table a "re-check unchecked" filter. Effort **S**.
- **Event-day impact:** a team can submit a clean repo, then swap in an old pre-built one, and it will never be flagged.

### BP-008: The 5-attempt lockout can be raced
- **Severity:** S2 · **Area:** auth · **Check:** SEC-A01
- **Actual:** 50 parallel wrong codes against one team gave **40 evaluated guesses** (401) and only 10 rejections (429).
- **Root cause:** `app/api/team/login/route.ts:24` checks `locked_until` in a SELECT, then verifies, then updates.
- **Fix:** reserve the attempt atomically (`update … set failed_attempts = failed_attempts+1 where … and (locked_until is null or locked_until < now()) returning …`) before calling `verifyCode`. Effort **S**.
- **Impact:** the code space is 31⁶ ≈ 8.9 × 10⁸, so brute force is still impractical. This is defence in depth.

### BP-009: One person can lock every team out of login
- **Severity:** S2 · **Area:** auth / ops · **Check:** SEC-A04
- **Actual:** one client sending 5 wrong codes to each of 20 teams locked **20 of 20** teams. Team numbers are sequential (101–262), so all of them are guessable. There is no per-IP throttle.
- **Mitigation already present:** the bulk `unlock` action works. Sessions last 24 h, so teams that are already logged in are not affected.
- **Fix:** add a per-IP throttle from `login_events` (for example 20 failures per 10 min per IP). Note that a whole college shares one NAT IP, so keep it generous. Effort **S–M**.
- **Event-day runbook:** log every team in at check-in (07:00–09:00), and put "Unlock all" on the admin cheat sheet.

### BP-010: Stage-2 scores are accepted for teams that are not finalists
- **Severity:** S2 · **Area:** scoring
- **Actual:** `POST /api/admin/scores {stage:2}` for a non-finalist returned `200 imported: 1`.
- **Fix:** reject Stage-2 rows when `is_finalist = false`. Effort **S**.

### BP-011: Reviewer collaborator is not checked, and private repos can't be inspected
- **Severity:** S2 · **Area:** github · **Checks:** GH-4, SEC-E07
- **Actual:** the `noreviewer` scenario comes back `clean`. Nothing calls `/collaborators`. A **private** repo returns 404, giving `review` with the note "Repo not reachable", so the first-commit check **never runs on private repos** unless `GITHUB_TOKEN` belongs to an account that can see them.
- **Context:** the plan is "a collaborator added by our side to every team repo, so we can actually see the code". For the app to see private repos, its token must belong to that reviewer account (`ieee-synapse-reviewer`) after `scripts/accept-invites.mjs` accepts the invites. On personal-account repos, a collaborator always gets **write** access, so that token could push to every team's repo.
- **Proposed fix:** (a) use a **classic PAT of the reviewer account, `repo` scope, expiring 10 Oct**, stored only in Vercel env and revoked right after the event; (b) add a collaborator check (`GET /repos/{o}/{r}/collaborators/ieee-synapse-reviewer`) that shows "reviewer missing" as a warning, not a flag; (c) run `accept-invites.mjs` every ~15 min from 09:00 to 15:00. Effort **M**.
- **Decision needed:** yes. Private repos plus the reviewer token, or require repos to be **public** at 15:00?

### BP-012: Import accepts invalid, missing or duplicate leader emails and 5-member teams
- **Severity:** S2 · **Area:** admin / email
- **Actual (dry run):** accepted as `new`: duplicate leader email across two teams, `not-an-email`, an empty leader email (that team can never receive credentials), and a 5-member team. 300-character names are silently cut to 120.
- **Fix:** validate the email format, flag duplicate leader emails, and enforce a team size of 1–4 in `app/api/admin/import/route.ts`. Effort **S**.

### BP-013: Raw internal errors are returned to the browser
- **Severity:** S2 · **Area:** data-exposure · **Check:** SEC-E05
- **Actual:** `POST /api/admin/teams {"action":"disqualify","ids":["------------------------------------"]}` returns `500 {"error":"invalid input syntax for type uuid: …"}`. `lib/http.ts:61`, `admin/login/route.ts:36` and `admin/logs/route.ts:78` all return `err.message`. This also applies when `getAdmin()` throws for an **unauthenticated** caller (for example a DB outage message).
- **Fix:** return a generic message and keep the details in `error_logs`. Effort **S**.

### BP-014: Some admin actions leave no audit row
- **Severity:** S2 · **Area:** admin · **Invariant:** INV-11
- **Actual:** criteria edits (`PUT /api/admin/criteria`) and credential sends (`POST /api/admin/credentials`) write **no** `audit_logs` row. Separately, `/api/admin/teams` logs **before** the action runs, so failed or rejected actions are still logged as if they happened.
- **Fix:** add `CRITERIA_UPDATED` and `CREDENTIALS_EMAILED` (counts and team numbers, never codes), and log after success. Effort **S**.

### BP-015: "Delete everything" is protected only by typing DELETE
- **Severity:** S2 · **Area:** ops · **Hypothesis:** H-15 confirmed
- **Fix:** require an `ALLOW_RESET=1` env var (unset on event day) plus re-entry of the admin password. Effort **S**.
- **Decision needed:** yes. Disable reset in production from 8 Oct?

### BP-016: Same repo URL used by two teams is not detected
- **Severity:** S2 · **Area:** github · **Check:** SEC-D07
- **Fix:** show a "shared repo" warning in the admin teams table (a `group by github_repo_url having count > 1` query). Effort **S**.

### BP-017: A missing criterion silently counts as 0
- **Severity:** S2 · **Area:** scoring
- **Actual:** `lib/scoring.ts` sums only the criteria that have marks. A team with an entire criterion missing gets a lower total with no warning (`criteriaScored < 7` is returned but not shown during import).
- **Fix:** show "incomplete: N of 7 criteria" in the score-import summary and the admin leaderboard. Effort **S**.

### BP-018: Rules contradict the schedule about repo preparation
- **Severity:** S2 · **Area:** ux / github · **Hypothesis:** H-12 confirmed
- **Actual:** the schedule (`lib/event.ts:127`) says **08:30 "repo preparation"**, but the rules say the first commit must come after 09:00, and the checker flags any commit before `eventStart`. Teams that follow the schedule will be **flagged**. The guide also says judging is at 15:00 while the site says 16:00.
- **Decision needed:** yes. Change the copy to "create the repo **after** 09:00", or move the flag threshold?

### BP-019: Emailed and printed login links may point to localhost in production
- **Severity:** S1 (configuration) · **Area:** ops / email · **Hypothesis:** H-01
- **Root cause:** `siteUrl()` uses `NEXT_PUBLIC_SITE_URL`, falling back to `http://localhost:3000`. The manual reports that the live HTML has canonical and `og:image` set to `http://localhost:3000`. That means this variable is **not set in Vercel**, so the credential emails and printed chits would say `localhost:3000/team/login`. Locally, with the variable set, the link was correct (H-01 check PASS).
- **Fix:** set `NEXT_PUBLIC_SITE_URL=https://ieee-synapse-2026.vercel.app` in Vercel (Production) and **redeploy**, because `NEXT_PUBLIC_*` values are baked in at build time. No code change is needed.

### BP-020: Login wave is slow on one instance
- **Severity:** S2 · **Area:** performance · **Check:** L1
- **Actual:** 150 simultaneous logins: 100% success, **p95 2.3 s** (target < 1 s). In the deadline rush, 460 requests in 6.9 s gave 0 × 5xx and p95 3.8 s, with at most 4 DB connections.
- **Cause:** one local instance with `max: 3` DB connections queues requests. Vercel spreads load across instances, so this is likely better in production but **not verified**.
- **Fix:** none required. Stagger check-in logins by table. Optionally raise `max` to 5. **Decision:** ACCEPTED-RISK candidate.

### S3 (low / hardening)
| ID | Issue | Fix |
| :--- | :--- | :--- |
| BP-021 | CR/LF stored in team and leader names. Email is safe (nodemailer escapes, and there were no extra recipients) | Strip control characters on import |
| BP-022 | Video URL allows `http://` | Require `https:` |
| BP-023 | Submitting twice writes 2 `SUBMISSION_FINALIZED` rows | Return early if already submitted |
| BP-024 | A ~5 MB import body is accepted and imported (admin-only) | Cap the body or the name length |
| BP-025 | No CSP or `Permissions-Policy` (HSTS is added by Vercel) | Add to `next.config.ts` headers |
| BP-026 | Login responses differ for unknown team vs wrong code (enumeration) | Same message for both. Low value, since numbers are sequential |
| BP-027 | A missing README only adds a note; the status stays `clean` | Show it as a column or filter |
| BP-028 | GitHub recheck worst case: 15 teams on a hanging API ≈ 2 min per request, which can exceed the Vercel function limit | Lower to 5 teams per request, or set a 4 s timeout |
| BP-029 | `npm audit`: `source-map-js` high (build-time only) | `npm audit fix` |
| BP-030 | The catch path of `checkTeamRepo` keeps a stale `first_commit_at` | Set it to null in the catch |
