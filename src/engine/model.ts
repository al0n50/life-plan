// Everything a screen needs, derived from LifeState for a given day.
import { conditionStatus, type ConditionStatus } from './conditions';
import { addDays, daysBetween, isDate, isMonth } from './dates';
import { num, sum } from './format';
import { PHASE_ORDER, PHASES, splitFor } from './phases';
import { simulate, type FutureItem, type Marks, type Moves, type PendingPayday, type SimResult } from './simulate';
import { paycheckNet } from './tax';
import { isCheckIn } from './updates';
import type { Action, Debt, ISODate, LifeState, PhaseKey, Routes, Split } from './types';

export const REVIEW_AFTER_DAYS = 45;
const HORIZON_YEARS = 12;

export type BucketColor = 'mins' | 'emergency' | 'debt' | 'goals' | 'invest' | 'fun' | 'tax';

export interface MoveRow {
  label: string;
  /** "Move to High-yield savings", "Pay extra on Visa" */
  instruction: string;
  amount: number;
  color: BucketColor;
}

export type AgendaItem =
  | FutureItem
  | { date: ISODate; kind: 'pending'; job: string; amount: number }
  | { date: ISODate; kind: 'milestone'; title: string; color: BucketColor }
  | { date: ISODate; kind: 'goal_date'; title: string }
  | { date: ISODate; kind: 'life'; title: string; anchor: boolean }
  | { date: ISODate; kind: 'career'; title: string; track: string }
  | { date: ISODate; kind: 'action'; title: string; id: string };

export interface ActionView extends Action {
  status: ConditionStatus;
}

export interface Model extends SimResult {
  today: ISODate;
  /** Recurring expenses + minimums per month. */
  F: number;
  /** Take-home minus recurring + minimums. */
  toPlan: number;
  order: PhaseKey[];
  phase: PhaseKey;
  phaseIdx: number;
  split: Split;
  focus: Debt | null;
  otherMarks: Marks;
  lastUpdate: ISODate;
  daysAway: number;
  needsReview: boolean;
  paydays: Extract<FutureItem, { kind: 'payday' }>[];
  next: Extract<FutureItem, { kind: 'payday' }> | null;
  learned: Record<string, { avg: number; count: number }>;
  netWorth: number;
  actions: ActionView[];
  goalStatus: Record<string, ConditionStatus>;
  cond: (c: Action['unlockWhen']) => ConditionStatus;
}

export function buildModel(st: LifeState, today: ISODate): Model {
  const end = addDays(today, 365 * HORIZON_YEARS);
  const sim = simulate(st, today, end);
  const otherMode = st.settings.debtMode === 'asap' ? 'steady' : 'asap';
  const otherMarks = simulate(st, today, end, { mode: otherMode, captureDays: 0 }).marks;

  const order = [...(PHASE_ORDER[st.settings.debtMode] ?? PHASE_ORDER.asap)];
  // Already debt-free on the fast plan: the debt phase isn't part of your story anymore.
  if (order[0] === 'debt' && sim.now.totalDebt <= 0.5 && sim.now.phase !== 'debt') order.shift();
  const phase = sim.now.phase;
  const phaseIdx = Math.max(0, order.indexOf(phase));

  const focus =
    st.debts
      .filter((d) => (sim.now.debts[d.id]?.v ?? 0) > 0.005)
      .sort((a, b) => num(b.apr) - num(a.apr))[0] ?? null;

  const recent =
    st.log
      .filter((l) => isDate(l.date) && l.date <= today && isCheckIn(l))
      .map((l) => l.date)
      .sort()
      .pop() ?? st.createdAt;
  const lastUpdate = [recent, st.lastReview || st.createdAt].sort().pop()!;
  const daysAway = daysBetween(lastUpdate, today);

  const learned: Model['learned'] = {};
  for (const j of st.jobs) {
    const got = st.log
      .filter((l) => l.type === 'paycheck' && l.job === j.id && num(l.amount) > 0)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 3);
    if (got.length >= 2) {
      const avg = sum(got, (l) => (l.type === 'paycheck' ? num(l.amount) : 0)) / got.length;
      const exp = paycheckNet(j, st.settings.stateTax);
      if (exp > 0 && Math.abs(avg - exp) / exp > 0.05) learned[j.id] = { avg, count: got.length };
    }
  }

  const paydays = sim.future.filter((f): f is Extract<FutureItem, { kind: 'payday' }> => f.kind === 'payday');
  const ctx = { now: sim.now, marks: sim.marks, order, phaseIdx, today };
  const cond = (c: Action['unlockWhen']) => conditionStatus(c, ctx);
  const netWorth = sum(Object.values(sim.now.acct), (a) => a.v) - sim.now.totalDebt;

  return {
    ...sim,
    today,
    F: sim.expensesM + sim.planMins,
    toPlan: sim.incomeM - (sim.expensesM + sim.planMins),
    order,
    phase,
    phaseIdx,
    split: splitFor(phase, st.settings),
    focus,
    otherMarks,
    lastUpdate,
    daysAway,
    needsReview: st.onboarded && daysAway >= REVIEW_AFTER_DAYS,
    pending: sim.pending.filter((p) => p.date >= addDays(today, -120)).sort((a, b) => (a.date < b.date ? 1 : -1)),
    paydays,
    next: paydays[0] ?? null,
    learned,
    netWorth,
    actions: st.actions.map((a) => ({ ...a, status: cond(a.unlockWhen) })),
    goalStatus: Object.fromEntries(st.goals.map((g) => [g.id, cond(g.unlockWhen)])),
    cond,
  };
}

// ---------------- Helpers screens share ----------------

export const accountName = (st: LifeState, id: string | undefined) => st.accounts.find((a) => a.id === id)?.name ?? 'checking';
export const jobName = (st: LifeState, id: string) => st.jobs.find((j) => j.id === id)?.name ?? 'Removed job';

/** Turn a paycheck's moves into "do this" rows. With no simulated moves, estimate from the current split. */
export function movesFor(st: LifeState, M: Model, amount: number, reserve: number, mv: Moves | null): MoveRow[] {
  const R: Routes = M.routes;
  const rows: MoveRow[] = [];
  const to = (id: string) => `Move to ${accountName(st, id)}`;
  if (!mv) {
    const left = Math.max(0, amount - reserve);
    const sp = M.split;
    const part = (i: number) => (left * sp[i]) / 100;
    if (part(0) > 0.5) rows.push({ label: 'Emergency fund', instruction: to(R.emergency), amount: part(0), color: 'emergency' });
    if (part(1) > 0.5)
      rows.push({ label: 'Extra debt payment', instruction: M.focus ? `Pay extra on ${M.focus.name}` : 'Extra debt payment', amount: part(1), color: 'debt' });
    if (part(2) > 0.5) rows.push({ label: 'Big goals', instruction: to(R.goals), amount: part(2), color: 'goals' });
    if (part(3) > 0.5) rows.push({ label: 'Investing', instruction: to(R.invest), amount: part(3), color: 'invest' });
    if (part(4) > 0.5) rows.push({ label: 'Guilt-free fun', instruction: `Stays in ${accountName(st, R.pay)}. Spend it, no guilt.`, amount: part(4), color: 'fun' });
    return rows;
  }
  if (mv.ef > 0.5) rows.push({ label: 'Emergency fund', instruction: to(R.emergency), amount: mv.ef, color: 'emergency' });
  for (const [id, v] of Object.entries(mv.debts)) {
    if (v > 0.5) rows.push({ label: 'Extra debt payment', instruction: `Pay extra on ${st.debts.find((d) => d.id === id)?.name ?? 'debt'}`, amount: v, color: 'debt' });
  }
  for (const [id, v] of Object.entries(mv.goals)) {
    if (v > 0.5) rows.push({ label: st.goals.find((g) => g.id === id)?.name ?? 'Goal', instruction: to(R.goals), amount: v, color: 'goals' });
  }
  if (mv.inv > 0.5) rows.push({ label: 'Investing', instruction: to(R.invest), amount: mv.inv, color: 'invest' });
  if (mv.fun > 0.5) rows.push({ label: 'Guilt-free fun', instruction: `Stays in ${accountName(st, R.pay)}. Spend it, no guilt.`, amount: mv.fun, color: 'fun' });
  return rows;
}

/** Everything dated in the next `days` days: money moves, milestones, goal dates, life events, career steps, actions. */
export function agenda(st: LifeState, M: Model, days: number): AgendaItem[] {
  const today = M.today;
  const end = addDays(today, days);
  const inRange = (d: ISODate | undefined) => !!d && d > today && d <= end;
  const items: AgendaItem[] = M.future.filter((f) => f.date <= end);

  const ms: [string, string, BucketColor][] = [
    ['debtFree', 'You’re debt-free', 'debt'],
    ['starter', 'Starter emergency fund reached', 'emergency'],
    ['efFull', 'Emergency fund fully funded', 'emergency'],
  ];
  for (const [k, title, color] of ms) if (inRange(M.marks[k])) items.push({ date: M.marks[k], kind: 'milestone', title, color });
  for (const g of st.goals) {
    if (inRange(M.marks[`g:${g.id}`])) items.push({ date: M.marks[`g:${g.id}`], kind: 'milestone', title: `${g.name} fully saved`, color: 'goals' });
    if (inRange(M.marks[`u:${g.id}`])) items.push({ date: M.marks[`u:${g.id}`], kind: 'milestone', title: `${g.name} unlocks`, color: 'goals' });
    if (isMonth(g.date) && inRange(`${g.date}-01`)) items.push({ date: `${g.date}-01`, kind: 'goal_date', title: `${g.name} target date` });
  }
  for (const d of st.debts) if (inRange(M.marks[`d:${d.id}`])) items.push({ date: M.marks[`d:${d.id}`], kind: 'milestone', title: `${d.name} paid off`, color: 'debt' });
  for (const p of M.pending) if (p.date >= addDays(today, -7)) items.push({ date: p.date, kind: 'pending', job: p.job, amount: p.expected });
  for (const e of st.lifeEvents) if (e.date >= today && e.date <= end) items.push({ date: e.date, kind: 'life', title: e.title, anchor: e.kind === 'anchor' });
  for (const t of st.careerTracks)
    for (const m of t.milestones) if (m.date && m.date >= today && m.date <= end && m.status !== 'done') items.push({ date: m.date, kind: 'career', title: m.title, track: t.name });
  for (const a of st.actions) if (!a.done && a.due && a.due >= today && a.due <= end) items.push({ date: a.due, kind: 'action', title: a.title, id: a.id });

  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export const phaseName = (k: PhaseKey) => PHASES[k].name;
export type { PendingPayday };
