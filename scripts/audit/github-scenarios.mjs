// Re-checks one team per mock-GitHub scenario with the real event start (09:00 IST, 9 Oct).
import { BASE_URL, DATABASE_URL } from "./assert-safe-env.mjs";
import postgres from "postgres";
const sql = postgres(DATABASE_URL, { onnotice: () => {} });
const login = await fetch(BASE_URL + "/api/admin/login", { method: "POST", headers: { "content-type": "application/json", origin: BASE_URL }, body: JSON.stringify({ email: process.env.AUDIT_ADMIN1_EMAIL, password: process.env.AUDIT_ADMIN1_PASSWORD }) });
const cookie = login.headers.getSetCookie()[0].split(";")[0];
const api = (path, body, method = "POST") => fetch(BASE_URL + path, { method, headers: { "content-type": "application/json", origin: BASE_URL, cookie }, body: JSON.stringify(body) }).then((r) => r.json());
await api("/api/admin/settings", { eventStart: "2026-10-09T09:00:00+05:30", submissionDeadline: "2026-10-09T15:00:00+05:30" }, "PUT");
const scen = ["clean", "early", "noreadme", "noreviewer", "private", "ratelimited", "server-500", "server-hang", "empty", "huge", "forged"];
const teams = await sql`select id from teams order by team_number limit ${scen.length}`;
for (const [i, t] of teams.entries()) await sql`update teams set github_repo_url = ${`https://github.com/audit/${scen[i]}-repo`} where id = ${t.id}`;
const t0 = Date.now();
await api("/api/admin/teams", { action: "recheck-github", ids: teams.map((t) => t.id) });
const ms = Date.now() - t0;
const rows = await sql`select github_repo_url, github_status, first_commit_at, github_note from teams where id in ${sql(teams.map((t) => t.id))}`;
for (const r of rows) console.log(r.github_repo_url.split("/").pop().padEnd(20), String(r.github_status).padEnd(8), r.first_commit_at?.toISOString() ?? "-", "|", r.github_note);
console.log(`recheck of ${teams.length} teams took ${ms} ms`);
await sql.end();
