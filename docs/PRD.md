# Life Plan OS: MVP PRD

Approved by Alonso on 2026-11-18. Living copy: the "Life Plan OS: MVP PRD" doc. This file is
the version the code is built against.

## Summary

The MVP takes a new user from sign-up to a working money plan in minutes, on the web and on
their phone, with the plan safely backed up.

- **Who:** young adults with irregular or multiple incomes (students, part-time and hourly
  workers) who want to know where each paycheck should go.
- **Problem:** budgeting apps track spending after it happens. They don't plan ahead, paycheck by
  paycheck, through bills, debt, goals and life changes.
- **Success metric:** activation, meaning the share of new accounts that finish setup and come
  back within 7 days. Target: 40%. Measured from the saved plans in the database, so no
  analytics tools are needed.

## Baseline: live today (v1.0.0 + accounts)

| Area | What works |
| --- | --- |
| Planning engine | Paychecks with tax estimates, bills, debt payoff, goals, career phases, life events (45 tests) |
| Screens | Home, Calendar, Log, Life, More, 9 detail screens, and a 7-step setup |
| Saving | On the device, with a versioned format so updates keep plans |
| Accounts | Optional email sign-in, cloud sync between devices, account deletion (26 sync tests, 18 database tests) |
| Platforms | Web app live with a daily keep-alive; no phone builds yet |
| Gaps | No password reset, no email sender for real users, no privacy policy, no data export |

## MVP features, in build order

We build one feature at a time. Each ships on its own and gets a tagged release.

1. **Accounts ready for real users** (size M, release v1.1.0)
   - *Story:* as a new user, I can create an account, confirm my email, reset a forgotten
     password, and know what happens to my data.
   - *Done when:* confirmation and reset emails reach any address, sent from the app's own domain;
     "Forgot password" works on the web and in the phone app; a privacy policy and terms are
     linked from sign-up; I can export my plan as a file; account deletion (built) is easy to find.
   - *On hold:* the domain and email provider. Everything else ships first; until then emails
     only reach the Supabase project's team (enough to test with Alonso's account).
2. **First plan in 5 minutes** (size M, release v1.2.0)
   - *Story:* as a new user, I answer a few questions about pay, schedule, bills, debts and one
     goal, and get a paycheck-by-paycheck plan.
   - *Done when:* only pay and schedule are required, and everything else has sensible defaults
     or can be skipped; 5 test users each finish in under 5 minutes; setup ends on Home showing
     where the next paycheck goes; everything stays editable later; it works signed out.
3. **On your phone** (size M–L, release v1.3.0)
   - *Story:* as a user, I install Life Plan on my phone and my plan is there when I sign in.
   - *Done when:* iPhone (TestFlight) and Android (internal testing) builds come from EAS; the web
     app can also be added to a phone's home screen; sign-in and sync work between phone and web;
     the app has its own icon and launch screen.

**Why this order:** feature 1 is a launch blocker, because real users can't confirm their email
today. Feature 2 turns sign-ups into people who actually use the plan. Feature 3 delivers the
phone app once the first two work.

## Scope, risks and decisions

**Not in the MVP:** linking bank accounts, investment advice, shared or household plans,
reminders and notifications, analytics.

**Risks:**

- *Financial data privacy:* plans stay owner-only in the database; no analytics or third-party
  tracking; export and delete give users control.
- *App store review:* both stores need a privacy policy and in-app account deletion. Deletion is
  built; the policy is part of feature 1.
- *Free plan limits:* the free database has no automatic backups. Export lets users keep their
  own copy; a paid plan or scheduled export comes before growth.

**Decisions (2026-11-18):**

- [x] The 3 features and their order are approved
- [ ] Domain and email provider: on hold until Alonso picks them
- [ ] Apple and Google developer accounts (needed for feature 3)
- [x] Success target: 40% of new accounts active within 7 days
- [x] Merging: Claude merges each pull request after its review and checks pass
