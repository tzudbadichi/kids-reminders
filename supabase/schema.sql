-- Kids Reminders - database schema and Row-Level Security
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).

-- Profiles: one row per authenticated user
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  notification_time time not null default '06:30',
  telegram_chat_id text,
  telegram_link_code text,
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_telegram_link_code_idx
  on public.profiles(telegram_link_code)
  where telegram_link_code is not null;

-- Children
create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now()
);
create index if not exists children_user_idx on public.children(user_id);

-- Reminders (items stored as a JSON array of strings)
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  child_id uuid not null references public.children on delete cascade,
  due_date date not null,
  items jsonb not null default '[]'::jsonb,
  source_text text,
  created_at timestamptz not null default now()
);
create index if not exists reminders_user_date_idx on public.reminders(user_id, due_date);

-- Push subscriptions (used in a later phase, for web push)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Notification log (used in a later phase, to avoid duplicate sends per day)
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  sent_on date not null,
  channel text not null,
  created_at timestamptz not null default now(),
  unique (user_id, sent_on, channel)
);

-- Enable Row-Level Security on every table
alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.reminders enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_log enable row level security;

-- Policies: each user can access only their own rows
create policy "profiles_self" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "children_self" on public.children
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "reminders_self" on public.reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "push_self" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notiflog_self" on public.notification_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
