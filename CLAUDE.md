# Life Plan OS: project brief

Read this first. It's the working context for anyone (or any AI agent) changing this repo.
Expo-specific rules (always check the versioned Expo docs, use `npx expo install`) are in
AGENTS.md, imported here:

@AGENTS.md

## What it is

A personal finance and life-planning app: it models income, paychecks, taxes, bills, debt and
goals, then simulates where your money goes over time through career phases and life events.
Cross-platform (iOS, Android, web) from one Expo codebase. Owner: Alonso Ochoa (@al0n50).
Live web demo: https://life-plan-os.vercel.app ("Explore an example plan first" loads sample data).

## The foundation (status)

| Fundamental | How it works here | Status |
|---|---|---|
| **Frontend & backend** | Expo Router screens (`src/app`) + a pure TypeScript engine (`src/engine`); all math runs on the device. Backend = Supabase project `life-plan` (accounts + one synced plan per account). | ✅ |
| **Repo** | One repo, `main` is the release branch. README, MIT license, CI, secret scanning + push protection on. | ⏳ "Protect main" ruleset (no force-push or deletion) waiting on Alonso's GitHub email confirmation |
| **Commit** | Every change is a pull request with a Vercel preview URL, a full self-review of the diff and green CI before merging (see "How we ship"). | ✅ |
| **Auth** | Optional email + password accounts (Supabase Auth). Signed out, the app works fully on one device. In-app account deletion. | ✅ Site URL, redirects, 8-character minimum set. ⏳ Custom SMTP needed before real users can get confirmation emails (see `supabase/README.md`) |
| **Context window** | This file + AGENTS.md + `supabase/README.md` + README. Update when architecture or rules change. | ✅ |
| **Localhost & deploy** | `npx expo start` (press `w` for web, `i` iOS, `a` Android). Push to `main` → CI + Vercel builds the web app (`vercel.json`) and deploys it. | ✅ (iOS/Android builds: not set up yet) |
| **Database** | On the device: Zustand `persist` → AsyncStorage, key `life-plan-v1`, `version: 2` with a `migrate` step. In the cloud: `plans` table (schema as code in `supabase/migrations`, 16 security tests in CI). | ✅ (backups: free plan has none; see roadmap) |
| **API & API keys** | Supabase only (auth + `plans`). The URL and publishable key are public by design and built into the app (`src/lib/supabase.ts`, overridable with `EXPO_PUBLIC_*`). No secret keys in the app, ever. | ✅ |
| **Checkpoint** | Tagged releases (`vX.Y.Z`) mark known-good versions of `main`; rollback steps below. | ⏳ v1.0.0 is ready: Alonso creates the tag + release on GitHub from `main` (notes in CHANGELOG.md). Vercel rollback and `git revert` work today |

## Architecture

```
src/app/            Expo Router screens: (tabs)/home, calendar, life, log, more; onboarding/;
                    accounts, debt, expenses, goals, income, paycheck, plan, review
src/components/     editors, logging, money, plan, ui
src/engine/         pure, tested logic: simulate, schedule, tax, phases, model, conditions,
                    dates, updates, state (blank/example state, sanitize, migrateV1), format
src/store/          useLifePlan.ts: the single store (Zustand + persist)
src/sync/           decide.ts (pure sync decisions, tested) + useAccount.ts (sign-in, sync, account deletion)
src/lib/supabase.ts Supabase client (sessions kept in AsyncStorage)
supabase/           migrations + security tests for the cloud backend (see supabase/README.md)
src/theme/          colors, spacing
```

- **Engine first.** Financial logic lives in `src/engine` as pure functions with tests. Screens
  render engine output; they don't do math.
- **Saved data is a contract.** The persisted shape is versioned (`version: 2`). When it changes:
  bump the version, add a step to `migrate`, keep `sanitize` tolerant of old/partial data, and
  add a test. Never rename the storage key: that would wipe everyone's plan.
- **Local-first sync.** The plan on the device is always what the user sees and edits. Signed
  in, it syncs with the account's cloud copy: each device remembers the last `revision` it saw;
  a save only applies if that revision still matches, otherwise the user chooses which plan to
  keep. The example plan is never uploaded. Never sync silently over someone's changes.
- **Privacy.** It's personal financial data. Cloud copies are owner-only (row-level security).
  Don't add analytics, extra network calls or third-party SDKs without Alonso's decision.

## Run it locally

```bash
npm ci
npx expo start          # dev server; w = web, i = iOS simulator, a = Android
npm test                # engine + sync tests (Vitest, 71)
npm run typecheck       # tsc --noEmit
npm run lint            # expo lint
npx expo export --platform web   # production web build → dist/
```
Database tests (local Postgres 15+ with a `postgres` superuser):
`PGHOST=/tmp PGPORT=55432 PGUSER=postgres scripts/db-test.sh`

All of these run in GitHub Actions on every push and pull request.
`npx expo install` needs Expo's servers; offline, prefix it with `EXPO_OFFLINE=1`.

## Deploy

- **Web:** every push to `main` → Vercel (project `life-plan-os`) runs
  `npx expo export --platform web` and serves `dist/` (see `vercel.json`; SPA rewrite to
  `index.html`). The commit gets a "Vercel" status on GitHub.
- **iOS/Android:** EAS Build (`npx eas-cli@latest build`). Not set up yet; no store listing.

## Rules

- Use `npx expo install <pkg>` (never plain `npm install`) for anything Expo/React Native.
- Lint + typecheck + tests before declaring work done.
- Engine changes need tests; data-shape changes need a migration and a test.
- Product decisions (accounts, sync, app-store release, paid services) go to Alonso.
- Repo rules: one repo per project; never delete existing repos; no duplicate repos or clones.

## How we ship: every change is a pull request

1. **Branch** from `main`: `feat/…`, `fix/…`, `docs/…` or `chore/…`. Nothing is pushed straight to `main`.
2. **Commit small.** Summary line imperative, ≤ 72 characters; body says why and what was tested.
3. **Review before every commit.** Read the whole staged diff (`git diff --staged`) line by line.
   Every line must be explainable: what it does and why it's needed. If a line can't be explained,
   it doesn't get committed. Generated files (lockfiles) are checked for unexpected changes.
4. **Open a pull request** (the template has the checklist). CI runs, and Vercel posts a
   **preview URL** for the PR. Test the change on the preview, not only on localhost.
5. **Merge** (squash) only when CI is green, the preview has been checked and the review is done.
   Merging deploys `main` to production; check the live site afterwards.
6. **Finish a feature** with a `CHANGELOG.md` entry and a tagged release.
7. **Database changes** go in the same PR. Previews and production share one database, so
   migrations must be additive and backward-compatible: apply after review, before merging.
   Removing old columns or tables waits for a later PR, once no code uses them.

## Checkpoints & rollback

- **Code:** known-good states of `main` are tagged `vX.Y.Z` with a GitHub release.
  Undo with a revert pull request (`git revert <sha>` on a branch). Never force-push `main`.
- **Deploy:** Vercel → Deployments → last good one → **Instant Rollback**.
- **User data:** the device copy is protected across updates by the versioned `migrate` path;
  signed-in users also have the cloud copy. Database migrations are forward-only: undo with a
  new migration. The Supabase free plan has no automatic backups (Pro adds daily ones).

## Roadmap

Done: optional accounts + cloud sync (web and phone), in-app account deletion, daily keep-alive.
Next for a public launch: phone builds (EAS) and store listings, a privacy policy, password reset,
backups (Supabase Pro or a scheduled export), custom SMTP for auth emails,
smoother onboarding, screen tests.
