-- Sprout (Weight Gain Tracker) — Supabase schema
-- Run this once in your project's SQL editor: https://supabase.com/dashboard/project/_/sql/new

create extension if not exists pgcrypto;

-- ── Tables ──────────────────────────────────────────────────────────────

create table if not exists public.user_settings (
  user_id          uuid references auth.users(id) on delete cascade primary key,
  name             text not null default '',
  calorie_goal     numeric not null default 3500,
  protein_goal     numeric not null default 180,
  goal_weight_kg   numeric not null default 80,
  start_weight_kg  numeric not null default 70,
  water_goal_ml    numeric not null default 2500,
  units            text not null default 'metric',
  theme            text not null default 'dark',
  onboarded        boolean not null default false,
  updated_at       timestamptz not null default now()
);

create table if not exists public.foods (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  name             text not null,
  emoji            text not null default '🍽️',
  target_quantity  numeric not null default 1,
  unit             text not null default 'count',
  calories         numeric not null default 0,
  protein          numeric not null default 0,
  carbs            numeric not null default 0,
  fats             numeric not null default 0,
  aliases          text[] not null default '{}',
  sort_order       int not null default 0,
  archived         boolean not null default false,
  kind             text not null default 'quantity',
  active_days      smallint[] not null default '{0,1,2,3,4,5,6}',
  category         text not null default 'other',
  base_ingredient  text not null default '',
  created_at       timestamptz not null default now()
);

-- If you already ran this schema before these columns existed, these lines
-- add them safely without touching any of your existing foods/data.
alter table public.foods add column if not exists active_days smallint[] not null default '{0,1,2,3,4,5,6}';
alter table public.foods add column if not exists category text not null default 'other';
alter table public.foods add column if not exists base_ingredient text not null default '';

create table if not exists public.day_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  date             date not null,
  food_id          uuid references public.foods(id) on delete cascade not null,
  logged_quantity  numeric not null default 0,
  updated_at       timestamptz not null default now(),
  unique (user_id, date, food_id)
);

create table if not exists public.daily_water (
  user_id   uuid references auth.users(id) on delete cascade not null,
  date      date not null,
  water_ml  numeric not null default 0,
  primary key (user_id, date)
);

create table if not exists public.weight_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  date       date not null,
  weight_kg  numeric not null,
  unique (user_id, date)
);

create index if not exists day_logs_user_date_idx on public.day_logs (user_id, date);
create index if not exists weight_entries_user_date_idx on public.weight_entries (user_id, date);

-- ── Row Level Security — every user can only ever touch their own rows ──

alter table public.user_settings enable row level security;
alter table public.foods enable row level security;
alter table public.day_logs enable row level security;
alter table public.daily_water enable row level security;
alter table public.weight_entries enable row level security;

drop policy if exists "own settings" on public.user_settings;
create policy "own settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own foods" on public.foods;
create policy "own foods" on public.foods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own logs" on public.day_logs;
create policy "own logs" on public.day_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own water" on public.daily_water;
create policy "own water" on public.daily_water
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own weights" on public.weight_entries;
create policy "own weights" on public.weight_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Auto-create a settings row the moment someone signs up ─────────────

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_settings (user_id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Realtime — lets the app sync instantly across a user's own devices ─
-- Safe to re-run; Supabase will error harmlessly if a table is already added.
do $$
begin
  alter publication supabase_realtime add table public.foods;
exception when duplicate_object then null; end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.day_logs;
exception when duplicate_object then null; end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.daily_water;
exception when duplicate_object then null; end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.weight_entries;
exception when duplicate_object then null; end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.user_settings;
exception when duplicate_object then null; end;
$$;
