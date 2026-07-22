-- ============================================================
-- ASHA Family Tracker — Supabase schema
-- Run this once in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste all → Run)
-- ============================================================

create extension if not exists "pgcrypto";

-- One row per household
create table if not exists families (
  id           uuid primary key default gen_random_uuid(),
  house_no     text,
  house_name   text,
  address      text,
  area         text,
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One row per person, linked to a household
create table if not exists members (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade,
  name         text not null,
  role         text,       -- e.g. "Ration Card Head", "Member"
  gender       text,       -- Male / Female / Other
  age          int,
  phone        text,
  aadhar       text,
  job          text,
  disease      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_members_family_id on members(family_id);
create index if not exists idx_families_area on families(area);

-- ============================================================
-- SECURITY: this data includes Aadhaar numbers, phone numbers
-- and health information. Row Level Security is turned on so
-- that ONLY a logged-in (authenticated) user can read or write
-- data. The anon public key alone (used by the web page) is not
-- enough — a user must sign in first.
-- ============================================================

alter table families enable row level security;
alter table members  enable row level security;

drop policy if exists "authenticated full access" on families;
create policy "authenticated full access" on families
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on members;
create policy "authenticated full access" on members
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- After running this file:
-- 1. Go to Authentication → Users → Add user, and create a
--    login (email + password) for yourself / your team.
-- 2. Go to Authentication → Providers → Email, and turn OFF
--    "Confirm email" if you want to add users instantly without
--    them needing to click a confirmation link.
-- ============================================================
