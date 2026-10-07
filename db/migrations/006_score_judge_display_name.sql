-- Migration 006: keep the judge's name as typed, alongside the normalised key
-- scores.judge now holds a normalised key (lower-case, no punctuation, single spaces) so spelling
-- variants of one judge count once; judge_name keeps the spelling for display.
-- Additive only: no existing row is changed (an empty judge_name means "show judge").

alter table scores add column if not exists judge_name text not null default '';
