-- Migration 004: login lockout per (team, client IP)
-- A wrong-code lock now applies only to the client that made the attempts, so one person can't lock
-- every team out. A per-team cap across all IPs (enforced in the login route) is the backstop.
-- Additive only; teams.failed_attempts / teams.locked_until are left in place and no longer used.

create table if not exists team_login_locks (
  team_id         uuid not null references teams (id) on delete cascade,
  ip              text not null default '',
  failed_attempts integer not null default 0,
  locked_until    timestamptz,
  updated_at      timestamptz not null default now(),
  primary key (team_id, ip)
);

alter table team_login_locks enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on team_login_locks from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on team_login_locks from authenticated;
  end if;
end $$;
