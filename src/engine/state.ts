// Creating, migrating and repairing saved state.
import { addDays, addMonths, isDate, monthOf, weekday } from './dates';
import { num, uid } from './format';
import { paydays } from './schedule';
import type { Account, Debt, Expense, Goal, Job, LifeState, Settings } from './types';

export const SCHEMA_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  debtMode: 'asap',
  starter: 1000,
  efMonths: 3,
  useCustom: false,
  custom: [15, 55, 10, 0, 20],
  taxPct: 25,
  stateTax: 0,
};

export function blankState(today: string): LifeState {
  return {
    schemaVersion: 2,
    example: false,
    onboarded: false,
    createdAt: today,
    lastReview: today,
    name: '',
    jobs: [],
    expenses: [],
    debts: [],
    goals: [],
    accounts: [{ id: uid('a'), name: 'Checking', type: 'checking', balance: 0, asOf: today }],
    routes: {},
    settings: { ...DEFAULT_SETTINGS },
    log: [],
    northStar: { statement: '', anchors: [] },
    lifeEvents: [],
    careerTracks: [],
    actions: [],
  };
}

/**
 * A believable example person, positioned relative to `today` so it always looks current.
 * Numbers are for show only.
 */
export function exampleState(today: string): LifeState {
  const start = addDays(today, -84);
  const job: Job = {
    id: 'j_store',
    name: 'Grocery store',
    payType: 'hourly',
    rate: 16.5,
    hours: 30,
    amount: 0,
    freq: 'biweekly',
    nextPay: addDays(start, 6),
    otherDed: 0,
  };
  const future: Job = {
    id: 'j_cna',
    name: 'Clinical partner (evenings)',
    payType: 'hourly',
    rate: 19,
    hours: 16,
    amount: 0,
    freq: 'biweekly',
    nextPay: addDays(start, 6),
    otherDed: 0,
    startDate: addMonths(today, 4),
    careerTrackId: 't_health',
  };
  const card: Debt = { id: 'd_card', name: 'Credit card', kind: 'credit_card', balance: 4200, apr: 27.99, min: 120, due: 18, asOf: start };
  const car: Debt = { id: 'd_car', name: 'Car loan', kind: 'auto', balance: 9800, apr: 7.9, min: 255, due: 5, asOf: start };
  const expenses: Expense[] = [
    { id: 'e_phone', name: 'Phone', amount: 55, freq: 'monthly', kind: 'bill', dueDay: 12 },
    { id: 'e_ins', name: 'Car insurance', amount: 140, freq: 'monthly', kind: 'bill', dueDay: 20 },
    { id: 'e_home', name: 'Help at home', amount: 250, freq: 'monthly', kind: 'bill', dueDay: 1 },
    { id: 'e_food', name: 'Food and gas', amount: 220, freq: 'monthly', kind: 'spending' },
    { id: 'e_subs', name: 'Subscriptions', amount: 35, freq: 'monthly', kind: 'spending' },
    { id: 'e_reg', name: 'Car registration', amount: 85, freq: 'yearly', kind: 'bill', nextDue: addMonths(today, 5) },
  ];
  const accounts: Account[] = [
    { id: 'a_chk', name: 'Checking', type: 'checking', balance: 380, asOf: start },
    { id: 'a_hysa', name: 'High-yield savings', type: 'hysa', balance: 600, asOf: start },
    { id: 'a_roth', name: 'Roth IRA', type: 'investing', balance: 0, asOf: start },
  ];
  const goals: Goal[] = [
    { id: 'g_trip', name: 'Trip to Japan', target: 4000, date: monthOf(addMonths(today, 10)), saved: 0, unlockWhen: { kind: 'debt_paid', debtId: 'd_card' } },
    { id: 'g_laptop', name: 'New laptop', target: 1200, date: monthOf(addMonths(today, 6)), saved: 0 },
  ];

  // Real paychecks logged for every payday so far except the most recent (left to confirm).
  const past = paydays(job, start, today);
  const varied = [0.97, 1.04, 0.99, 1.06, 1.01, 0.95];
  const net = 840; // roughly what lands for this job
  const log: LifeState['log'] = past.slice(0, -1).map((d, i) => ({ id: `l_p${i}`, date: d, type: 'paycheck', job: job.id, amount: Math.round(net * varied[i % varied.length]) }));
  log.push({ id: 'l_x1', date: addDays(today, -30), type: 'extra', source: 'Weekend event setup', amount: 250, selfEmployed: true, taxPct: 25 });
  log.push({ id: 'l_s1', date: addDays(today, -20), type: 'spend', what: 'Car repair', amount: 180, from: 'emergency' });

  return {
    schemaVersion: 2,
    example: true,
    onboarded: true,
    createdAt: start,
    lastReview: start,
    name: 'Sam',
    jobs: [job, future],
    expenses,
    debts: [card, car],
    goals,
    accounts,
    routes: { pay: 'a_chk', emergency: 'a_hysa', goals: 'a_hysa', invest: 'a_roth', tax: 'a_hysa' },
    settings: { ...DEFAULT_SETTINGS },
    log,
    northStar: {
      statement: 'A life big enough for everyone in it. The person who says “I got it” and means it.',
      anchors: ['Mom & Dad', 'My sisters', 'Grandparents', 'Friends who are family'],
      targetAge: 30,
      birthYear: Number(today.slice(0, 4)) - 23,
    },
    lifeEvents: [
      { id: 'ev_mom', title: 'Mom turns 50', date: addMonths(today, 20), kind: 'anchor', detail: 'The whole family shows up.' },
      { id: 'ev_grad', title: 'Sister’s graduation', date: addMonths(today, 7), kind: 'event' },
    ],
    careerTracks: [
      {
        id: 't_tech',
        name: 'Tech',
        status: 'Applying',
        target: 'Entry-level IT or software role',
        milestones: [
          { id: 'm1', title: 'Finish degree', status: 'done' },
          { id: 'm2', title: 'Update résumé, LinkedIn and GitHub', status: 'now' },
          { id: 'm3', title: 'First tech job offer', date: addMonths(today, 3), status: 'next' },
          { id: 'm4', title: 'Master’s program?', status: 'question' },
        ],
      },
      {
        id: 't_health',
        name: 'Healthcare',
        status: 'Starting soon',
        milestones: [
          { id: 'm5', title: 'Apply to CNA program', date: addDays(today, 10), status: 'now' },
          { id: 'm6', title: 'CNA program', date: addMonths(today, 2), status: 'next' },
          { id: 'm7', title: 'Clinical partner job', date: addMonths(today, 4), status: 'next', incomeJobId: 'j_cna' },
        ],
      },
    ],
    actions: [
      { id: 'ac1', title: 'Call your card issuer and ask for a lower APR', detail: 'A clean payment history is real leverage.', urgency: 'urgent', done: false },
      { id: 'ac2', title: 'Send 10 job applications this week', urgency: 'urgent', done: false, due: addDays(today, 6) },
      { id: 'ac3', title: 'Apply to the CNA program', urgency: 'month', done: false, due: addDays(today, 10) },
      { id: 'ac4', title: 'Open a separate savings account for Japan', urgency: 'unlocked', unlockWhen: { kind: 'debt_paid', debtId: 'd_card' }, done: false },
      { id: 'ac5', title: 'Start investing in your Roth IRA', urgency: 'unlocked', unlockWhen: { kind: 'phase_reached', phase: 'goals' }, done: false },
    ],
  };
}

// ---------------- Migration ----------------

/** Shape written by the first version of the app (zustand persist v1). */
interface V1Profile {
  name?: string;
  income?: { id: string; name: string; amount: number; frequency: string; startDate?: string; endDate?: string }[];
  bills?: { id: string; name: string; amount: number; frequency: string; dueDay: number; essential?: boolean }[];
  debts?: { id: string; name: string; kind?: string; balance: number; apr: number; minPayment: number; dueDay: number }[];
  assets?: { id: string; name: string; kind: string; value: number }[];
  goals?: { id: string; name: string; targetAmount: number; targetDate: string; saved: number }[];
  settings?: { debtStrategy?: string; emergencyFundMonths?: number; starterEmergencyFund?: number };
}

const V1_FREQ: Record<string, Job['freq']> = { weekly: 'weekly', biweekly: 'biweekly', semimonthly: 'semimonthly', monthly: 'monthly' };
const V1_EXP_FREQ: Record<string, Expense['freq']> = { weekly: 'weekly', biweekly: 'biweekly', monthly: 'monthly', annually: 'yearly' };

export function migrateV1(p: V1Profile, onboarded: boolean, today: string): LifeState {
  const st = blankState(today);
  st.onboarded = onboarded;
  st.name = p.name ?? '';
  st.jobs = (p.income ?? []).map((i) => {
    const freq = V1_FREQ[i.frequency] ?? 'monthly';
    // Quarterly/annual income becomes its monthly average.
    const amount = V1_FREQ[i.frequency] ? i.amount : i.frequency === 'quarterly' ? i.amount / 3 : i.amount / 12;
    // v1 had no payday dates. Anchor weekly/biweekly pay to the next Friday so paychecks schedule;
    // the user can correct it in Income.
    const nextPay = freq === 'weekly' || freq === 'biweekly' ? addDays(i.startDate && i.startDate > today ? i.startDate : today, (5 - weekday(today) + 7) % 7) : '';
    return { id: i.id, name: i.name, payType: 'amount', rate: 0, hours: 0, amount, freq, nextPay, otherDed: 0, startDate: i.startDate, endDate: i.endDate };
  });
  st.expenses = (p.bills ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    amount: V1_EXP_FREQ[b.frequency] ? b.amount : b.frequency === 'semimonthly' ? b.amount * 2 : b.amount / 3,
    freq: V1_EXP_FREQ[b.frequency] ?? 'monthly',
    kind: b.essential === false ? 'spending' : 'bill',
    dueDay: b.dueDay,
  }));
  st.debts = (p.debts ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    kind: (d.kind as Debt['kind']) ?? 'other',
    balance: d.balance,
    apr: d.apr,
    min: d.minPayment,
    due: d.dueDay,
    asOf: today,
  }));
  const ACCT: Record<string, Account['type'] | undefined> = { cash: 'checking', savings: 'savings', investment: 'investing', retirement: 'investing' };
  const accts = (p.assets ?? []).filter((a) => ACCT[a.kind]);
  if (accts.length) st.accounts = accts.map((a) => ({ id: a.id, name: a.name, type: ACCT[a.kind]!, balance: a.value, asOf: today }));
  st.goals = (p.goals ?? []).map((g) => ({ id: g.id, name: g.name, target: g.targetAmount, date: monthOf(g.targetDate), saved: g.saved }));
  st.settings = {
    ...DEFAULT_SETTINGS,
    debtMode: 'asap',
    efMonths: p.settings?.emergencyFundMonths ?? DEFAULT_SETTINGS.efMonths,
    starter: p.settings?.starterEmergencyFund ?? DEFAULT_SETTINGS.starter,
  };
  return st;
}

/** Fill anything missing or malformed so the engine can always run. */
export function sanitize(raw: unknown, today: string): LifeState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<LifeState>;
  if (s.schemaVersion !== 2) return null;
  const base = blankState(today);
  const arr = <T,>(x: T[] | undefined) => (Array.isArray(x) ? x : []);
  const out: LifeState = {
    ...base,
    ...s,
    schemaVersion: 2,
    createdAt: isDate(s.createdAt) ? s.createdAt : today,
    lastReview: isDate(s.lastReview) ? s.lastReview : today,
    jobs: arr(s.jobs),
    expenses: arr(s.expenses),
    debts: arr(s.debts).map((d) => ({ ...d, asOf: isDate(d.asOf) ? d.asOf : today })),
    goals: arr(s.goals),
    accounts: arr(s.accounts).length ? arr(s.accounts) : base.accounts,
    routes: s.routes ?? {},
    settings: { ...DEFAULT_SETTINGS, ...(s.settings ?? {}) },
    log: arr(s.log).filter((l) => isDate(l.date)),
    northStar: { ...base.northStar, ...(s.northStar ?? {}), anchors: arr(s.northStar?.anchors) },
    lifeEvents: arr(s.lifeEvents),
    careerTracks: arr(s.careerTracks).map((t) => ({ ...t, milestones: arr(t.milestones) })),
    actions: arr(s.actions),
  };
  out.settings.custom = (Array.isArray(out.settings.custom) && out.settings.custom.length === 5
    ? out.settings.custom.map(num)
    : DEFAULT_SETTINGS.custom) as Settings['custom'];
  return out;
}
