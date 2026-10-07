# Event-day runbook: IEEE SYNAPSE 2026, 9 Oct (printable)

**Freeze:** no deploys on 9 Oct except an emergency rollback.

**Owners:** fill in the names below.

## Roles
| Role | Who | Watches |
| :--- | :--- | :--- |
| Check-in desk | | Team logins, lost chits (Teams → New login code), **Unlock all logins** |
| Logs | | `/admin/logs`: error references ("Reference: xxxxxxxx") from teams |
| Scores | | Score import (dry run first; read the judge list and warnings) |
| Reveal | | Leaderboard tab: Finalists, then Visibility |
| GitHub reviewer | | `accept-invites.mjs` every 15 min; reviewer-access report |

## Timeline (IST)
| Time | Action |
| :--- | :--- |
| 07:00 | Check-in opens. **Stagger logins by table** (BP-020: a cold burst is slower). Every team logs in on its own laptop; sessions last 24 h. |
| 07:00–09:00 | Lost chit: Teams → team → **New login code**. This ends the old sessions. Read the new code aloud. |
| 08:30 | Briefing: **create the GitHub repo only after 09:00**, add the reviewer collaborator, commit often. |
| 09:00 | Build window opens. Run `accept-invites.mjs` every 15 minutes. |
| 13:00 | Demo video links open (the server enforces it). If the schedule slips: Overview → Settings → "Demo video links open at" (the change is audit-logged). |
| 14:50 | Remind teams: deadline 15:00:00, server clock. Re-saving is allowed until then. |
| 15:00 | Submissions close (403 after). Teams → filter **"GitHub: unchecked"** → **Re-check unchecked** (5 per request). |
| 15:00–16:00 | Stage 1 marks → template → Scores → **dry run**. Check the judge list, near-duplicate warnings and "incomplete" rows. Then import. |
| ~16:00 | Leaderboard → **Stage 2 finalists**: review the suggested top 10, swap if needed, tick the confirmations, **Confirm finalists**. Ties at the cut-off need a manual choice. |
| Live demos | Stage 2 marks (finalists only; others are rejected) → import. Finalists lock once Stage 2 scores exist. |
| 17:30 | Leaderboard → Visibility → publish. Check `/leaderboard` in a private window. |

## If something goes wrong
* **Every team suddenly locked out** (someone spamming codes): Teams → **Unlock all logins**. Locks are per team *and network*. Someone on the venue Wi-Fi can still lock venue teams, so repeat as needed and find the device in `/admin/logs`.
* **Site down at 14:55:** collect repo and video links by Google Form or email; Devesh decides on a deadline extension (Settings → deadline).
* **Email down:** chits are the primary channel; read codes from Teams → "Show codes".
* **GitHub API down or rate-limited:** repos show `unchecked`, never flagged. Re-check after the event.
* **DB down:** keep scores on paper; restore from last night's backup.
* **Wrong reveal:** Leaderboard → Visibility → hide it immediately (takes effect within seconds).
* **Bad deploy:** Vercel → Deployments → previous → **Instant rollback**.

## Never on event day
* Reset or "delete everything". It's disabled unless `ALLOW_RESET=1` is set, and it must stay unset in production.
* Putting the reviewer account's GitHub token into Vercel.
