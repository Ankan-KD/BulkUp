-- BodyBuddy (Goal-Based Nutrition Companion) — Supabase schema
-- Run this once in your project's SQL editor: https://supabase.com/dashboard/project/_/sql/new

create extension if not exists pgcrypto;

-- ── Tables ──────────────────────────────────────────────────────────────

create table if not exists public.user_settings (
  user_id          uuid references auth.users(id) on delete cascade primary key,
  name             text not null default '',
  goal_mode        text not null default 'gain', -- 'gain' | 'lose' | 'maintain'
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
  emoji            text not null default 'Utensils', -- stores a lucide-react icon key (e.g. "Drumstick"), not a raw emoji anymore
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
  custom_category  text not null default '',
  base_ingredient  text not null default '',
  created_at       timestamptz not null default now()
);

-- If you already ran this schema before these columns existed, these lines
-- add them safely without touching any of your existing foods/data.
alter table public.user_settings add column if not exists goal_mode text not null default 'gain';
alter table public.foods add column if not exists active_days smallint[] not null default '{0,1,2,3,4,5,6}';
alter table public.foods add column if not exists category text not null default 'other';
alter table public.foods add column if not exists custom_category text not null default '';
alter table public.foods add column if not exists base_ingredient text not null default '';

-- One-time migration: the app used to store a raw emoji character in `emoji`
-- (e.g. '🥚'); it now stores a lucide-react icon key (e.g. 'Egg'). This
-- upgrades any existing rows still holding an old emoji to the closest icon
-- key so existing foods don't all collapse to the generic fallback icon.
-- Safe to re-run; rows already holding a valid icon key are left untouched.
update public.foods set emoji = 'Egg' where emoji = '🥚';
update public.foods set emoji = 'CupSoda' where emoji = '🥤';
update public.foods set emoji = 'Drumstick' where emoji = '🍗';
update public.foods set emoji = 'Wheat' where emoji in ('🍚', '🥣');
update public.foods set emoji = 'Milk' where emoji = '🥛';
update public.foods set emoji = 'Nut' where emoji in ('🥜', '🫘');
update public.foods set emoji = 'Banana' where emoji = '🍌';
update public.foods set emoji = 'Cookie' where emoji = '🥞';
update public.foods set emoji = 'Milk' where emoji = '🧀';
update public.foods set emoji = 'Carrot' where emoji in ('🥑', '🍠');
update public.foods set emoji = 'Utensils' where emoji = '🍽️';
-- Anything else still holding a raw (non-ASCII) emoji character falls back
-- to the generic icon at render time automatically — no crash, no data loss.

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

-- Meal Combos (Phase 2) — a saved group of foods the user can log in one tap.
-- `items` is a small JSON array of {"foodId": "...", "quantity": number},
-- referencing rows in public.foods — no separate junction table needed.
create table if not exists public.meal_combos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  icon        text not null default 'UtensilsCrossed',
  items       jsonb not null default '[]',
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- Milestones (Phase 3) — one row per unlocked achievement per user. We only
-- ever insert (never update); `achieved_at` is simply the date this app
-- instance first detected the milestone. Presence of a row is what stops
-- the celebration from firing again on every load.
create table if not exists public.milestones (
  user_id      uuid references auth.users(id) on delete cascade not null,
  key          text not null,
  achieved_at  date not null default current_date,
  primary key (user_id, key)
);

create index if not exists day_logs_user_date_idx on public.day_logs (user_id, date);
create index if not exists weight_entries_user_date_idx on public.weight_entries (user_id, date);
create index if not exists meal_combos_user_idx on public.meal_combos (user_id);
create index if not exists milestones_user_idx on public.milestones (user_id);

-- ── Row Level Security — every user can only ever touch their own rows ──

alter table public.user_settings enable row level security;
alter table public.foods enable row level security;
alter table public.day_logs enable row level security;
alter table public.daily_water enable row level security;
alter table public.weight_entries enable row level security;
alter table public.meal_combos enable row level security;
alter table public.milestones enable row level security;

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

drop policy if exists "own meal combos" on public.meal_combos;
create policy "own meal combos" on public.meal_combos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own milestones" on public.milestones;
create policy "own milestones" on public.milestones
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
do $$
begin
  alter publication supabase_realtime add table public.meal_combos;
exception when duplicate_object then null; end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.milestones;
exception when duplicate_object then null; end;
$$;
