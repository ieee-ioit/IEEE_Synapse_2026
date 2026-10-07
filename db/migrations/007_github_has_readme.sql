-- Migration 007: remember whether the last GitHub check found a README
-- Shown as a column and filter in the admin teams table; it does not change github_status.
-- Additive only (null = not checked yet).

alter table teams add column if not exists github_has_readme boolean;
