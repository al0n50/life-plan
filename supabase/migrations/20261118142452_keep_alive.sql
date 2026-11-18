-- Keep-alive: free Supabase projects pause after a week without activity, which would take
-- sign-in and sync down for everyone. A daily GitHub Action calls this function.
-- It reads nothing and returns only "ok", so it's safe for anyone to call.
create or replace function public.ping()
returns text
language sql
stable
security invoker
set search_path = ''
as $$ select 'ok'::text $$;

revoke execute on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
