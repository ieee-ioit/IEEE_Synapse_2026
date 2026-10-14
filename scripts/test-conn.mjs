import postgres from "postgres";

try {
  process.loadEnvFile(".env");
} catch {}
try {
  process.loadEnvFile(".env.local");
} catch {}

const url = process.env.DATABASE_URL;
console.log("Connecting to:", url ? url.replace(/:[^:@]+@/, ":****@") : "none");

const sql = postgres(url, {
  prepare: false,
  connect_timeout: 10,
  max: 1,
  ssl: /supabase\.(co|com)/.test(url) && !/sslmode=/.test(url) ? "require" : undefined,
});

try {
  const [row] = await sql`select 1 as ok, now() as current_time`;
  const crits = await sql`select name, weight from criteria order by position`;
  const [sum] = await sql`select sum(weight) as total_weight from criteria`;
  console.log("✓ Connection successful:", row);
  console.log("✓ Criteria:", crits);
  console.log("✓ Total Weight:", sum.total_weight);
} catch (err) {
  console.error("✗ Connection failed:", err.message);
} finally {
  await sql.end();
}
