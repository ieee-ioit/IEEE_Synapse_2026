// Bulk accepts pending repository invitations for the official reviewer GitHub account.
// Usage:
//   node scripts/accept-invites.mjs
// Requires GITHUB_TOKEN set in .env.local with `repo` or `user` invitation permissions.

import postgres from "postgres";

try {
  process.loadEnvFile(".env.local");
} catch {}

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("GITHUB_TOKEN is not set in .env.local. Generate a GitHub PAT for the reviewer account.");
  process.exit(1);
}

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "ieee-synapse-accept-invites",
};

async function main() {
  console.log("Checking for pending repository invitations...");
  const res = await fetch("https://api.github.com/user/repository_invitations", { headers });

  if (!res.ok) {
    console.error(`Failed to list invitations: GitHub returned ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const invites = await res.json();
  if (!Array.isArray(invites) || invites.length === 0) {
    console.log("No pending invitations found.");
    return;
  }

  console.log(`Found ${invites.length} pending invitation(s). Accepting now...`);
  let accepted = 0;

  for (const inv of invites) {
    const invId = inv.id;
    const repoName = inv.repository?.full_name ?? `ID ${invId}`;
    try {
      const acceptRes = await fetch(`https://api.github.com/user/repository_invitations/${invId}`, {
        method: "PATCH",
        headers,
      });

      if (acceptRes.ok) {
        console.log(`✓ Accepted invitation for ${repoName}`);
        accepted++;
      } else {
        console.warn(`✗ Failed to accept for ${repoName}: ${acceptRes.status} ${acceptRes.statusText}`);
      }
    } catch (err) {
      console.warn(`✗ Error accepting ${repoName}:`, err.message);
    }
  }

  console.log(`Done! Accepted ${accepted}/${invites.length} invitations.`);
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
