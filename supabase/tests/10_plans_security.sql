-- Security tests for the plans table and account deletion, acting as real API roles.
-- Everything rolls back.
begin;

create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok - %', what;
end $$;
create function pg_temp.fails(sql text, what text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAILED (should have been blocked): %', what;
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - blocked: % (%)', what, sqlerrm;
end $$;
grant execute on function pg_temp.check(boolean, text), pg_temp.fails(text, text) to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alex@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bri@example.com');

-- ── Saving and syncing your own plan ───────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
insert into public.plans (state, schema_version, device_id, revision)
values ('{"schemaVersion":2,"name":"Alex"}', 2, 'phone-1', 99);
select pg_temp.check((select user_id = '00000000-0000-0000-0000-00000000000a' and revision = 1 from public.plans),
  'a new plan belongs to its owner and starts at revision 1 (whatever the app sends)');

update public.plans set state = '{"schemaVersion":2,"name":"Alex R"}', device_id = 'laptop-1', revision = 1
where user_id = '00000000-0000-0000-0000-00000000000a' and revision = 1;
select pg_temp.check((select revision = 2 and state->>'name' = 'Alex R' from public.plans),
  'each save bumps the revision');

-- A device that last saw revision 1 can't overwrite revision 2 (it gets 0 rows → conflict)
with stale as (
  update public.plans set state = '{"schemaVersion":2,"name":"stale"}'
  where user_id = '00000000-0000-0000-0000-00000000000a' and revision = 1 returning 1)
select pg_temp.check((select count(*) = 0 from stale), 'a device with an old revision cannot overwrite newer changes');

update public.plans set user_id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select user_id = '00000000-0000-0000-0000-00000000000a' from public.plans),
  'a plan cannot be handed to another account (the owner stays the same)');
select pg_temp.fails($$insert into public.plans (user_id, state, schema_version)
  values ('00000000-0000-0000-0000-00000000000b', '{"schemaVersion":2}', 2)$$, 'creating a plan for someone else');
select pg_temp.fails($$insert into public.plans (state, schema_version) values ('{"schemaVersion":2}', 2)$$,
  'a second plan for the same account');
select pg_temp.fails($$update public.plans set state = '[1,2,3]'$$, 'a plan that is not an object');

-- ── Other accounts and logged-out visitors ─────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select pg_temp.check((select count(*) = 0 from public.plans), 'another account cannot see your plan');
with u as (update public.plans set state = '{"schemaVersion":2,"name":"hacked"}' returning 1)
select pg_temp.check((select count(*) = 0 from u), 'another account cannot change your plan');
with d as (delete from public.plans returning 1)
select pg_temp.check((select count(*) = 0 from d), 'another account cannot delete your plan');

set local role anon;
set local request.jwt.claims = '{}';
select pg_temp.fails($$select * from public.plans$$, 'logged-out visitors reading plans');
select pg_temp.fails($$insert into public.plans (user_id, state, schema_version)
  values ('00000000-0000-0000-0000-00000000000a', '{"schemaVersion":2}', 2)$$, 'logged-out visitors writing plans');
select pg_temp.fails($$select public.delete_my_account()$$, 'logged-out visitors calling account deletion');

-- ── Internal functions can't be called directly ────────────────────
reset role;
select pg_temp.check(not has_function_privilege('authenticated', 'public.plans_before_update()', 'execute')
  and not has_function_privilege('authenticated', 'public.plans_before_insert()', 'execute'),
  'the save-tracking functions cannot be called directly');

-- ── Deleting your account removes you and your plan, and nobody else ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
insert into public.plans (state, schema_version) values ('{"schemaVersion":2,"name":"Bri"}', 2);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select public.delete_my_account();
reset role;
select pg_temp.check((select count(*) = 0 from auth.users where id = '00000000-0000-0000-0000-00000000000a')
  and (select count(*) = 0 from public.plans where user_id = '00000000-0000-0000-0000-00000000000a'),
  'deleting your account removes you and your plan');
select pg_temp.check((select count(*) = 1 from public.plans where user_id = '00000000-0000-0000-0000-00000000000b'),
  'other accounts are untouched');

rollback;
