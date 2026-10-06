// Deterministic (seed 2026) mock data for the audit: 150 teams, poison rows, scores, submission plan.
// Usage: node scripts/audit/generate-mock-150.mjs   → writes audit/data/*
import { mkdirSync, writeFileSync } from "node:fs";

let seed = 2026;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const OUT = "audit/data";
mkdirSync(OUT, { recursive: true });

const colleges = [
  "AISSMS IOIT", "COEP Technological University", "PICT", "VIT Pune", "MIT WPU", "Cummins College of Engineering",
  "DY Patil COE Akurdi", "PCCOE", "Sinhgad COE", "VIIT Pune", "MITAOE", "JSPM RSCOE", "Bharati Vidyapeeth COE",
  "AIT Pune", "Symbiosis Institute of Technology", "Zeal COER", "Trinity COE", "DY Patil IOT Pimpri", "Indira COE",
  "GH Raisoni COE Pune", "NBN Sinhgad", "Marathwada Mitra Mandal COE", "KJ College of Engineering", "Dhole Patil COE", "PVG COET",
];
const tracks = ["AI & Intelligent Systems", "Cybersecurity & Digital Trust", "Social Impact & Sustainability", "Open Innovation"];
const first = ["Aarav", "Diya", "Ishaan", "Ananya", "Vihaan", "Saanvi", "Arjun", "Kavya", "Reyansh", "Myra", "Kabir", "Aditi", "Rohan", "Sneha", "Om", "Pooja", "Yash", "Tanvi", "Siddharth", "Riya"];
const last = ["Patil", "Deshmukh", "Kulkarni", "Joshi", "Shinde", "Pawar", "Jadhav", "Gaikwad", "More", "Chavan", "Bhosale", "Sharma", "Iyer", "Nair", "Rao"];
const words = ["Byte", "Neural", "Quantum", "Pixel", "Cipher", "Stack", "Vector", "Nova", "Logic", "Spark", "Orbit", "Kernel", "Matrix", "Pulse", "Echo"];
const nouns = ["Ninjas", "Coders", "Builders", "Hackers", "Wizards", "Squad", "Labs", "Crew", "Forge", "Minds"];

const sizes = [...Array(20).fill(1), ...Array(40).fill(2), ...Array(50).fill(3), ...Array(40).fill(4)].sort(() => rnd() - 0.5);
const usedNames = new Set();
const teams = sizes.map((size, i) => {
  let name;
  do name = `${pick(words)} ${pick(nouns)} ${100 + i}`; while (usedNames.has(name));
  usedNames.add(name);
  const person = (k) => {
    const n = `${pick(first)} ${pick(last)}`;
    return { name: n, email: `t${i + 1}.p${k}@mock.example.test` };
  };
  const leader = person(0);
  const members = Array.from({ length: size - 1 }, (_, k) => person(k + 1));
  return { name, leaderName: leader.name, leaderEmail: leader.email, college: i % 5 === 0 ? "AISSMS IOIT" : pick(colleges), track: tracks[i % 4], members };
});

const header = ["Team Name", "Leader Name", "Leader Email", "College", "Member 1 Name", "Member 1 Email", "Member 2 Name", "Member 2 Email", "Member 3 Name", "Member 3 Email"];
const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const toRow = (t) => [t.name, t.leaderName, t.leaderEmail, t.college, ...[0, 1, 2].flatMap((k) => [t.members[k]?.name, t.members[k]?.email])].map(q).join(",");
writeFileSync(`${OUT}/roster_150_clean.csv`, [header.join(","), ...teams.map(toRow)].join("\n") + "\n");

// Poison rows (manual §4). expected: what a safe import should do with each.
const poison = [
  { t: { ...teams[0], name: teams[0].name }, expect: "reject", why: "duplicate team name" },
  { t: { ...teams[1], name: `  ${teams[1].name.toUpperCase()} ` }, expect: "reject", why: "same name differing by case/whitespace" },
  { t: { name: "Dup Leader Email", leaderName: "X", leaderEmail: teams[2].leaderEmail, college: "PICT", members: [] }, expect: "reject", why: "leader email already used by another team" },
  { t: { name: "Leader Is Member", leaderName: "Y", leaderEmail: "same@mock.example.test", college: "PICT", members: [{ name: "Y2", email: "same@mock.example.test" }] }, expect: "reject-or-sanitise", why: "leader email equals member email" },
  { t: { name: "Bad Email Team", leaderName: "Z", leaderEmail: "not-an-email", college: "PICT", members: [] }, expect: "reject", why: "invalid email format" },
  { t: { name: "No Email Team", leaderName: "Z", leaderEmail: "", college: "PICT", members: [] }, expect: "reject", why: "missing leader email (can't receive credentials)" },
  { t: { name: "", leaderName: "Q", leaderEmail: "q@mock.example.test", college: "PICT", members: [] }, expect: "reject", why: "empty team name" },
  { t: { name: "L".repeat(300), leaderName: "Long", leaderEmail: "long@mock.example.test", college: "PICT", members: [] }, expect: "reject-or-sanitise", why: "300-char team name" },
  { t: { name: "Five Members", leaderName: "F", leaderEmail: "five@mock.example.test", college: "PICT", members: [1, 2, 3, 4].map((k) => ({ name: `M${k}`, email: `five${k}@mock.example.test` })) }, expect: "reject", why: "team size 5 (max 4)" },
  { t: { name: "टीम हैकर्स 🚀", leaderName: "देव", leaderEmail: "unicode@mock.example.test", college: "PICT", members: [] }, expect: "accept", why: "Devanagari + emoji name" },
  { t: { name: 'Comma, "Quote"\nNewline', leaderName: "C", leaderEmail: "comma@mock.example.test", college: "PICT", members: [] }, expect: "sanitise", why: "comma/quote/newline in name" },
  { t: { name: "<script>alert(1)</script>", leaderName: "X", leaderEmail: "xss1@mock.example.test", college: '"><img src=x onerror=alert(1)>', members: [] }, expect: "accept-escaped", why: "XSS payloads in name/college" },
  { t: { name: '=HYPERLINK("http://evil","x")', leaderName: "@SUM(1+1)", leaderEmail: "formula@mock.example.test", college: "PICT", members: [] }, expect: "accept-neutralised-on-export", why: "formula injection" },
  { t: { name: "'; DROP TABLE teams;--", leaderName: "S", leaderEmail: "sqli@mock.example.test", college: "PICT", members: [] }, expect: "accept-as-text", why: "SQL-looking text" },
  { t: { name: "Name\r\nBcc: victim@mock.example.test", leaderName: "Hdr\r\nBcc: x@mock.example.test", leaderEmail: "hdr@mock.example.test", college: "PICT", members: [] }, expect: "sanitise", why: "header injection attempt (CR/LF)" },
];
const dirty = "﻿" + [header.join(","), ...teams.map(toRow), ...poison.map((p) => toRow(p.t))].join("\r\n") + "\r\n\r\n";
writeFileSync(`${OUT}/roster_150_dirty.csv`, dirty);
writeFileSync(
  `${OUT}/roster_expected.json`,
  JSON.stringify({ clean: teams.map((t) => ({ name: t.name, expect: "accept" })), poison: poison.map((p) => ({ name: p.t.name, expect: p.expect, why: p.why })), teams, poisonTeams: poison.map((p) => p.t) }, null, 2),
);

// Scores: 3 judges × 150 × 7 criteria (scale 0–10, from db/schema.sql check constraint).
const criteria = ["Innovation", "Technical Implementation", "Functionality", "Problem Relevance", "Creativity", "Demo & Explanation", "Overall Impact"];
const judges = ["Dr. Rao", "Prof. Kulkarni", "Ms. Iyer"];
const s1 = ["teamIndex,judge,criterion,value"];
teams.forEach((_, i) => judges.forEach((j) => criteria.forEach((c) => s1.push(`${i},${j},${c},${(3 + rnd() * 7).toFixed(1)}`))));
writeFileSync(`${OUT}/scores_stage1_clean.csv`, s1.join("\n") + "\n");
const s1dirty = [...s1, "0,Dr. Rao,Innovation,-1", "1,Dr. Rao,Innovation,11", "2,Dr. Rao,Innovation,NaN", "3,Dr. Rao,Innovation,", "4,Dr. Rao,Innovation,seven", '5,Dr. Rao,Innovation,"7,5"', "999,Dr. Rao,Innovation,7", "6,Dr. Rao,Teamwork,7", "7,dr rao ,Innovation,2", "8,DR RAO,Innovation,2", s1[1], s1[1]];
writeFileSync(`${OUT}/scores_stage1_dirty.csv`, s1dirty.join("\n") + "\n");
const s2 = ["finalistSlot,judge,criterion,value"];
for (let f = 0; f < 10; f++) ["Jury A", "Jury B", "Jury C"].forEach((j) => criteria.forEach((c) => s2.push(`${f},${j},${c},${(5 + rnd() * 5).toFixed(1)}`)));
writeFileSync(`${OUT}/scores_stage2_clean.csv`, s2.join("\n") + "\n");
writeFileSync(`${OUT}/scores_tie_cases.csv`, "case,teamIndex,judge,criterion,value\nrank10-11,10,J,*,8\nrank10-11,11,J,*,8\npodium,0,J,*,9.5\npodium,1,J,*,9.5\n");

// Submission plan.
const scen = [["clean", 70], ["early", 8], ["noreadme", 6], ["noreviewer", 5], ["private", 4], ["ratelimited", 3], ["server", 2], ["empty", 2]];
const bag = scen.flatMap(([s, pct]) => Array(Math.round((pct / 100) * 150)).fill(s));
const plan = teams.map((t, i) => ({
  index: i,
  github: bag[i % bag.length],
  repo: i % 5 === 4 ? null : i < 8 ? "09:05-09:30" : "10:00-12:00",
  video: i % 3 === 0 ? "14:50-14:59" : "13:00-14:50",
  deadlineEdge: i >= 140 && i < 148,
  doubleSubmit: i >= 130 && i < 140,
}));
writeFileSync(`${OUT}/submissions_plan.json`, JSON.stringify(plan, null, 2));
console.log(`wrote ${OUT}: ${teams.length} teams, ${poison.length} poison rows, ${s1.length - 1} stage-1 score rows, ${s2.length - 1} stage-2 rows`);
