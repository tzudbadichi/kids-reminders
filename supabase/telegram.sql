-- Telegram linking - run this once in the SQL Editor on an existing database.
-- (Fresh installs already get these from schema.sql.)
-- profiles.telegram_chat_id already exists; this adds the one-time link code used
-- to connect a Telegram chat to a user account.

alter table public.profiles add column if not exists telegram_link_code text;

create unique index if not exists profiles_telegram_link_code_idx
  on public.profiles(telegram_link_code)
  where telegram_link_code is not null;
