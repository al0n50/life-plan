/*
 * The engine.
 *
 * Simulates the plan day by day from its start date:
 *  - applies everything the user logged up to today (real paychecks, extra income,
 *    one-time spending, confirmed balances),
 *  - assumes the plan happened for anything they didn't confirm (marked `est`),
 *  - and keeps going into the future to find milestone dates.
 *
 * Each payday reserves its share of recurring expenses + debt minimums, then splits
 * what's left into buckets by the current phase.
 */
import { addDays, daysBetween, eachMonth, isDate, onDay } from './dates';
import { num, sum } from './format';
import { PHASE_ORDER, splitFor } from './phases';
import { expenseMonthly, dueDates, hasDueDate, paydays } from './schedule';
import { monthlyNet, paychecksPerMonth, paycheckNet } from './tax';
import type { Condition, DebtMode, Goal, ISODate, Job, LifeState, PhaseKey, Routes } from './types';

export interface Cell {
  v: number;
  /** True when this number assumes the plan happened rather than something the user confirmed. */
  est: boolean;
}
export interface DebtCell extends Cell {
  conf: ISODate | null;
  started: boolean;
}

/** Where one paycheck's leftover money went. */
export interface Moves {
  ef: number;
  debts: Record<string, number>;
  goals: Record<string, number>;
  inv: number;
  fun: number;
}

export type FutureItem =
  | { date: ISODate; kind: 'payday'; job: string; amount: number; reserve: number; moves: Moves | null }
  | { date: ISODate; kind: 'bill'; id: string; amount: number }
  | { date: ISODate; kind: 'debt'; id: string; amount: number; rollover: boolean };

export interface PendingPayday {
  date: ISODate;
  job: string;
  expected: number;
}

/** A part of an account: what the money in it is for. */
export type Part = 'chk' | 'ef' | 'inv' | 'tax' | `g:${string}`;

export interface AccountSnap {
  v: number;
  est: boolean;
  conf?: ISODate;
  parts: Part[];
}

export interface Snapshot {
  chk: Cell;
  ef: Cell;
  inv: Cell;
  tax: Cell;
  goals: Record<string, Cell>;
  debts: Record<string, DebtCell>;
  other: Record<string, Cell>;
  acct: Record<string, AccountSnap>;
  phase: PhaseKey;
  totalDebt: number;
}

/**
 * Projected dates, all after today. Keys:
 * debtFree · starter · efFull · `g:<goalId>` funded · `d:<debtId>` paid off · `p:<phase>` phase starts · `u:<goalId>` goal unlocks
 */
export type Marks = Record<string, ISODate>;

export interface SimResult {
  start: ISODate;
  now: Snapshot;
  marks: Marks;
  pending: PendingPayday[];
  future: FutureItem[];
  efTarget: number;
  expensesM: number;
  planMins: number;
  flexM: number;
  /** Take-home per month from jobs active today. */
  incomeM: number;
  routes: Routes;
}

export interface SimOptions {
  /** Override the debt mode (used to compare both approaches). */
  mode?: DebtMode;
  /** How many days of upcoming items to capture into `future`. Default 120. */
  captureDays?: number;
}

const EPS = 0.005;

export function jobActiveOn(j: Job, d: ISODate): boolean {
  return (!j.startDate || j.startDate <= d) && (!j.endDate || j.endDate >= d);
}

/** Fill in missing routes with sensible accounts. */
export function resolveRoutes(st: LifeState): Routes {
  const ids = st.accounts.map((a) => a.id);
  const r = { ...st.routes } as Routes;
  if (!r.pay || !ids.includes(r.pay)) r.pay = (st.accounts.find((a) => a.type === 'checking') ?? st.accounts[0])?.id ?? '';
  const savings = st.accounts.find((a) => a.type === 'hysa')?.id ?? st.accounts.find((a) => a.type === 'savings')?.id ?? r.pay;
  for (const k of ['emergency', 'goals', 'tax'] as const) if (!r[k] || !ids.includes(r[k])) r[k] = savings;
  if (!r.invest || !ids.includes(r.invest)) r.invest = st.accounts.find((a) => a.type === 'investing')?.id ?? savings;
  return r;
}

export function simulate(st: LifeState, today: ISODate, end: ISODate, opts: SimOptions = {}): SimResult {
  const mode = opts.mode ?? st.settings.debtMode;
  const order = PHASE_ORDER[mode] ?? PHASE_ORDER.asap;
  const R = resolveRoutes(st);
  const stateTax = num(st.settings.stateTax);

  const anchors = [st.createdAt, ...st.debts.map((d) => d.asOf), ...st.accounts.map((a) => a.asOf)].filter(isDate).sort();
  const start = anchors[0] ?? today;

  const expensesM = sum(st.expenses, expenseMonthly);
  const flexM = sum(
    st.expenses.filter((e) => !hasDueDate(e)),
    expenseMonthly,
  );
  const planMins = sum(st.debts, (d) => num(d.min));
  const efTarget = num(st.settings.efMonths) * (expensesM + planMins);
  const incomeAt = (d: ISODate) => sum(st.jobs.filter((j) => jobActiveOn(j, d)), (j) => monthlyNet(j, stateTax));

  // ---------- running state ----------
  const A = {
    chk: { v: 0, est: false } as Cell,
    ef: { v: 0, est: false } as Cell,
    inv: { v: 0, est: false } as Cell,
    tax: { v: 0, est: false } as Cell,
    goals: {} as Record<string, Cell>,
    debts: {} as Record<string, DebtCell>,
    other: {} as Record<string, Cell>,
    conf: {} as Record<string, ISODate>,
  };
  st.goals.forEach((g) => (A.goals[g.id] = { v: 0, est: false }));
  st.debts.forEach((d) => (A.debts[d.id] = { v: 0, est: false, conf: null, started: false }));
  st.accounts.forEach((a) => (A.other[a.id] = { v: 0, est: false }));

  const captureEnd = addDays(today, opts.captureDays ?? 120);
  const future: FutureItem[] = [];
  const marks: Marks = {};
  let curDate = start;
  let reachedIdx = -1;
  const capturing = () => curDate > today && curDate <= captureEnd;

  // ---------- accounts are made of parts ----------
  function partsIn(aid: string): Part[] {
    const p: Part[] = [];
    if (R.pay === aid) p.push('chk');
    if (R.emergency === aid) p.push('ef');
    if (R.goals === aid) st.goals.forEach((g) => p.push(`g:${g.id}`));
    if (R.invest === aid) p.push('inv');
    if (R.tax === aid) p.push('tax');
    return p;
  }
  const cell = (p: Part): Cell =>
    p === 'chk' ? A.chk : p === 'ef' ? A.ef : p === 'inv' ? A.inv : p === 'tax' ? A.tax : A.goals[p.slice(2)];
  const acctBal = (aid: string) => sum(partsIn(aid), (p) => cell(p).v) + (A.other[aid]?.v ?? 0);

  /** A confirmed account balance: scale its parts to match, or seed them if it was empty. */
  function setAcct(aid: string, v: number, date: ISODate) {
    if (!A.other[aid]) return;
    const parts = partsIn(aid);
    const cur = acctBal(aid);
    if (cur > 0.5) {
      const r = Math.max(0, v) / cur;
      parts.forEach((p) => (cell(p).v = Math.max(0, cell(p).v) * r));
      A.other[aid].v = Math.max(0, A.other[aid].v) * r;
    } else {
      let rest = Math.max(0, v);
      parts.forEach((p) => (cell(p).v = 0));
      A.other[aid].v = 0;
      // Seed goal parts with what the user said they'd saved, then the emergency fund, then the rest.
      for (const p of parts) {
        if (!p.startsWith('g:')) continue;
        const g = st.goals.find((x) => x.id === p.slice(2));
        const e = Math.min(rest, num(g?.saved));
        cell(p).v = e;
        rest -= e;
      }
      if (parts.includes('ef') && !parts.includes('chk')) {
        A.ef.v = rest;
        rest = 0;
      } else if (parts.includes('ef')) {
        const e = Math.min(rest, Math.max(efTarget, num(st.settings.starter)));
        A.ef.v = e;
        rest -= e;
      }
      if (rest > 0) {
        if (parts.includes('chk')) A.chk.v += rest;
        else A.other[aid].v += rest;
      }
    }
    parts.forEach((p) => (cell(p).est = false));
    A.other[aid].est = false;
    A.conf[aid] = date;
  }

  // ---------- conditions & phases ----------
  const totalDebt = () => sum(st.debts, (d) => (A.debts[d.id].started ? Math.max(0, A.debts[d.id].v) : num(d.balance)));
  const debtPaid = (id: string) => {
    const c = A.debts[id];
    if (!c) return true; // removed debt counts as paid
    return c.started && c.v <= EPS;
  };
  function met(c: Condition | undefined): boolean {
    if (!c) return true;
    switch (c.kind) {
      case 'debt_paid':
        return debtPaid(c.debtId);
      case 'all_debt_paid':
        return totalDebt() <= 0.5;
      case 'phase_reached':
        return reachedIdx >= order.indexOf(c.phase) && order.indexOf(c.phase) >= 0;
      case 'date':
        return curDate >= c.date;
    }
  }
  const goalOpen = (g: Goal) => A.goals[g.id].v < num(g.target) - EPS && met(g.unlockWhen);

  function phaseKey(): PhaseKey {
    const debtLeft = totalDebt() > 0.5;
    for (const k of order) {
      if (k === 'debt' && debtLeft) return k;
      if (k === 'starter' && A.ef.v < num(st.settings.starter)) return k;
      if (k === 'safety' && A.ef.v < efTarget) return k;
      if (k === 'goals' && st.goals.some(goalOpen)) return k;
      if (k === 'wealth') return k;
    }
    return 'wealth';
  }

  const activeDebts = () =>
    st.debts.filter((d) => A.debts[d.id].started && A.debts[d.id].v > EPS).sort((a, b) => num(b.apr) - num(a.apr));

  /** Pay extra toward debts, highest APR first. Returns what's left over. */
  function payExtra(x: number, est: boolean, out?: Record<string, number>): number {
    for (const d of activeDebts()) {
      if (x <= EPS) break;
      const a = A.debts[d.id];
      const take = Math.min(x, a.v);
      a.v -= take;
      x -= take;
      if (est) a.est = true;
      if (out) out[d.id] = (out[d.id] ?? 0) + take;
    }
    return x;
  }

  /** Split toward open goals in proportion to what each still needs. Returns what's left over. */
  function toGoals(x: number, est: boolean, out?: Record<string, number>): number {
    const open = st.goals.filter(goalOpen);
    const need = sum(open, (g) => num(g.target) - A.goals[g.id].v);
    if (!open.length || need <= 0) return x;
    let rest = x;
    for (const g of open) {
      const a = A.goals[g.id];
      const gap = num(g.target) - a.v;
      const share = Math.min(gap, (x * gap) / need);
      a.v += share;
      rest -= share;
      if (est && share > 0) a.est = true;
      if (out && share > 0) out[g.id] = share;
    }
    return rest;
  }

  /** Split money left after recurring + minimums into buckets for the current phase. */
  function distribute(left: number, est: boolean): Moves {
    const key = phaseKey();
    const sp = splitFor(key, st.settings);
    const mv: Moves = { ef: 0, debts: {}, goals: {}, inv: 0, fun: 0 };
    let [e, d, g, i] = sp.map((p) => (left * p) / 100);
    const f = (left * sp[4]) / 100;
    if (d > 0) e += payExtra(d, est, mv.debts); // nothing left to pay → it saves instead
    const room = Math.max(0, efTarget - A.ef.v);
    const put = key === 'goals' || key === 'wealth' ? Math.min(e, room) : e;
    if (put > 0) {
      A.ef.v += put;
      mv.ef = put;
      if (est) A.ef.est = true;
    }
    g += e - put;
    if (g > 0) i += toGoals(g, est, mv.goals);
    if (i > 0) {
      A.inv.v += i;
      mv.inv = i;
      if (est) A.inv.est = true;
    }
    mv.fun = f;
    const out = mv.ef + sum(Object.values(mv.debts), (x) => x) + sum(Object.values(mv.goals), (x) => x) + mv.inv;
    // Fun money stays in checking to be spent; everything else leaves it.
    A.chk.v -= out;
    if (est) A.chk.est = true;
    return mv;
  }

  const currentMins = () => (activeDebts().length ? planMins : 0);

  function paycheck(amount: number, share: number, est: boolean, jobId: string) {
    A.chk.v += amount;
    if (est) A.chk.est = true;
    const reserve = (expensesM + currentMins()) * share;
    const left = amount - reserve;
    const mv = left > 0 ? distribute(left, est) : null;
    if (capturing()) future.push({ date: curDate, kind: 'payday', job: jobId, amount, reserve: Math.min(reserve, amount), moves: mv });
  }

  function extraIncome(amount: number, selfEmployed: boolean, taxPct: number) {
    A.chk.v += amount;
    let a = amount;
    if (selfEmployed) {
      const t = (a * taxPct) / 100;
      A.tax.v += t;
      A.chk.v -= t;
      a -= t;
    }
    if (a > 0) distribute(a, false);
  }

  function spend(amount: number, from: string) {
    if (from === 'emergency') A.ef.v = Math.max(0, A.ef.v - amount);
    else if (from.startsWith('goal:') && A.goals[from.slice(5)]) {
      const a = A.goals[from.slice(5)];
      a.v = Math.max(0, a.v - amount);
    } else if (from.startsWith('acct:')) {
      const aid = from.slice(5);
      if (aid === R.pay) A.chk.v -= amount;
      else setAcct(aid, acctBal(aid) - amount, A.conf[aid] ?? curDate);
    } else A.chk.v -= amount;
  }

  function setBalance(where: string, v: number, date: ISODate) {
    if (where.startsWith('acct:')) setAcct(where.slice(5), v, date);
    else if (where === 'emergency') Object.assign(A.ef, { v, est: false });
    else if (where === 'invest') Object.assign(A.inv, { v, est: false });
    else if (where.startsWith('debt:') && A.debts[where.slice(5)]) Object.assign(A.debts[where.slice(5)], { v, est: false, conf: date, started: true });
    else if (where.startsWith('goal:') && A.goals[where.slice(5)]) Object.assign(A.goals[where.slice(5)], { v, est: false });
  }

  const rolledMonths = new Set<string>();
  function debtDue(id: string) {
    const d = st.debts.find((x) => x.id === id)!;
    const a = A.debts[id];
    if (!a.started || a.v <= EPS) return;
    a.v *= 1 + num(d.apr) / 1200;
    const pay = Math.min(num(d.min), a.v);
    a.v -= pay;
    A.chk.v -= pay;
    if (!a.conf || curDate > a.conf) {
      a.est = true;
      A.chk.est = true;
    }
    if (capturing()) future.push({ date: curDate, kind: 'debt', id, amount: pay, rollover: false });
    // Once a month, minimums from paid-off debts roll into the ones still open.
    const ym = curDate.slice(0, 7);
    if (activeDebts().length && !rolledMonths.has(ym)) {
      const freed = sum(
        st.debts.filter((x) => A.debts[x.id].started && A.debts[x.id].v <= EPS),
        (x) => num(x.min),
      );
      if (freed > 0) {
        rolledMonths.add(ym);
        const out: Record<string, number> = {};
        const left = payExtra(freed, true, out);
        A.chk.v -= freed - left;
        if (capturing()) for (const k of Object.keys(out)) future.push({ date: curDate, kind: 'debt', id: k, amount: out[k], rollover: true });
      }
    }
  }

  // ---------- build the event queue ----------
  // Priority within a day: 0 anchors, 1 income, 2 outflows, 3 confirmed balances.
  type Ev = { date: ISODate; pri: number; seq: number; fn: () => void };
  const ev: Ev[] = [];
  let seq = 0;
  const push = (date: ISODate, pri: number, fn: () => void) => ev.push({ date, pri, seq: seq++, fn });

  st.accounts.forEach((a) => push(isDate(a.asOf) ? a.asOf : start, 0, () => setAcct(a.id, num(a.balance), a.asOf)));
  st.debts.forEach((d) =>
    push(isDate(d.asOf) ? d.asOf : start, 0, () => Object.assign(A.debts[d.id], { v: num(d.balance), est: false, conf: d.asOf, started: true })),
  );

  const logs = st.log.filter((l) => isDate(l.date) && l.date <= today && l.date >= start);
  const usedLogs = new Set<string>();
  const pending: PendingPayday[] = [];

  for (const j of st.jobs) {
    const expected = paycheckNet(j, stateTax);
    for (const d of paydays(j, start, end)) {
      const incomeNow = incomeAt(d);
      const share = incomeNow > 0 ? monthlyNet(j, stateTax) / incomeNow / paychecksPerMonth(j.freq) : 0;
      let match: (typeof logs)[number] | null = null;
      if (d <= addDays(today, 5)) {
        let best = 99;
        for (const l of logs) {
          if (l.type !== 'paycheck' || l.job !== j.id || usedLogs.has(l.id)) continue;
          const gap = Math.abs(daysBetween(l.date, d));
          if (gap <= 5 && gap < best) {
            best = gap;
            match = l;
          }
        }
      }
      if (match && match.type === 'paycheck') {
        usedLogs.add(match.id);
        const amt = num(match.amount);
        push(match.date, 1, () => paycheck(amt, share, false, j.id));
      } else {
        if (d <= today) pending.push({ date: d, job: j.id, expected });
        push(d, 1, () => paycheck(expected, share, true, j.id));
      }
    }
  }

  for (const l of logs) {
    switch (l.type) {
      case 'paycheck':
        if (!usedLogs.has(l.id)) push(l.date, 1, () => extraIncome(num(l.amount), false, 0));
        break;
      case 'extra':
        push(l.date, 1, () => extraIncome(num(l.amount), l.selfEmployed, num(l.taxPct ?? st.settings.taxPct)));
        break;
      case 'spend':
        push(l.date, 2, () => spend(num(l.amount), String(l.from ?? '')));
        break;
      case 'balance':
        push(l.date, 3, () => setBalance(String(l.account ?? ''), num(l.amount), l.date));
        break;
    }
  }

  eachMonth(start, end, (y, m) =>
    st.debts.forEach((d) => {
      const dd = onDay(y, m, Math.round(num(d.due)) || 1);
      if (dd > (d.asOf || start) && dd <= end) push(dd, 2, () => debtDue(d.id));
    }),
  );

  for (const e of st.expenses) {
    for (const d of dueDates(e, addDays(start, 1), end)) {
      push(d, 2, () => {
        A.chk.v -= num(e.amount);
        A.chk.est = true;
        if (capturing()) future.push({ date: curDate, kind: 'bill', id: e.id, amount: num(e.amount) });
      });
    }
  }
  if (flexM > 0) {
    for (let d = addDays(start, 7); d <= end; d = addDays(d, 7)) {
      push(d, 2, () => {
        A.chk.v -= (flexM * 12) / 52;
        A.chk.est = true;
      });
    }
  }

  ev.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.pri - b.pri || a.seq - b.seq));

  // ---------- run ----------
  const already = new Set<string>(); // things already true today, so they're not "future" milestones
  const mark = (k: string) => {
    if (!marks[k] && !already.has(k)) marks[k] = curDate;
  };

  function record() {
    const pk = phaseKey();
    reachedIdx = Math.max(reachedIdx, order.indexOf(pk));
    if (curDate <= today) return;
    if (totalDebt() <= 0.5) mark('debtFree');
    if (A.ef.v >= num(st.settings.starter)) mark('starter');
    if (efTarget > 0 && A.ef.v >= efTarget - 0.5) mark('efFull');
    for (const g of st.goals) {
      if (num(g.target) > 0 && A.goals[g.id].v >= num(g.target) - 0.5) mark(`g:${g.id}`);
      if (g.unlockWhen && met(g.unlockWhen)) mark(`u:${g.id}`);
    }
    for (const d of st.debts) if (debtPaid(d.id)) mark(`d:${d.id}`);
    mark(`p:${pk}`);
  }

  let snap: Snapshot | null = null;
  function takeSnapshot(): Snapshot {
    const copy = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
    const acct: Record<string, AccountSnap> = {};
    for (const a of st.accounts) {
      const parts = partsIn(a.id);
      acct[a.id] = { v: acctBal(a.id), est: parts.some((p) => cell(p).est) || A.other[a.id].est, conf: A.conf[a.id], parts };
    }
    const phase = phaseKey();
    // Whatever is already true today isn't a future milestone.
    if (totalDebt() <= 0.5) already.add('debtFree');
    if (A.ef.v >= num(st.settings.starter)) already.add('starter');
    if (efTarget > 0 && A.ef.v >= efTarget - 0.5) already.add('efFull');
    for (const g of st.goals) {
      if (num(g.target) > 0 && A.goals[g.id].v >= num(g.target) - 0.5) already.add(`g:${g.id}`);
      if (g.unlockWhen && met(g.unlockWhen)) already.add(`u:${g.id}`);
    }
    for (const d of st.debts) if (debtPaid(d.id)) already.add(`d:${d.id}`);
    already.add(`p:${phase}`);
    return {
      chk: copy(A.chk),
      ef: copy(A.ef),
      inv: copy(A.inv),
      tax: copy(A.tax),
      goals: copy(A.goals),
      debts: copy(A.debts),
      other: copy(A.other),
      acct,
      phase,
      totalDebt: totalDebt(),
    };
  }

  for (const e of ev) {
    if (!snap && e.date > today) snap = takeSnapshot();
    curDate = e.date;
    e.fn();
    record();
  }
  if (!snap) snap = takeSnapshot();

  return {
    start,
    now: snap,
    marks,
    pending,
    future: future.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    efTarget,
    expensesM,
    planMins,
    flexM,
    incomeM: incomeAt(today),
    routes: R,
  };
}
