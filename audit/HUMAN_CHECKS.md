# Human checks (Devesh / team)

Claude doesn't push, deploy or touch production. These steps are yours.

## Batch 0 (BP-001), in order
1. **Push the branch and open a PR into `main`.** The commands are in Claude's chat message.
2. **Merge the PR.** Vercel auto-deploys `main`. Wait until the deployment shows "Ready".
3. **Verify on production.** Each command must print `0`:
   ```
   curl -s https://ieee-synapse-2026.vercel.app/admin/teams | grep -o 'SYN-[A-Z0-9]\{6\}' | sort -u | wc -l
   curl -s https://ieee-synapse-2026.vercel.app/admin/send-credentials | grep -o '@[A-Za-z0-9.-]*\.[a-z]\{2,\}' | wc -l
   curl -s https://ieee-synapse-2026.vercel.app/admin/scores | grep -o 'SYN-[A-Z0-9]\{6\}' | wc -l
   curl -s -H "RSC: 1" https://ieee-synapse-2026.vercel.app/admin/teams | grep -o 'SYN-[A-Z0-9]\{6\}' | wc -l
   ```
   (`/admin/logs` doesn't exist on `main` yet.) Then log in at `/admin/login` and confirm the Teams tab still shows the table.
4. **Tell Claude the result.** Claude then merges `main` into `event_module` (keeping the stronger guard) and starts Batch 1.

## Later (from FIX_ORDERS §5, filled in as batches land)
- [ ] Set `NEXT_PUBLIC_SITE_URL` in Vercel Production and redeploy (BP-019)
- [ ] Run the RLS query in the Supabase SQL editor; confirm `DATABASE_URL` uses the pooler on port 6543
- [ ] Production secrets are random, ≥ 32 characters, not the doc examples; `ALLOW_RESET` is unset
- [ ] Back up the production DB before migrations and before the event
