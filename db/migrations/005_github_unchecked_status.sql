-- Migration 005: allow github_status = 'unchecked'
-- Used when a repo can't be read (private, missing, rate limit, GitHub error or timeout), so an
-- unreachable repo is never reported as 'review' or 'flagged'. Widens the check constraint only.

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'teams_github_status_check'
             and pg_get_constraintdef(oid) not like '%unchecked%') then
    alter table teams drop constraint teams_github_status_check;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'teams_github_status_check') then
    alter table teams add constraint teams_github_status_check
      check (github_status in ('clean', 'review', 'flagged', 'unchecked'));
  end if;
end $$;
