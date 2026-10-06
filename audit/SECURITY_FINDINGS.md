# Security checklist (Phase 3)

How to read this table:
* **Static** means I read the code.
* **Dynamic** means I sent a real request to the local build.
* **BP** links to the matching entry in `BREAKPOINTS.md`.

| ID | Check | Result | How / evidence | BP |
| :--- | :--- | :--- | :--- | :--- |
| SEC-A01 | Lockout race (50 parallel wrong codes) | **FAIL** | dynamic: 40 guesses evaluated | 008 |
| SEC-A02 | Normalising input variants | PASS | static: `normalizeCode()` upper-cases, strips non-alphanumerics and the prefix; the counter is per team, not per input | |
| SEC-A03 | Enumeration (unknown team vs wrong code) | **FAIL** (low) | dynamic: different messages | 026 |
| SEC-A04 | Lockout abuse / per-IP throttle | **FAIL** | dynamic: 20 of 20 teams locked from one client | 009 |
| SEC-A05 | Code entropy | PASS | static: `crypto.randomInt`, 31-symbol alphabet, 6 characters, no modulo bias | |
| SEC-A06 | Cookie flags | PASS | dynamic: `HttpOnly; SameSite=lax; Path=/`; `Secure` when `NODE_ENV=production` | |
| SEC-A07 | Secret handling | PASS / ⚠️ | static: HS256 verified by `jose`, throws if the secret is under 32 characters, no fallback. ⚠️ The guide prints real-looking example secrets; production must not use them (not verifiable from here) | |
| SEC-A08 | Session invalidation | **FAIL** | dynamic: old cookie still works after regenerate; a DQ team can log in | 006 |
| SEC-A09 | Admin login | PASS | static + dynamic: 8 failures / 15 min per email, bcrypt cost 12, same error message, dummy hash keeps timing equal. No per-IP limit | |
| SEC-A10 | Team cookie cannot reach admin routes | PASS | dynamic: a team cookie on all `/api/admin/*` × 4 methods gives 401 | |
| SEC-B01 | Admin APIs reject unauthenticated calls | PASS | dynamic: 8 routes × 4 methods × 3 cookie types, all 401/405 | |
| SEC-B02 | Team identity only from session | PASS | static: every team route uses `session.teamId`; the body has no id fields | |
| SEC-B03 | Public endpoints have no PII | PASS | dynamic: `/api/leaderboard` has no emails, UUIDs or codes. `/api/health` only says up/down | |
| SEC-B04 | `/admin/print` admin-only | PASS | dynamic: in-page check, 307 with no data | |
| SEC-B05 | Auth enforced in the page, not just the layout | **FAIL (S0)** | dynamic: `/admin/teams` and `/admin/send-credentials` leak every code and email | 001 |
| SEC-B06 | `no-store` on private pages | PASS | `next.config.ts` headers; API helpers set `no-store` | |
| SEC-C01 | Origin bypasses | PASS | dynamic: evil, suffix-spoof, `null` and other-port all give 400. A missing Origin is allowed, but JSON content type is still required (OK) | |
| SEC-C02 | Content-type enforcement | PASS | dynamic: `text/plain` and form bodies give 400 | |
| SEC-C03 | No state change on GET | PASS | static: every mutation is POST or PUT | |
| SEC-C04 | Body size | **FAIL** (low) | dynamic: a 5 MB import was accepted in 205 ms | 024 |
| SEC-C05 | Mass assignment | PASS | static: the settings keys and team `action` are allow-listed | |
| SEC-D01 | Repo URL / SSRF | PASS | dynamic: 9 payloads. The parser rebuilds `https://github.com/{owner}/{repo}` from a strict regex | |
| SEC-D02 | Video host allow-list | PASS / **low** | dynamic: lookalikes, `@`, `javascript:` and `data:` rejected. `http://` accepted | 022 |
| SEC-D03 | Stored XSS | PASS (static) | React escapes everything; the only `dangerouslySetInnerHTML` is a constant style string; the logs viewer uses `<pre>{JSON.stringify}</pre>`; the email HTML is escaped (dynamic PASS). The Playwright run was **not done** | |
| SEC-D04 | Safe external links | PASS | static: `rel="noopener noreferrer"` everywhere; URLs are allow-listed before they are stored | |
| SEC-D05 | SQL injection | PASS | static: every query is a tagged template. `sql.unsafe` appears only in `db-setup.mjs` on local files. Logs search is parameterised | |
| SEC-D06 | Formula injection on export | PASS (static) | `.xlsx` export via SheetJS writes strings as string cells, not formulas | |
| SEC-D07 | Duplicate repo across teams | **FAIL** | dynamic: accepted silently | 016 |
| SEC-E01 | Secrets in repo or bundle | PASS | history and `.next/static` scanned | |
| SEC-E02 | `logError` redaction | PASS | static: callers pass no request payload; only message, stack, IP and UA are stored | |
| SEC-E03 | No codes in `audit_logs` | PASS | dynamic: regex `SYN-XXXXXX` over audit and error logs found 0 | |
| SEC-E04 | AES-GCM | PASS | static: random 12-byte IV, auth tag checked, HKDF with separate `hash` / `encrypt` labels. **Accepted trade-off:** someone with both the DB and `CODE_SECRET` gets every code | |
| SEC-E05 | No internal errors to clients | **FAIL** | dynamic: a raw Postgres message was returned | 013 |
| SEC-E06 | Error-log flooding | PARTIAL | the team routes log only on 500s; no cap or rate limit on `error_logs` | |
| SEC-E07 | GitHub token separation | **DECISION** | private repos need the reviewer token in the app | 011 |
| SEC-F01 | RLS on every table | PASS | dynamic: all 10 tables have `relrowsecurity = t`; `anon` can SELECT only `live_signals` (H-06 refuted) | |
| SEC-F02 | Pooler compatibility | PASS | `prepare: false`, `max: 3` (H-13 refuted) | |
| SEC-F03 | Unique constraints | PASS / note | `team_number`, `lower(name)` and `(team_id, criterion_id, judge, stage)` exist. Nothing makes `stage2_order` unique | |
| SEC-F04 | Transactions | PASS (static) | import, score import with `replaceAll`, reset and criteria edits each run in a transaction. Killing a request mid-way was **not tested** | |
| SEC-F05 | Reset protection | **FAIL** | static: only `confirm === "DELETE"` | 015 |
| SEC-G01 | Security headers | PARTIAL | nosniff, `DENY` and referrer present; CSP and `Permissions-Policy` missing | 025 |
| SEC-G02 | Next / React patch level | PASS* | 15.5.26 and 19.3.0 are newer than the 2025 advisories. *No online advisory lookup was done | 029 |
| SEC-G03 | Lockfile and dependencies | PASS | lockfile committed; `@supabase/supabase-js` is used only for Realtime | |
| SEC-H01 | Deadline boundary | PASS | dynamic: requests at −251 ms gave 200; at +148 ms gave 403 (`TZ=UTC`) | |
| SEC-H02 | Edit after final submit | **FAIL** | dynamic: a repo swap after submit is never re-checked; double submit writes 2 audit rows | 007, 023 |
| SEC-H03 | `first_submitted_at` under concurrency | PASS | dynamic: 20 parallel saves left the value unchanged | |
| SEC-H04 | DQ and reinstate | PARTIAL | writes blocked (403), but login is allowed | 006 |
| SEC-H05 | Two admins changing settings at once | NOT TESTED | last write wins (static); each write is audited | |
| SEC-H06 | Forgeable commit dates | CONFIRMED LIMITATION | the checker uses the earlier of author and committer date. Old code re-dated to 09:30 passes as `clean`. It does not use repo `created_at` or `pushed_at` | 011 |
