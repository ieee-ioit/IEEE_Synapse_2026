import postgres from "postgres";
import * as XLSX from "xlsx";
import { writeFileSync } from "fs";

try { process.loadEnvFile(".env"); } catch {}
try { process.loadEnvFile(".env.local"); } catch {}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not found in environment (.env or .env.local)");
  process.exit(1);
}

const sql = postgres(url, {
  prepare: false,
  ssl: /supabase\.(co|com)/.test(url) && !/sslmode=/.test(url) ? "require" : undefined,
});

const reviewers = [
  "Keshav-137",
  "nibble007",
  "Dev-43",
  "Sharvil1509",
  "JunedH09",
  "Keya-Nagar25",
  "samikshachingunde576-netizen",
  "AdityaSurse",
  "introvolentvow77",
  "harshalarmorikar121-cloud",
];

const teamNumberStart = 101;

function reviewerFor(teamNumber) {
  const i = (((teamNumber - teamNumberStart) % reviewers.length) + reviewers.length) % reviewers.length;
  return { username: reviewers[i], url: `https://github.com/${reviewers[i]}` };
}

async function main() {
  const teams = await sql`
    select 
      t.id, 
      t.team_number, 
      t.name as team_name, 
      t.leader_name, 
      t.leader_email, 
      t.college,
      t.github_repo_url,
      t.demo_video_url,
      t.submission_status,
      t.credentials_sent_at,
      coalesce(
        (select json_agg(json_build_object('name', m.name, 'email', m.email)) from members m where m.team_id = t.id),
        '[]'::json
      ) as members
    from teams t
    order by t.team_number asc
  `;

  console.log(`Fetched ${teams.length} teams from database.`);

  const masterRows = [];
  const collaboratorGroups = {};
  reviewers.forEach((r) => {
    collaboratorGroups[r] = [];
  });

  for (const t of teams) {
    const rev = reviewerFor(t.team_number);
    const membersList = (t.members || []).map(m => m.name).filter(Boolean).join(", ");

    const row = {
      "Team #": t.team_number,
      "Team Code": `SYN-${t.team_number}`,
      "Team Name": t.team_name,
      "Assigned Collaborator": rev.username,
      "Collaborator GitHub URL": rev.url,
      "Leader Name": t.leader_name || "",
      "Leader Email": t.leader_email || "",
      "College": t.college || "",
      "Team Members": membersList || "Solo",
      "Submission Status": t.submission_status || "building",
      "Credentials Sent": t.credentials_sent_at ? "Yes" : "No",
    };

    masterRows.push(row);

    if (!collaboratorGroups[rev.username]) {
      collaboratorGroups[rev.username] = [];
    }
    collaboratorGroups[rev.username].push({
      "Team #": t.team_number,
      "Team Code": `SYN-${t.team_number}`,
      "Team Name": t.team_name,
      "Leader Name": t.leader_name || "",
      "Leader Email": t.leader_email || "",
      "College": t.college || "",
      "Team Members": membersList || "Solo",
      "Repository URL": t.github_repo_url || "",
      "Status": t.submission_status || "building",
    });
  }

  // Summary sheet
  const summaryRows = reviewers.map((r) => {
    const assignedTeams = collaboratorGroups[r] || [];
    return {
      "Collaborator GitHub Handle": r,
      "Collaborator GitHub Profile": `https://github.com/${r}`,
      "Total Assigned Teams": assignedTeams.length,
      "Assigned Team Numbers": assignedTeams.map(t => `#${t["Team #"]}`).join(", "),
    };
  });

  const wb = XLSX.utils.book_new();

  // 1. Summary sheet
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  // Auto-fit column widths
  wsSummary["!cols"] = [{ wch: 30 }, { wch: 45 }, { wch: 22 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Collaborator Summary");

  // 2. Master All Teams sheet
  const wsMaster = XLSX.utils.json_to_sheet(masterRows);
  wsMaster["!cols"] = [
    { wch: 8 },  // Team #
    { wch: 12 }, // Code
    { wch: 25 }, // Team Name
    { wch: 25 }, // Collaborator
    { wch: 40 }, // GitHub URL
    { wch: 25 }, // Leader Name
    { wch: 32 }, // Leader Email
    { wch: 35 }, // College
    { wch: 35 }, // Members
    { wch: 18 }, // Status
    { wch: 16 }, // Credentials Sent
  ];
  XLSX.utils.book_append_sheet(wb, wsMaster, "All Teams");

  // 3. Tab per collaborator
  for (const r of reviewers) {
    const groupRows = collaboratorGroups[r] || [];
    const wsGroup = XLSX.utils.json_to_sheet(groupRows);
    wsGroup["!cols"] = [
      { wch: 8 },  // Team #
      { wch: 12 }, // Code
      { wch: 25 }, // Team Name
      { wch: 25 }, // Leader Name
      { wch: 32 }, // Leader Email
      { wch: 35 }, // College
      { wch: 35 }, // Members
      { wch: 40 }, // Repo URL
      { wch: 15 }, // Status
    ];
    // Excel sheet name max 31 chars
    const safeSheetName = r.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, wsGroup, safeSheetName);
  }

  const outPath = "SYNAPSE_2026_Collaborator_Assignments.xlsx";
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  writeFileSync(outPath, buf);
  console.log(`\n✓ Successfully generated Excel file: ${outPath}`);

  await sql.end();
}

main().catch(async (e) => {
  console.error("Error generating Excel:", e);
  await sql.end();
  process.exit(1);
});
