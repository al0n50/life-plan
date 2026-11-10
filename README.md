# Life Plan OS

> Personal finance and life planning app — mobile-first, built with Expo and React Native.

![Expo](https://img.shields.io/badge/Expo_58-000020?style=flat&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)

---

## Overview

Life Plan OS is a cross-platform (iOS, Android, Web) personal finance and life planning app. It models your income, expenses, debt, and goals through a simulation engine that projects your financial trajectory over time — taking into account career phases, taxes, and scheduled life events.

---

## Features

**Financial Engine**
- Income & paycheck simulation with tax estimation
- Expense tracking and budget planning
- Debt payoff modeling with amortization schedules
- Savings goal projections with phase-based milestones
- Financial review summaries

**Planning Tabs**
- **Home** — dashboard overview of your financial health
- **Calendar** — time-based view of financial events and goals
- **Life** — life plan and goal management
- **Log** — activity and transaction log
- **More** — settings and account management

**Screens**
- Accounts, Debt, Expenses, Goals, Income, Paycheck, Plan, Review
- Onboarding flow for first-time setup

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Expo 58 + React Native 0.88 |
| Language | TypeScript |
| Navigation | Expo Router (file-based, tab + stack) |
| State | Zustand |
| Web Support | react-native-web |
| Financial Engine | Custom simulation: simulate, schedule, tax, phases, model |

---

## Project Structure

```
life-plan/
├── src/
│   ├── app/
│   │   ├── (tabs)/          # home, calendar, life, log, more
│   │   ├── onboarding/      # first-run setup
│   │   └── *.tsx            # accounts, debt, expenses, goals, income, paycheck, plan, review
│   ├── engine/              # simulate, schedule, tax, phases, model, conditions, dates, updates, state
│   │   └── __tests__/       # Vitest suites for the engine
│   ├── store/               # useLifePlan.ts (Zustand + AsyncStorage)
│   └── components/          # editors, logging, money, plan, ui
```

---

## Getting Started

```bash
git clone https://github.com/al0n50/life-plan
cd life-plan
npm install
npx expo start
```

Press `i` for iOS simulator, `a` for Android, or `w` for web.

---

## Testing

```bash
npm test            # engine unit tests (Vitest)
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npx expo export --platform web   # production web build
```

All four run in GitHub Actions on every push and pull request.

---

Built by [Alonso Ochoa](https://github.com/al0n50)
