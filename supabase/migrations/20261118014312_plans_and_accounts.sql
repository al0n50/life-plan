-- Life Plan OS cloud backend: one saved plan per account, synced across devices.
-- The app stays local-first: signing in is optional, and the plan on each device keeps
-- working offline. This table is the cloud copy that devices sync with.
-- Safe to re-run.

create table if not exists public.plans (
  user_id         uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- The whole plan, exactly as the app saves it on the device (LifeState)
  state           jsonb not null,
  -- The app's saved-data format version (LifeState.schemaVersion)
  schema_version  integer not null,
  -- Goes up by one on every save. Devices send the revision they last saw; if it no longer
  -- matches, another device saved in between and the app asks which plan to keep.
  revision        bigint not null default 1,
  -- Which device saved last (a random id per install, not a hardware id)
  device_id       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint plans_state_is_object check (jsonb_typeof(state) = 'object'),
  constraint plans_schema_version_valid check (schema_version between 1 and 1000),
  constraint plans_state_size check (pg_column_size(state) <= 2000000),   -- ~2 MB, far above a real plan
  constraint plans_device_id_length check (device_id is null or length(device_id) <= 64)
);

comment on table public.plans is 'One synced plan per account. Personal financial data: owner-only access.';

-- Every save: bump the revision and the timestamp, and keep the owner fixed
create or replace function public.plans_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id    := old.user_id;
  new.created_at := old.created_at;
  new.revision   := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.plans_before_update() from public, anon, authenticated;

drop trigger if exists plans_before_update on public.plans;
create trigger plans_before_update before update on public.plans
  for each row execute function public.plans_before_update();

-- New rows always start at revision 1
create or replace function public.plans_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision   := 1;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.plans_before_insert() from public, anon, authenticated;

drop trigger if exists plans_before_insert on public.plans;
create trigger plans_before_insert before insert on public.plans
  for each row execute function public.plans_before_insert();

-- Owner-only access. Logged-out visitors get nothing.
alter table public.plans enable row level security;
revoke all on public.plans from anon;
grant select, insert, update, delete on public.plans to authenticated;

drop policy if exists plans_select_own on public.plans;
drop policy if exists plans_insert_own on public.plans;
drop policy if exists plans_update_own on public.plans;
drop policy if exists plans_delete_own on public.plans;
create policy plans_select_own on public.plans for select to authenticated
  using (user_id = (select auth.uid()));
create policy plans_insert_own on public.plans for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy plans_update_own on public.plans for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy plans_delete_own on public.plans for delete to authenticated
  using (user_id = (select auth.uid()));

-- Account deletion from inside the app (required by the App Store and Google Play).
-- Deletes the signed-in user; their plan goes with it (on delete cascade).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = me;
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
