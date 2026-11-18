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
| **Frontend & backend** | Frontend only: Expo Router screens (`src/app`) + a pure TypeScript engine (`src/engine`). No server. All math runs on the device. | ✅ by design (a backend is only needed for accounts/sync: decision pending) |
| **Repo** | One repo, `main` is the release branch. README, MIT license, CI, secret scanning + push protection on. | ✅ (branch protection: decision pending) |
| **Commit** | Small, single-purpose commits; message rules below; CI must pass. | ✅ |
| **Auth** | None. The plan lives on the device it was made on, so no sign-in is needed. | ✅ by design (accounts come with sync, if chosen) |
| **Context window** | This file + AGENTS.md + README. Update when architecture or rules change. | ✅ |
| **Localhost & deploy** | `npx expo start` (press `w` for web, `i` iOS, `a` Android). Push to `main` → CI + Vercel builds the web app (`vercel.json`) and deploys it. | ✅ (iOS/Android builds: not set up yet) |
| **Database** | On-device storage only: Zustand `persist` → AsyncStorage (localStorage on web), key `life-plan-v1`, schema `version: 2` with a `migrate` step. | ✅ (cloud backup/sync: decision pending) |
| **API & API keys** | None. No network calls, no keys, no third-party services. | ✅ by design |
| **Checkpoint** | Tagged releases (`vX.Y.Z`) mark known-good versions; rollback steps below. | ✅ |

## Architecture

```
src/app/            Expo Router screens: (tabs)/home, calendar, life, log, more; onboarding/;
                    accounts, debt, expenses, goals, income, paycheck, plan, review
src/components/     editors, logging, money, plan, ui
src/engine/         pure, tested logic: simulate, schedule, tax, phases, model, conditions,
                    dates, updates, state (blank/example state, sanitize, migrateV1), format
src/store/          useLifePlan.ts: the single store (Zustand + persist)
src/theme/          colors, spacing
```

- **Engine first.** Financial logic lives in `src/engine` as pure functions with tests. Screens
  render engine output; they don't do math.
- **Saved data is a contract.** The persisted shape is versioned (`version: 2`). When it changes:
  bump the version, add a step to `migrate`, keep `sanitize` tolerant of old/partial data, and
  add a test. Never rename the storage key: that would wipe everyone's plan.
- **Privacy.** It's personal financial data and it stays on the device. Don't add analytics,
  network calls or third-party SDKs without Alonso's decision.

## Run it locally

```bash
npm ci
npx expo start          # dev server; w = web, i = iOS simulator, a = Android
npm test                # engine tests (Vitest, 45)
npm run typecheck       # tsc --noEmit
npm run lint            # expo lint
npx expo export --platform web   # production web build → dist/
```
All four checks run in GitHub Actions on every push and pull request.

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

## Commits

- Summary line: imperative, ≤ 72 characters, says what changed.
- Body: why, and what was tested. One logical change per commit. CI green before `main`.

## Checkpoints & rollback

- **Code:** known-good states of `main` are tagged `vX.Y.Z` with a GitHub release.
  Undo with `git revert <sha>`. Never force-push `main`.
- **Deploy:** Vercel → Deployments → last good one → **Instant Rollback**.
- **User data:** lives on each device. The versioned `migrate` path is what protects it across
  updates. Export/backup for users is on the roadmap.

## Roadmap

Polish pass next: installable on phones (shareable test build), smoother onboarding, screen tests
beyond the engine, optional account to sync plans across devices (needs auth + a database: decision).
