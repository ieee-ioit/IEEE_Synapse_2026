# Event-day review and hardening: summary

**Dates:** reviewed 6 Oct 2026; fixes 7 Oct 2026, on `event_module`.

This is a public summary. Detailed reproduction notes are kept privately by the organizers.

## How it was reviewed
* The code was read route by route.
* A **local** production build was tested against a throwaway database, a mail catcher and a mock GitHub API, using 150 mock teams and deliberately malformed data.
* The tests cover login, admin access, submissions around the deadline, email sending, GitHub checks, scoring and the results reveal.
* No production systems were tested.
* Each fix comes with an automated regression test. The test failed before the fix and passes after it.

## What changed

### Access and sessions
* Admin pages check the admin session themselves, not only in the shared layout.
* A team's session ends when its login code is regenerated or the team is disqualified. Disqualified teams can't log in.
* Wrong-code lockouts apply per team and network, with a per-team cap across networks. Organizers have "Unlock all logins".
* Parallel wrong-code attempts can't exceed the attempt limit.
* An unknown team number and a wrong code get the same response.
* Error responses give a generic message with a reference ID; details are logged for organizers only.

### Submissions
* Demo video links open at a server-enforced time (setting, default 13:00 IST).
* Repo and video links must use https.
* Submitting twice is a no-op.
* A repo changed after submitting is re-checked automatically.
* GitHub checks time out quickly and run in small batches. A repo that can't be read is marked "unchecked" (never "flagged"), and organizers can re-check it later.
* The teams table flags repos shared between teams and missing READMEs.

### Roster import and email
* Rows with missing, invalid or duplicate leader emails, more than 4 members, or overlong names are rejected with a reason.
* Control characters are stripped from imported text.
* Request bodies are size-limited.
* Credential emails are claimed atomically, so two organizers sending at once can't email a leader twice.
* Sending is blocked if production login links would point to localhost.

### Scoring and results
* Judge names are matched regardless of case and punctuation. The import preview lists the judges and warns about near-duplicates and incomplete marks.
* Stage 2 marks are accepted for finalists only.
* Organizers choose the Stage 2 finalists in the admin panel. The panel suggests the Stage 1 top N, allows swaps, and asks for confirmation on ties and incomplete marks. The selection locks once Stage 2 scoring starts.
* The scoring formula and weights are unchanged.

### Operations
* "Delete all data" now requires an environment flag (off in production), the admin's password, and typing DELETE.
* Criteria edits and credential emails are written to the audit log, and team actions are logged only after they succeed.
* Added a `Permissions-Policy` header and a report-only `Content-Security-Policy`.
* Next.js updated to 15.5.27; `npm audit` reports 0 vulnerabilities.
* The schedule now says to create the GitHub repo after 09:00, matching the first-commit rule.

## Known limitations
* The first-commit check relies on commit dates, which a participant can set. Organizers should still review flagged and suspicious repos by hand.
* Someone on the same network as the teams (for example the venue Wi-Fi) can still trigger lockouts for teams on that network. Organizers can clear them with "Unlock all logins".
* Load figures come from a single local server. Production behaviour on Vercel and Supabase wasn't load-tested.
