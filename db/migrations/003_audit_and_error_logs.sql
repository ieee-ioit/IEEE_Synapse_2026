-- Migration 003: Audit and Error Logging Tables
-- Tracks administrative actions, team deliverable updates, and application runtime errors.

-- ─── Audit Logs ─────────────────────────────────────────────────────────────
create table if not exists audit_logs (
  id          bigint generated always as identity primary key,
  actor_type  text not null check (actor_type in ('admin', 'team', 'system')),
  actor_id    text not null default '',       -- e.g. admin email or team number
  action      text not null,                  -- e.g. 'TEAMS_IMPORTED', 'TEAM_UPDATED', 'SCORES_UPLOADED', 'SETTINGS_SAVED', 'REPO_SUBMITTED', 'VIDEO_SUBMITTED', 'DATA_RESET'
  target_type text not null default '',       -- e.g. 'team', 'score', 'setting', 'system'
  target_id   text not null default '',       -- e.g. team id or setting key
  details     jsonb not null default '{}'::jsonb, -- structured details (count, payload, etc.)
  ip          text not null default '',
  user_agent  text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx on audit_logs (actor_type, actor_id);
create index if not exists audit_logs_action_idx on audit_logs (action);

-- ─── Error Logs ─────────────────────────────────────────────────────────────
create table if not exists error_logs (
  id          bigint generated always as identity primary key,
  level       text not null default 'error' check (level in ('warn', 'error', 'fatal')),
  endpoint    text not null default '',       -- e.g. '/api/team/submit'
  message     text not null,                  -- error message
  stack       text not null default '',       -- stack trace if available
  context     jsonb not null default '{}'::jsonb, -- request payload, route params, user context
  ip          text not null default '',
  user_agent  text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists error_logs_created_at_idx on error_logs (created_at desc);
create index if not exists error_logs_level_idx on error_logs (level);
create index if not exists error_logs_endpoint_idx on error_logs (endpoint);

-- ─── Security / RLS ──────────────────────────────────────────────────────────
alter table audit_logs enable row level security;
alter table error_logs enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on audit_logs, error_logs from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on audit_logs, error_logs from authenticated;
  end if;
end $$;
