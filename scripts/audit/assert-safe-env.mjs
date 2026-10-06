// Imported first by every audit script. Refuses to run against anything that is not local.
// Loads .env.audit (never .env.local) so production secrets are never read by the audit harness.
try {
  process.loadEnvFile(".env.audit");
} catch {}

const LOCAL = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const problems = [];
const host = (u) => {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
};

const dbUrl = process.env.DATABASE_URL ?? "";
if (/supabase\.co|pooler\.supabase\.com/.test(dbUrl)) problems.push("DATABASE_URL points at Supabase");
if (!LOCAL.has(host(dbUrl))) problems.push(`DATABASE_URL host is not local (${host(dbUrl) || "unset"})`);
if (!LOCAL.has(host(process.env.BASE_URL ?? ""))) problems.push("BASE_URL is not localhost/127.0.0.1");
if (!LOCAL.has(process.env.SMTP_HOST ?? "") && process.env.SMTP_HOST !== "mailpit") problems.push("SMTP_HOST is not local");
if (process.env.GITHUB_API_BASE_URL && !LOCAL.has(host(process.env.GITHUB_API_BASE_URL))) problems.push("GITHUB_API_BASE_URL is not local");
if (process.env.NODE_ENV === "production" && !LOCAL.has(host(dbUrl))) problems.push("NODE_ENV=production with non-local DB");

if (problems.length) {
  console.error("✗ assert-safe-env refused to run:\n  - " + problems.join("\n  - "));
  process.exit(2);
}

export const BASE_URL = process.env.BASE_URL.replace(/\/$/, "");
export const DATABASE_URL = dbUrl;
