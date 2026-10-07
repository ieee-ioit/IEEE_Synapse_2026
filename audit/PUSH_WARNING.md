# Before pushing the audit branch

**`ieee-ioit/IEEE_Synapse_2026` is a public repo.** GitHub serves it to anyone without a login (checked 6 Oct 2026).

The audit branch includes `audit/BREAKPOINTS.md`, which gives step-by-step instructions for the unfixed login-code leak (**BP-001**). Pushing it now would publish how to grab every team's code three days before the event.

## Safer options

1. **Share `audit/REVIEW_SUMMARY.md` on Discord directly.** That is what was asked for. Keep the branch local until BP-001 is fixed and deployed.
2. **Push only after the BP-001 fix is live on Vercel.** Claude can make that fix as soon as Devesh approves it.
3. **If the team needs the code right away,** make the repo private first (GitHub → Settings → Danger Zone → Change visibility), then push.
