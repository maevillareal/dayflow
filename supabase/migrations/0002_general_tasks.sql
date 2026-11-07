-- Allow "General" as a task category (tasks only; habits keep the six categories).
-- Run once in Supabase → SQL Editor if you already ran 0001_init.sql.
alter table public.tasks drop constraint if exists tasks_category_check;
alter table public.tasks add constraint tasks_category_check
  check (category in ('General','MVG','Exercise','Self Care','Skin Care','Eat Healthy','No Sugar'));
