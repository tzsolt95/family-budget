-- Családi Kassza – database setup for Supabase.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- It contains no personal data. The allowed e-mail addresses are added separately
-- (see supabase/README.md), typed straight into the SQL Editor.
--
-- Security model:
--   * Nobody can create an account unless their e-mail is on public.allowed_emails.
--   * A logged-in user only sees the household they belong to (Row Level Security).
--   * Not-logged-in visitors ("anon") get no access to any table.

-- ---------- Tables ----------

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (household_id, user_id)
);

-- The allowlist. Readable by nobody through the app; only the dashboard can see it.
create table if not exists public.allowed_emails (
  email text primary key check (email = lower(email)),
  household_id uuid not null references public.households (id) on delete cascade
);

-- Every piece of app data is one record: kind = 'tx', 'rule', 'recurring', ...
-- Deleted items stay as "tombstones" (deleted = true), so the other phone learns about the delete.
create table if not exists public.records (
  household_id uuid not null references public.households (id) on delete cascade,
  kind text not null,
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (household_id, kind, id)
);

create index if not exists records_household_updated on public.records (household_id, updated_at);

-- ---------- Row Level Security ----------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.allowed_emails enable row level security;
alter table public.records enable row level security;

-- True when the logged-in user belongs to the household.
create or replace function public.is_member(h uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = h and m.user_id = auth.uid()
  );
$$;

drop policy if exists "members read their household" on public.households;
create policy "members read their household" on public.households
  for select to authenticated using (public.is_member(id));

drop policy if exists "users read their own membership" on public.household_members;
create policy "users read their own membership" on public.household_members
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "members read records" on public.records;
create policy "members read records" on public.records
  for select to authenticated using (public.is_member(household_id));

drop policy if exists "members add records" on public.records;
create policy "members add records" on public.records
  for insert to authenticated with check (public.is_member(household_id));

drop policy if exists "members change records" on public.records;
create policy "members change records" on public.records
  for update to authenticated
  using (public.is_member(household_id))
  with check (public.is_member(household_id));

-- No delete policy on purpose: deletes are tombstones (deleted = true).
-- No policy at all on allowed_emails: the app can never read the allowlist.

-- ---------- Table access (new tables are not exposed automatically) ----------

revoke all on public.households, public.household_members, public.allowed_emails, public.records from anon, authenticated;
grant select on public.households, public.household_members to authenticated;
grant select, insert, update on public.records to authenticated;
revoke execute on function public.is_member(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;

-- ---------- Server-side timestamps ----------

-- The server sets updated_at, so the phones' clocks never matter.
create or replace function public.touch_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists touch_record on public.records;
create trigger touch_record
  before insert or update on public.records
  for each row execute function public.touch_record();

-- ---------- Sign-up guard (the allowlist) ----------

-- Refuses to create an account for any e-mail that is not on the allowlist.
create or replace function public.guard_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.allowed_emails a where a.email = lower(new.email)) then
    raise exception 'Ez az e-mail-cím nincs engedélyezve a Családi Kasszában.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_signup on auth.users;
create trigger guard_signup
  before insert on auth.users
  for each row execute function public.guard_signup();

-- Puts a newly created (allowed) user into their household.
create or replace function public.join_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.household_members (household_id, user_id)
  select a.household_id, new.id from public.allowed_emails a where a.email = lower(new.email)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists join_household on auth.users;
create trigger join_household
  after insert on auth.users
  for each row execute function public.join_household();

-- Trigger functions cannot be called directly (only as triggers), so they need no extra lock-down.
