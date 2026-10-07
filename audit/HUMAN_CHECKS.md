# Human checks (Devesh / team)

Claude doesn't push, deploy or touch production. These steps are yours. The commands are in Claude's chat messages.

## A. Batch 0 (BP-001) → `main` (do this first)
1. Push `fix/admin-auth`, open a PR into `main`, merge it, and wait for Vercel to show "Ready".
2. Each command must print `0`:
   ```
   curl -s https://ieee-synapse-2026.vercel.app/admin/teams | grep -o 'SYN-[A-Z0-9]\{6\}' | sort -u | wc -l
   curl -s https://ieee-synapse-2026.vercel.app/admin/send-credentials | grep -o '@[A-Za-z0-9.-]*\.[a-z]\{2,\}' | wc -l
   curl -s -H "RSC: 1" https://ieee-synapse-2026.vercel.app/admin/teams | grep -o 'SYN-[A-Z0-9]\{6\}' | wc -l
   ```
3. Log in at `/admin/login`. The Teams tab still works.

## B. Before Release A (`event_module` → `main`)
1. **Vercel Production environment variables:**
   * `NEXT_PUBLIC_SITE_URL=https://ieee-synapse-2026.vercel.app` (BP-019). Changing it requires a **redeploy**.
   * `SESSION_SECRET` and `CODE_SECRET`: random, ≥ 32 characters, different from each other and from any example in the docs.
   * `DATABASE_URL`: the Supabase **transaction pooler, port 6543**.
   * `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.
   * `GITHUB_TOKEN`: **read-only** (fine-grained, public repositories, read-only; no write scopes). **Never** the reviewer account's token (BP-011).
   * `ALLOW_RESET`: **unset** (BP-015).
   * `GITHUB_API_BASE_URL`: **unset** (test-only).
2. **Supabase:** take a backup or `pg_dump` **before** applying migrations.
3. **Apply migrations** `004`–`007` (all additive). With `DATABASE_URL` pointing at production, run `npm run db:setup` from the `event_module` checkout, or paste each file into the SQL editor in order.
4. **Supabase SQL editor:** `SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r';` must show `true` for every table, including the new `team_login_locks`.
5. **Staging rehearsal (FIX_ORDERS §2b):** a Vercel Preview of `event_module` against a **separate Supabase staging project**. Smoke test, plus a short, modest load test.
6. Merge `event_module` → `main`. Then smoke test: `/api/health`, admin login, every admin tab, one team login on staging data.

## C. Event prep (8 Oct)
1. Import the roster: **dry run first**, then for real. Check the counts against the Unstop export. Invalid rows now show a reason; fix them in the CSV and re-import.
2. Send **three test credential emails** to real inboxes (Gmail, Outlook, college mail) before the bulk send. Send in bulk from **one** admin.
3. Print the chits. The printed chits are the primary channel.
4. Settings: confirm start `09:00`, deadline `15:00`, **video unlock `13:00`**, **finalists `10`**, and optionally the expected judges.
5. Back up the database again the night before.
6. **Reviewer access (BP-011):**
   * Run `scripts/accept-invites.mjs` every ~15 minutes between 09:00 and 15:00.
   * Use `scripts/reviewer-access-report.mjs` with the teams export to see who still hasn't added the reviewer.
   * Keep the reviewer token on the organizer laptop only.

## Open decisions for Devesh
* **BP-018:** what time does judging start? The site says 04:00 PM; the guide says 15:00–17:30. Nothing changed until you answer.
* **BP-031 (S1):** approve the one-line tie-break fix? Without it, an exact podium tie can be decided by floating-point noise instead of the earliest submission.
* **BP-032 (S3):** approve the audit-details encoding fix?
