# Load results (local lower bound)

**Setup:** one local `next start` instance on Windows, `TZ=UTC`, local Postgres with `max_connections=60`, app pool `max: 3`.

**Not reproduced:** Vercel cold starts, multiple instances, Supabase network latency, and the Supabase pooler.

| ID | Scenario | Result | Pass? |
| :--- | :--- | :--- | :--- |
| L1 | 150 concurrent team logins | 150 of 150 succeeded, 0 × 5xx. p50 **2149 ms**, p95 **2324 ms** | ❌ p95 target is < 1 s (BP-020) |
| L2 | Repo-save wave | covered by L3 | n/a |
| L3 | Deadline rush: 150 teams × repo + video + submit, plus 10 double submits = 460 requests in 6.9 s | 0 × 5xx, 0 wrongly rejected, p95 3761 ms, **peak DB connections 4**. 1 `SUBMISSION_FINALIZED` per team; `first_submitted_at` stable | ✅ correctness · ⚠️ latency |
| L3-edge | 8 requests spread across the deadline (−1.4 s to +1.3 s) | every request before the deadline gave 200; every one after gave 403. 150 + 50 retries after the deadline all gave 403 | ✅ INV-01 |
| L4 | Import 165 roster rows | 1386 ms | ✅ |
| L4 | Stage-1 score import (450 rows = 3150 marks, one transaction) | 284 ms (H-10 refuted) | ✅ |
| L4 | Stage-2 import (210 marks) | OK | ✅ |
| L4 | Credentials email for 161 leaders (two admins in parallel) | 8.6 s, 80 batch calls | ⚠️ duplicates (BP-005) |
| L4 | GitHub recheck of 11 teams, including one that hangs | 8.4 s; the hang ended with the 8 s timeout and status `review` | ✅ (see BP-028) |
| L5 | Reveal spike, 400 virtual users | **NOT RUN.** `/api/leaderboard` sends `s-maxage=5, stale-while-revalidate=25`, and clients ask for `?v=<signal>`, so each change is a new cache key. Toggling at the origin was immediate | partial |
| L6 | 30-minute mixed soak | **NOT RUN** | — |

## Chaos drills

| ID | Result |
| :--- | :--- |
| C3 | The mock GitHub hang, 500, 403 rate limit, 404 and 409 all ended in `review`, with no false `flagged` ✅ |
| C6 | Oversized body was accepted, not rejected with a 4xx (BP-024) ❌ |
| C7 | Ran with `TZ=UTC`: the deadline was correct and display formatting uses `Asia/Kolkata` explicitly ✅. `TZ=America/New_York` was **not run** |
| C8 | Migrations applied twice on an empty DB ✅. Applying them twice on a populated DB was **not run** |
| C1, C2, C4, C5 | **NOT RUN** |
