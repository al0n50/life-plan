# Life Plan backend (Supabase)

Project: `life-plan` (`wefbmijbzvuzloijfnnl`, us-east-1). Accounts are optional; this is
the cloud copy that signed-in devices sync with.

## Migrations

| File | What it does |
|---|---|
| `20261118014312_plans_and_accounts.sql` | `plans`: one saved plan per account (`state` jsonb, `schema_version`, `revision`). Owner-only row-level security, revision bumped by a trigger on every save, size/shape checks, and `delete_my_account()` for in-app account deletion. |
| `20261118142452_keep_alive.sql` | `ping()`: returns `ok`, callable by anyone, reads nothing. The daily `Keep database awake` GitHub Action calls it so the free project doesn't pause. |

Filenames match the versions recorded in production's migration history.

## Auth settings (Supabase dashboard)

- Site URL `https://life-plan-os.vercel.app`; redirect URLs `https://life-plan-os.vercel.app/**`, `lifeplan://**`
- Email + password, **confirm email on**, minimum password length 8
- Not set yet: **custom SMTP**. Supabase's built-in sender only emails the project's team
  (2/hour), so real users can't get confirmation emails until an email provider is connected.
- Leaked-password protection needs the Pro plan.

## How sync uses it

- Each device remembers the last `revision` it synced and whether it has unsynced changes.
- A save is `update … where user_id = me and revision = <last seen>`. If another device saved
  in between, nothing is updated and the app asks the user which plan to keep.
- Logic: `src/sync/decide.ts` (pure, tested) and `src/sync/useAccount.ts` (network + store).

## Tests

```bash
PGHOST=/tmp PGPORT=55432 PGUSER=postgres scripts/db-test.sh
```
Builds a throwaway database with a stand-in for Supabase's `auth` schema
(`tests/00_supabase_shim.sql`), applies every migration twice (they must be safe to re-run),
then runs the security tests as real roles (`anon`, `authenticated`). CI runs it on every push.

## Changing the schema

1. Add `migrations/<timestamp>_<name>.sql` (safe to re-run) and tests in `tests/`.
2. Run `scripts/db-test.sh`.
3. Apply to production, then rename the file to the version production recorded.
4. If the plan's saved shape changes, bump `schemaVersion` in the app and add a `migrate` step.
