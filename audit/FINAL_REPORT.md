# Final report: IEEE SYNAPSE 2026 event-day audit

**Date:** 7 Oct 2026, the evening before the freeze.

**Scope:** BP-001 to BP-032. Approval came from `FIX_ORDERS.md`, plus BP-031 and BP-032 in chat.

## Before → after
| | 6 Oct (audit) | 7 Oct (after fixes) |
| :--- | :--- | :--- |
| Full event-day run | 35 PASS / 27 FAIL | 62 PASS / 0 FAIL / 1 accepted risk / 1 N/A, **twice in a row** |
| Login codes readable without login | **Yes (S0)** | No (360-probe test) |
| Duplicate credential emails (2 admins) | 131 | 0 (157 of 157 delivered) |
| Parallel wrong-code guesses evaluated | 40 of 50 | ≤ 5 |
| Teams one person can lock out | All of them | Only teams on the attacker's own network |
| Video before 13:00 | Accepted | 403 |
| Finalist selection | SQL by hand | Admin panel, audited |
| Judge typo double-counting | Yes | No |
| Tie at the podium | Float noise could decide it | Earliest submission decides |
| `npm audit` (production dependencies) | 1 high | 0 |

## Residual risks
* **Same-network lockout (BP-009):** someone on the venue Wi-Fi can still lock venue teams. Mitigation: "Unlock all logins".
* **Forgeable commit dates (H-09):** the first-commit check can be fooled. Review flagged and suspicious repos by hand.
* **Load:** check-in login p95 was 1.2–2.4 s on one laptop instance (BP-020, accepted). The deadline rush had 0 errors, but p95 reached 9.6 s once when the machine was busy. Vercel and Supabase weren't load-tested.
* **Production state:** `main` already has the code (PR #3), but production **needs migrations 001–007 and `NEXT_PUBLIC_SITE_URL`** before team login and the admin Teams page work. See `HUMAN_CHECKS.md`.
* **The audit branch was briefly public on GitHub.** Delete it, and assume the notes in it were seen.

## Not tested
Playwright (real browser) XSS, the 400-user reveal spike, the 30-minute soak, DB-pause and mail-outage drills, `TZ=America/New_York`, anything on production or staging.

## Open
* BP-018 judging time (Devesh).
* The FIX_ORDERS §2b staging rehearsal (skipped when PR #3 was merged).
