-- The keep-alive function answers anyone and reveals nothing. Everything rolls back.
begin;
create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok - %', what;
end $$;
grant execute on function pg_temp.check(boolean, text) to anon;
set local role anon;
set local request.jwt.claims = '{}';
select pg_temp.check(public.ping() = 'ok', 'logged-out callers can ping the database');
reset role;
select pg_temp.check(
  (select prosecdef = false from pg_proc where oid = 'public.ping()'::regprocedure),
  'ping runs with the caller''s permissions, not elevated ones');
rollback;
