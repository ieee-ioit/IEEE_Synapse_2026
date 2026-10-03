-- Migration 001: Event Day enhancements
-- Supports:
-- 1. Phased submission & demo video URL on teams
-- 2. Stage 1 & Stage 2 scores tracking
-- 3. Finalists selection and stage order
-- 4. Confirmed 7 criteria seed and default event timestamps

-- Add columns to teams if they don't already exist
alter table teams add column if not exists demo_video_url text;
alter table teams add column if not exists first_submitted_at timestamptz;
alter table teams add column if not exists last_updated_at timestamptz;
alter table teams add column if not exists is_finalist boolean not null default false;
alter table teams add column if not exists stage2_order integer;

-- Update existing submitted teams to have first_submitted_at = submitted_at if null
update teams set first_submitted_at = submitted_at where first_submitted_at is null and submitted_at is not null;

-- Add stage column to scores
alter table scores add column if not exists stage integer not null default 1 check (stage in (1, 2));

-- Update scores unique constraint to include stage
do $$
begin
  if exists (
    select 1 from pg_constraint 
    where conname = 'scores_team_id_criterion_id_judge_key'
  ) then
    alter table scores drop constraint scores_team_id_criterion_id_judge_key;
  end if;
  
  if not exists (
    select 1 from pg_constraint 
    where conname = 'scores_team_id_criterion_id_judge_stage_key'
  ) then
    alter table scores add constraint scores_team_id_criterion_id_judge_stage_key unique (team_id, criterion_id, judge, stage);
  end if;
end $$;

-- Update or seed the confirmed 7 criteria
insert into criteria (name, weight, position)
values
  ('Innovation', 20.00, 1),
  ('Technical Implementation', 25.00, 2),
  ('Functionality', 20.00, 3),
  ('Problem Relevance', 15.00, 4),
  ('Creativity', 10.00, 5),
  ('Demo & Explanation', 5.00, 6),
  ('Overall Impact', 5.00, 7)
on conflict (name) do update set weight = excluded.weight, position = excluded.position;

-- Seed default start and deadline times in settings if empty
insert into settings (key, value)
values
  ('event_start_time', '2026-10-09T09:00:00+05:30'),
  ('submission_deadline', '2026-10-09T15:00:00+05:30')
on conflict (key) do update 
  set value = excluded.value 
  where settings.value is null or settings.value = '';
