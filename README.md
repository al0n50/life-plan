# Life Plan

Plan everything (paychecks, bills, debt, savings, career, and the life you're building), starting with what you know now. Built on the Life Plan OS model.

Expo SDK 58 + Expo Router + Zustand, for iOS, Android and web from one codebase.

## Run it

```bash
npm install
npx expo start          # press w for web, or scan the QR code with Expo Go
```

Quality gates, all clean:

```bash
npm test                # engine test suite (vitest)
npx tsc --noEmit
npx expo lint
```

## How the plan works

- **Paycheck-driven, day by day.** `simulate()` runs every payday, bill, debt due date, and weekly spending drawdown from the plan's start date to 12 years out. Each payday sets aside its share of recurring expenses + minimums, then splits what's left into five buckets: emergency, extra debt, goals, investing, guilt-free fun (20% on purpose).
- **Phases** decide the split: Crush the debt → Starter fund → Full safety net → Big goals → Build wealth. Two debt approaches: *asap* (debt is Phase 1) or *steady* (minimums with rollover). A custom split is optional.
- **Plan vs. reality.** The log holds what really happened: paychecks, extra income, one-time spending, confirmed balances. Logged numbers replace estimates. Anything not confirmed is tagged **Estimated**. Past paydays with no log become *paydays to confirm*. After 45 days with no update, Home asks for a full review.
- **Taxes.** Hourly jobs get a 2026 federal pay stub estimate (standard deduction, brackets, Social Security, Medicare, state %, other deductions). Logged paychecks that differ get a "use N hours" suggestion.
- **Accounts + routing.** Each bucket has a home account. Account balances are made of parts, and a confirmed balance scales those parts.
- **Life layer.** North Star + the people it's for, anchor life events, multiple career tracks with milestones (a milestone can point to a future job with a start date), and actions by urgency (urgent / this month / unlocks when a condition is met). Goals can be paused until a condition is met too ("when the card is paid off").

## Code map

```
src/engine/            Pure TypeScript, no React. Every function takes `today` explicitly.
  types.ts             Data model (LifeState, schema v2)
  simulate.ts          The day-by-day engine
  model.ts             buildModel(state, today) → everything screens need; agenda(); movesFor()
  updates.ts           Update union + applyUpdate(): the one way state changes (forms now, AI later)
  phases.ts            Phases, buckets, splits
  tax.ts, schedule.ts  Pay stub; paydays and due dates
  conditions.ts        "Unlocks when…" conditions
  state.ts             blank/example state, v1 → v2 migration, sanitize
  careerTemplates.ts   Optional career ladders to start a track from
  __tests__/           vitest suite
src/store/useLifePlan.ts   Zustand + AsyncStorage persistence, migration, useModel()
src/app/                   Routes
  (tabs)/home|calendar|log|life|more
  paycheck, accounts, income, expenses, debt, goals, plan, review, onboarding/
src/components/            ui kit, plan (split bar, agenda, phase card), editors, money, logging
```

## Next (features, not foundation)

- AI setup chat and "tell me what changed" → produce `Update[]`, user reviews, `apply(...)`
- AI coach that reads a plan snapshot
- Accounts + cloud sync; bank sync
- Calendar export / notifications for paydays and bills
- Native date pickers
