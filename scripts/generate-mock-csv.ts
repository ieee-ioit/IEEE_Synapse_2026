import { writeFileSync } from "node:fs";

const colleges = [
  "AISSMS Institute of Information Technology, Pune",
  "COEP Technological University, Pune",
  "MIT World Peace University, Pune",
  "PICT Pune",
  "VIIT Pune",
  "Cummins College of Engineering for Women, Pune",
  "DY Patil College of Engineering, Akurdi",
  "Sinhgad College of Engineering, Vadgaon",
  "PCCOE Pune",
  "Walchand College of Engineering, Sangli",
  "VJTI Mumbai",
  "SPIT Mumbai",
];

const teamNamePrefixes = [
  "Neural", "Cyber", "Quantum", "Synapse", "Binary", "Aero", "Hyper", "Apex",
  "Vortex", "Echo", "Terra", "Nova", "Flux", "Nexus", "Pixel", "Logic",
  "Code", "Algo", "Matrix", "Sigma", "Vector", "Crypto", "Vision", "Zenith"
];

const teamNameSuffixes = [
  "Crafters", "Warriors", "Architects", "Innovators", "Hackers", "Pioneers",
  "Titans", "Squad", "Legion", "Builders", "Knights", "Syndicate", "Guild",
  "Force", "Vanguard", "Lab", "Rockets", "Devs", "Bytes", "Nodes"
];

const firstNames = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan",
  "Krishna", "Ishaan", "Shaurya", "Atharv", "Dhruv", "Kabir", "Rohan", "Ananya",
  "Diya", "Gauri", "Saanvi", "Isha", "Rhea", "Pooja", "Meera", "Tanvi", "Neha",
  "Shreya", "Aditi", "Riya", "Kavya", "Sneha", "Kunal", "Harsh", "Pranav", "Devesh"
];

const lastNames = [
  "Sharma", "Verma", "Patil", "Deshmukh", "Joshi", "Kulkarni", "Shinde", "Dolas",
  "Gunjkar", "Pawar", "Chavan", "Tambe", "Mehta", "Shah", "Nair", "Iyer", "Rao",
  "Bose", "Reddy", "Gupta", "Singh", "Yadav", "Malhotra", "Kapoor"
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const teams: any[] = [];
const usedEmails = new Set<string>();

for (let i = 1; i <= 100; i++) {
  const p = pick(teamNamePrefixes);
  const s = pick(teamNameSuffixes);
  const teamName = `${p} ${s} ${i}`;
  const college = pick(colleges);
  
  // Team size distribution: 15% Solo, 25% 2-member, 30% 3-member, 30% 4-member
  const rand = Math.random();
  const memberCount = rand < 0.15 ? 1 : rand < 0.40 ? 2 : rand < 0.70 ? 3 : 4;

  const leaderFn = pick(firstNames);
  const leaderLn = pick(lastNames);
  const leaderName = `${leaderFn} ${leaderLn}`;
  let leaderEmail = `${leaderFn.toLowerCase()}.${leaderLn.toLowerCase()}${i}@example.com`;
  while (usedEmails.has(leaderEmail)) {
    leaderEmail = `${leaderFn.toLowerCase()}.${leaderLn.toLowerCase()}${i}_${Math.floor(Math.random()*100)}@example.com`;
  }
  usedEmails.add(leaderEmail);

  const team: Record<string, string> = {
    "Team Name": teamName,
    "Leader Name": leaderName,
    "Leader Email": leaderEmail,
    "College": college,
  };

  for (let m = 1; m < memberCount; m++) {
    const fn = pick(firstNames);
    const ln = pick(lastNames);
    team[`Member ${m} Name`] = `${fn} ${ln}`;
    team[`Member ${m} Email`] = `${fn.toLowerCase()}.${ln.toLowerCase()}${i}_m${m}@example.com`;
  }

  teams.push(team);
}

// Convert to CSV
const headers = [
  "Team Name",
  "Leader Name",
  "Leader Email",
  "College",
  "Member 1 Name",
  "Member 1 Email",
  "Member 2 Name",
  "Member 2 Email",
  "Member 3 Name",
  "Member 3 Email",
];

const csvRows = [headers.join(",")];
for (const t of teams) {
  const row = headers.map((h) => `"${(t[h] ?? "").replace(/"/g, '""')}"`);
  csvRows.push(row.join(","));
}

writeFileSync("mock_unstop_100_teams.csv", csvRows.join("\n"), "utf8");
console.log("✓ Generated mock_unstop_100_teams.csv with 100 realistic teams.");
