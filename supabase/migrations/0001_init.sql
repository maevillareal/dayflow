-- DAYFLOW schema. Run once in Supabase → SQL Editor (or `supabase db push`).
-- Every table has Row Level Security: a signed-in user can only read and write their own rows.
-- user_id fills itself in from the session, so the app never sends it.

create extension if not exists "pgcrypto";

-- Helper: one block of RLS policy per table.
create or replace function public._dayflow_owner_policy(tbl text) returns void language plpgsql as $$
begin
  execute format('alter table public.%I enable row level security', tbl);
  execute format('drop policy if exists "own rows" on public.%I', tbl);
  execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', tbl);
  execute format('create index if not exists %I on public.%I (user_id)', tbl || '_user_idx', tbl);
end $$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users on delete cascade,
  display_name text not null default '',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  description text not null default '',
  category text not null check (category in ('MVG','Exercise','Self Care','Skin Care','Eat Healthy','No Sugar')),
  start_date date not null,
  archived_at date,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- Versioned: a schedule change adds a row from that date, so past days keep their old rules.
create table if not exists public.habit_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  habit_id uuid not null references public.habits on delete cascade,
  effective_from date not null,
  kind text not null check (kind in ('daily','weekdays','weekly_target','interval')),
  days int[] not null default '{}',
  target int not null default 0 check (target between 0 and 7),
  interval_days int not null default 0 check (interval_days between 0 and 365),
  created_at timestamptz not null default now()
);

create table if not exists public.habit_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  habit_id uuid not null references public.habits on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '',
  category text not null check (category in ('General','MVG','Exercise','Self Care','Skin Care','Eat Healthy','No Sugar')),
  priority text not null check (priority in ('High','Medium','Low')),
  due_date date,
  status text not null default 'open' check (status in ('open','done')),
  notes text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.focus_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  domains text[] not null default '{}',
  allow text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.focus_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  profile_id uuid not null references public.focus_profiles on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text not null check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  planned_min int not null,
  actual_sec int not null,
  category text not null,
  task_id uuid references public.tasks on delete set null,
  mode text not null check (mode in ('normal','strict','scheduled')),
  profile_id uuid references public.focus_profiles on delete set null,
  status text not null check (status in ('completed','interrupted','ended_early')),
  created_at timestamptz not null default now()
);

create table if not exists public.selfcare_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  frequency_days int not null check (frequency_days between 1 and 365),
  next_planned date,
  reminder boolean not null default true,
  notes text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.selfcare_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  item_id uuid not null references public.selfcare_items on delete cascade,
  date date not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.skincare_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  type text not null default '',
  routines text[] not null default '{}',
  days int[] not null default '{}',
  is_active boolean not null default false,
  notes text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.skincare_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  product_id uuid not null references public.skincare_products on delete cascade,
  date date not null,
  routine text not null check (routine in ('am','pm')),
  created_at timestamptz not null default now()
);

create table if not exists public.reminder_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null,
  snoozed_until timestamptz,
  dismissed_on date,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);

select public._dayflow_owner_policy(t) from unnest(array[
  'profiles','habits','habit_schedules','habit_checkins','tasks','focus_profiles','focus_schedules',
  'focus_sessions','selfcare_items','selfcare_log','skincare_products','skincare_log','reminder_state'
]) as t;

drop function public._dayflow_owner_policy(text);
