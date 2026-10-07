// Which team repos has the reviewer account been given access to?
// Run locally by an organizer; never deploy the reviewer's token.
//
// Usage:
//   REVIEWER_GITHUB_TOKEN=<reviewer account token> node scripts/reviewer-access-report.mjs teams.xlsx [out.csv]
//
// Input: the admin "Export .xlsx" from /admin/teams (or a CSV with "Team Number" and "Repo" columns).
// Output: CSV with team_number, repo, access — ok (reviewer can push/maintain), pending (invitation
// not yet accepted: run scripts/accept-invites.mjs), missing (no access, no invitation), no-repo, error.
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

const [input, out = "reviewer-access.csv"] = process.argv.slice(2);
const token = process.env.REVIEWER_GITHUB_TOKEN;
if (!input || !token) {
  console.error("Usage: REVIEWER_GITHUB_TOKEN=... node scripts/reviewer-access-report.mjs <teams.xlsx|csv> [out.csv]");
  process.exit(1);
}
const API = (process.env.GITHUB_API_BASE_URL || "https://api.github.com").replace(/\/$/, "");
const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "ieee-synapse-reviewer-report",
};
const get = (path) => fetch(API + path, { headers, signal: AbortSignal.timeout(10_000) });

const book = XLSX.read(readFileSync(input), { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: "" });
const pick = (row, ...names) => {
  const key = Object.keys(row).find((k) => names.includes(k.trim().toLowerCase()));
  return key ? String(row[key]).trim() : "";
};

// Pending invitations for the reviewer account (paged).
const pending = new Set();
for (let page = 1; page < 50; page++) {
  const res = await get(`/user/repository_invitations?per_page=100&page=${page}`);
  if (!res.ok) {
    console.error(`Could not list invitations: GitHub ${res.status}. Check the token.`);
    process.exit(1);
  }
  const list = await res.json();
  for (const inv of list) if (inv.repository?.full_name) pending.add(inv.repository.full_name.toLowerCase());
  if (list.length < 100) break;
}

const report = [["team_number", "repo", "access"]];
const counts = {};
for (const row of rows) {
  const team = pick(row, "team number", "team_number", "team #", "#");
  const repo = pick(row, "repo", "repo url", "github repo", "repository");
  const m = repo.match(/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?(?:[/?#].*)?$/i);
  let access = "no-repo";
  if (m) {
    const full = `${m[1]}/${m[2]}`;
    try {
      const res = await get(`/repos/${full}`);
      const perms = res.ok ? (await res.json()).permissions ?? {} : {};
      access = perms.push || perms.maintain || perms.admin ? "ok" : pending.has(full.toLowerCase()) ? "pending" : res.ok || res.status === 404 ? "missing" : "error";
    } catch {
      access = "error";
    }
  }
  counts[access] = (counts[access] ?? 0) + 1;
  report.push([team, repo, access]);
}

const csv = report.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n") + "\n";
writeFileSync(out, csv);
console.log(`Wrote ${out}:`, counts);
