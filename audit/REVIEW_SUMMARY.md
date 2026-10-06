# IEEE SYNAPSE 2026: Audit Review Summary (Phase 5 gate)

**Run:** 6 Oct 2026 · **Branch:** `audit/eventday-hardening` (from `event_module`) · **Scale tested:** 150 teams + 15 poison rows

**Status: ⛔ STOPPED AT THE GATE.** No fixes have been applied. Devesh, please reply with the BP IDs you approve.

**Scope:** everything ran against a **local** production build with a throwaway Postgres DB, an SMTP sink and a mock GitHub. Nothing touched Vercel, Supabase or real GitHub.

Detail files: `BREAKPOINTS.md` (every issue) · `SECURITY_FINDINGS.md` (checklist) · `LOAD_RESULTS.md` · `BASELINE.md`

---

## 1. Headline numbers

* **63 automated checks:** 35 pass, 27 fail, 1 not tested.
* **30 break points:** 1 × S0, 7 × S1, 12 × S2, 10 × S3.

| Area | S0 | S1 | S2 | S3 |
| :--- | :-: | :-: | :-: | :-: |
| auth / data exposure | 1 | 1 | 3 | 1 |
| scoring | | 2 | 2 | |
| deadline / submissions | | 2 | | 2 |
| email | | 1 | 1 | 1 |
| github | | | 2 | 3 |
| ops / admin / perf | | 1 | 4 | 3 |

## 2. Top 10 in plain language

1. **🔴 S0: Anyone can download every team's login code without logging in (BP-001).** `curl https://<site>/admin/teams` gets a redirect, but the response body still contains the whole teams table: all codes and all leader emails. **`main` has the same code**, so if teams are already imported in production, assume the codes are exposed. The fix is tiny (one auth line per admin page). After fixing, we should regenerate the codes.
2. **Emails and chits may say `localhost:3000`** (BP-019). The live site's metadata points to localhost, which means `NEXT_PUBLIC_SITE_URL` is not set in Vercel. Set it and redeploy **before** sending the credentials email.
3. **No button to pick the Top 10 finalists** (BP-003). Today that would mean hand-editing the database at 16:00.
4. **Judge-name typos double-count a judge** (BP-004). "Dr. Rao" and "DR RAO" count as two judges, which can change the winner.
5. **Two organisers clicking "Send" at once emails most leaders twice** (BP-005). We saw 131 duplicates.
6. **Regenerating a lost code doesn't kick out whoever already used it**, and **disqualified teams can still log in** (BP-006).
7. **A team can swap its repo after submitting, and it is never re-checked** (BP-007).
8. **The video link can be saved before 13:00.** Only the button is hidden (BP-002).
9. **One person can lock all 150 teams out of login** with 5 wrong tries each (BP-009). Workaround: get every team logged in at check-in, and use "Unlock".
10. **The schedule says "08:30 repo preparation" but the rules flag any commit before 09:00** (BP-018). Teams that follow the schedule will be flagged.

## 3. All break points

| ID | Sev | Impact (one line) | Proposed fix | Effort | Decision needed |
| :--- | :-: | :--- | :--- | :-: | :--- |
| BP-001 | **S0** | All codes and emails readable without a login | `requireAdmin()` at the top of every `(panel)` page | S | **Regenerate all codes after the fix?** |
| BP-002 | S1 | Video accepted before 13:00 | Server check against a `videoUnlockAt` setting | S | |
| BP-003 | S1 | No way to select finalists | `set-finalists` admin action (exactly 10, audited) | M | **Auto Top 10, or judges pick?** |
| BP-004 | S1 | Judge typos skew averages | Normalise judge names; list judges in the dry run | S | |
| BP-005 | S1 | Duplicate credential emails | Claim rows atomically (`SKIP LOCKED`) | S | |
| BP-006 | S1 | Old sessions survive regenerate; DQ teams can log in | Code fingerprint in the JWT; block DQ login | S | |
| BP-007 | S1 | Repo swap after submit is unchecked | Re-run the GitHub check on every repo save | S | |
| BP-019 | S1 | Login links say localhost | Set `NEXT_PUBLIC_SITE_URL` in Vercel and redeploy | config | |
| BP-008 | S2 | Lockout can be raced (40 of 50 guesses) | Atomic attempt counter | S | |
| BP-009 | S2 | Anyone can lock out every team | Per-IP throttle + runbook | S–M | |
| BP-010 | S2 | Stage-2 scores accepted for non-finalists | Reject them | S | |
| BP-011 | S2 | Reviewer not checked; private repos invisible to the checker | Collaborator check + reviewer token plan | M | **Private + reviewer token, or public at 15:00?** |
| BP-012 | S2 | Bad, missing or duplicate emails and 5-member teams imported | Import validation | S | |
| BP-013 | S2 | Raw DB errors shown to clients | Generic error messages | S | |
| BP-014 | S2 | Criteria edits and email sends not audited | Add audit rows | S | |
| BP-015 | S2 | "Delete everything" only needs the word DELETE | `ALLOW_RESET` flag + password | S | **Disable reset in prod from 8 Oct?** |
| BP-016 | S2 | Shared repo between teams not flagged | Warning in the teams table | S | |
| BP-017 | S2 | Missing criterion silently counts as 0 | "Incomplete" warning | S | |
| BP-018 | S2 | 08:30 repo prep vs 09:00 rule | Fix the schedule copy | S | **Which rule wins?** |
| BP-020 | S2 | Login p95 2.3 s on one instance | Stagger check-in (accept risk) | — | Accept? |
| BP-021…030 | S3 | Hardening items (see `BREAKPOINTS.md`) | — | S each | |

## 4. Invariants

| INV | Result | INV | Result |
| :-- | :-- | :-- | :-- |
| 01 deadline (server clock) | ✅ PASS | 09 Stage 2 + tie-break | ✅ PASS (once finalists are set via SQL) |
| 02 video unlock enforced by server | ❌ FAIL | 10 DQ excluded | ⚠️ PARTIAL: excluded from ranks and writes, but can log in |
| 03 `first_submitted_at` immutable | ✅ PASS | 11 every admin mutation audited | ❌ FAIL (criteria, email) |
| 04 non-finalists hidden | ✅ PASS (API + HTML) | 12 regenerate kills sessions | ❌ FAIL |
| 05 hidden means nothing exposed | ✅ PASS | 13 admin routes reject bad cookies | ❌ FAIL on pages (APIs PASS) |
| 06 team identity from session only | ✅ PASS | 14 one email per team | ❌ FAIL with concurrent sends |
| 07 codes never leaked | ❌ FAIL (BP-001); ✅ in logs | 15 IST regardless of TZ | ✅ PASS with `TZ=UTC`; New York not run |
| 08 weights = 100, deterministic | ✅ PASS | | |

**Hypotheses refuted (good news):**
* H-02: rank count is dynamic.
* H-04: the mailer exists.
* H-05: admin login is rate-limited.
* H-06: RLS is on every table and anon can read none of them.
* H-07: no payloads go into `error_logs`.
* H-08: the API toggle is immediate.
* H-10: 3150 marks import in 0.3 s.
* H-13: `prepare:false` is set.
* H-14: Next 15.5.26 / React 19.3.0 are patched.

## 5. Load and chaos

* Deadline rush: 460 requests in 6.9 s gave **0 errors**, with the deadline exact to the request.
* Login wave: p95 2.3 s locally.
* GitHub failures never produce false flags.

Full numbers are in `LOAD_RESULTS.md`.

## 6. Not tested (and why)

* **Docker, Mailpit and the Playwright XSS browser run**: Docker isn't installed. I used a real Postgres binary and an SMTP sink instead, and reviewed XSS statically.
* **L5 reveal spike with 400 users, L6 30-minute soak, and chaos C1, C2, C4, C5**: time. Each one needs its own run.
* **`TZ=America/New_York`**, **two admins saving settings at once**, **migrations on a populated DB**.
* **Anything on production**: not allowed by the rules. BP-001 and BP-019 are inferred from shared code and the manual's observation of the live site. They have not been checked live.
* **Real Vercel/Supabase limits**: local numbers are a lower bound.

## 7. Recommended fix order

1. **Today:** BP-001 (+ decide on regenerating codes) and BP-019 (env var only).
2. **Before emailing credentials:** BP-005, BP-012, BP-006.
3. **Before 9 Oct:** BP-003, BP-004, BP-007, BP-002, BP-010, BP-015, BP-018 copy, BP-011 decision.
4. **If there's time:** BP-008, BP-009, BP-013, BP-014, BP-016, BP-017, then the S3 items.

Proposed approval list: **BP-001 … BP-019 (all S0/S1/S2 except BP-020)**. BP-020: accept the risk.

---

## Answers to the team's questions

**Who gets the credentials email?** Only the **team leader**. That is already how the code works (`leader_email`). Members don't get it. That's fine, as long as leaders know to share the code (the email says "Only share this code with your teammates").

**"We'll add our own collaborator to each team repo so we can see the code."** That works for humans browsing the repos. Two things to know:

1. **The app's automatic first-commit check can't see private repos** unless the app's `GITHUB_TOKEN` belongs to that reviewer account (after `scripts/accept-invites.mjs` accepts the invites). Otherwise every private repo shows "Repo not reachable", is never flagged, and is never cleared.
2. On personal GitHub repos, a collaborator always gets **write** access. So that token could push to all 150 repos. Use a classic PAT that **expires 10 Oct**, keep it only in Vercel env, and revoke it after the event.
3. The app does **not** currently check that the reviewer was added (BP-011).
4. Tell teams to **create the repo after 09:00**. The current schedule says 08:30 (BP-018).

**Will this work on the free plans of Vercel and Supabase?** **Yes for 150 teams, with caveats.** These are the plan limits as I know them; check the current pricing pages before relying on exact numbers.

* **Vercel Hobby:** traffic is tiny compared with the free quotas, and the cron (every 2 days) fits the Hobby once-a-day limit.
  * ⚠️ Hobby is officially for **non-commercial personal** use. A college IEEE event is usually fine, but registration is paid (via Unstop), so make that call consciously. Pro trial is the fallback.
  * ⚠️ Function time limits: keep the GitHub "re-check" to small batches (BP-028).
* **Supabase Free:** the 500 MB DB is more than enough, RLS is correct, and the keep-alive cron prevents the 7-day pause.
  * ⚠️ **No downloadable backups** on Free. Take a `pg_dump` the night before and again right after 15:00.
  * ⚠️ **Realtime has a concurrent-connection cap** (about 200). At the 17:30 reveal, extra viewers automatically fall back to 30 s polling, which the code already handles. So it's slower, not broken.
  * ⚠️ Use the **transaction pooler (port 6543)** connection string in Vercel. The code is already configured for it.
* **Email:** Gmail SMTP with an app password allows about 500 a day, which covers 150 leaders. Send the night before, once, from **one** admin (BP-005).

Bottom line: the free tiers are fine. The real risks are the bugs above, not the plans.
