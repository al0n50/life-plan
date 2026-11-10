import { describe, expect, it } from 'vitest';

import { conditionStatus, describeCondition } from '../conditions';
import {
  addDays,
  addMonths,
  daysBetween,
  eachMonth,
  fromNow,
  isDate,
  isMonth,
  localToday,
  longDate,
  monthsBetween,
  nice,
  niceMonth,
  relDay,
  startOfWeek,
} from '../dates';
import { money, num, pct, sum, uid } from '../format';
import type { Snapshot } from '../simulate';
import { blankState } from '../state';
import type { LifeState } from '../types';
import { applyUpdate, isCheckIn } from '../updates';

const TODAY = '2026-11-04'; // a Wednesday

describe('dates', () => {
  it('adds days across month, year, and leap-day boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('adds months and clamps to the end of short months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-01-15', -2)).toBe('2025-11-15');
  });

  it('counts days and months between dates', () => {
    expect(daysBetween('2026-11-01', '2026-11-04')).toBe(3);
    expect(daysBetween('2026-11-04', '2026-11-01')).toBe(-3);
    // Across the US DST change (Nov 1, 2026) still a whole number of days
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
    expect(monthsBetween('2026-11-30', '2027-01-01')).toBe(2);
  });

  it('walks every month inclusively', () => {
    const seen: string[] = [];
    eachMonth('2026-11-20', '2027-02-01', (y, m) => seen.push(`${y}-${m}`));
    expect(seen).toEqual(['2026-10', '2026-11', '2027-0', '2027-1']);
  });

  it('finds Monday of the week (Sunday belongs to the previous week)', () => {
    expect(startOfWeek(TODAY)).toBe('2026-11-02');
    expect(startOfWeek('2026-11-08')).toBe('2026-11-02');
    expect(startOfWeek('2026-11-09')).toBe('2026-11-09');
  });

  it('validates ISO dates and months', () => {
    expect(isDate('2026-11-04')).toBe(true);
    expect(isDate('2026-11')).toBe(false);
    expect(isDate('1999-01-01')).toBe(false);
    expect(isDate(20261104)).toBe(false);
    expect(isMonth('2026-11')).toBe(true);
    expect(isMonth('2026-11-04')).toBe(false);
  });

  it('uses local calendar date for today', () => {
    expect(localToday(new Date(2026, 10, 4, 23, 59))).toBe('2026-11-04');
  });

  it('formats dates for display', () => {
    expect(nice(TODAY)).toBe('Nov 4');
    expect(nice('')).toBe('');
    expect(niceMonth('2026-11')).toBe('Nov 2026');
    expect(niceMonth(TODAY)).toBe('Nov 2026');
    expect(longDate(TODAY)).toBe('Wed, Nov 4, 2026');
  });

  it('describes days relative to today', () => {
    expect(relDay(TODAY, TODAY)).toBe('Today');
    expect(relDay('2026-11-05', TODAY)).toBe('Tomorrow');
    expect(relDay('2026-11-03', TODAY)).toBe('Yesterday');
    expect(relDay('2026-11-06', TODAY)).toBe('Fri');
    expect(relDay('2026-11-20', TODAY)).toBe('Nov 20');
    expect(relDay('2026-10-30', TODAY)).toBe('Fri, Oct 30');
  });

  it('describes months from now', () => {
    expect(fromNow('2026-11-30', TODAY)).toBe('this month');
    expect(fromNow('2026-12-01', TODAY)).toBe('next month');
    expect(fromNow('2027-05-01', TODAY)).toBe('in 6 months');
    expect(fromNow('2028-11-01', TODAY)).toBe('in 2 years');
    expect(fromNow('2029-02-01', TODAY)).toBe('in 2y 3m');
  });
});

describe('format', () => {
  it('formats money with a real minus sign', () => {
    expect(money(1250)).toBe('$1,250');
    expect(money(-40)).toBe('−$40');
    expect(money(-0.4)).toBe('$0');
    expect(money(12.5, { cents: true })).toBe('$12.50');
    expect(money(-0.01, { cents: true })).toBe('−$0.01');
  });

  it('formats compact money', () => {
    expect(money(999, { compact: true })).toBe('$999');
    expect(money(1500, { compact: true })).toBe('$1.5k');
    expect(money(250_000, { compact: true })).toBe('$250k');
    expect(money(2_500_000, { compact: true })).toBe('$2.5M');
    expect(money(-12_000_000, { compact: true })).toBe('−$12M');
  });

  it('parses user-typed numbers', () => {
    expect(num('$1,200.50')).toBe(1200.5);
    expect(num('-40')).toBe(-40);
    expect(num('')).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num('abc')).toBe(0);
    expect(num(NaN)).toBe(0);
    expect(num(Infinity)).toBe(0);
    expect(num(7)).toBe(7);
  });

  it('rounds percents, sums, and makes unique ids', () => {
    expect(pct(33.6)).toBe('34%');
    expect(sum([{ v: 1 }, { v: 2.5 }], (x) => x.v)).toBe(3.5);
    const ids = new Set(Array.from({ length: 500 }, () => uid('x')));
    expect(ids.size).toBe(500);
    expect([...ids].every((id) => id.startsWith('x'))).toBe(true);
  });
});

describe('conditions', () => {
  const snap = (over: Partial<Snapshot> = {}) => ({ debts: {}, totalDebt: 0, ...over }) as unknown as Snapshot;
  const ctx = (over: Partial<Parameters<typeof conditionStatus>[1]> = {}) => ({
    now: snap(),
    marks: {},
    order: ['debt', 'starter', 'safety', 'goals', 'wealth'] as const as never,
    phaseIdx: 0,
    today: TODAY,
    ...over,
  });

  it('treats no condition as met', () => {
    expect(conditionStatus(undefined, ctx())).toEqual({ met: true });
  });

  it('checks a specific debt and projects its payoff date', () => {
    const c = { kind: 'debt_paid', debtId: 'card' } as const;
    const owing = snap({ debts: { card: { started: true, v: 500 } } as never });
    expect(conditionStatus(c, ctx({ now: owing, marks: { 'd:card': '2027-03-01' } }))).toEqual({ met: false, when: '2027-03-01' });
    const paid = snap({ debts: { card: { started: true, v: 0 } } as never });
    expect(conditionStatus(c, ctx({ now: paid })).met).toBe(true);
    // A deleted debt can't block anything
    expect(conditionStatus(c, ctx()).met).toBe(true);
  });

  it('checks total debt, phase, and date conditions', () => {
    expect(conditionStatus({ kind: 'all_debt_paid' }, ctx({ now: snap({ totalDebt: 100 }), marks: { debtFree: '2027-06-01' } })))
      .toEqual({ met: false, when: '2027-06-01' });
    expect(conditionStatus({ kind: 'all_debt_paid' }, ctx()).met).toBe(true);
    expect(conditionStatus({ kind: 'phase_reached', phase: 'safety' }, ctx({ phaseIdx: 1, marks: { 'p:safety': '2027-01-01' } })))
      .toEqual({ met: false, when: '2027-01-01' });
    expect(conditionStatus({ kind: 'phase_reached', phase: 'safety' }, ctx({ phaseIdx: 2 })).met).toBe(true);
    expect(conditionStatus({ kind: 'date', date: '2026-11-04' }, ctx()).met).toBe(true);
    expect(conditionStatus({ kind: 'date', date: '2026-12-01' }, ctx())).toEqual({ met: false, when: '2026-12-01' });
  });

  it('describes conditions in plain words', () => {
    const st = { ...blankState(TODAY), debts: [{ id: 'card', name: 'Visa' }] } as unknown as LifeState;
    expect(describeCondition({ kind: 'debt_paid', debtId: 'card' }, st)).toBe('Visa is paid off');
    expect(describeCondition({ kind: 'debt_paid', debtId: 'gone' }, st)).toBe('That debt is paid off');
    expect(describeCondition({ kind: 'all_debt_paid' }, st)).toBe('All debt is paid off');
    expect(describeCondition({ kind: 'date', date: '2027-03-15' }, st)).toBe('Mar 2027');
    expect(describeCondition({ kind: 'phase_reached', phase: 'safety' }, st)).toMatch(/^You reach “.+”$/);
  });
});

describe('updates', () => {
  const base = () => blankState(TODAY);

  it('logs what happened without touching the plan', () => {
    let st = base();
    st = applyUpdate(st, { type: 'paycheck', job: 'j1', amount: 800, date: TODAY }, TODAY);
    st = applyUpdate(st, { type: 'no_paycheck', job: 'j1', date: '2026-11-18' }, TODAY);
    st = applyUpdate(st, { type: 'spend', what: 'Tires', amount: 400, date: TODAY, from: 'chk' as never }, TODAY);
    st = applyUpdate(st, { type: 'note', text: 'hi', date: TODAY }, TODAY);
    expect(st.log.map((l) => l.type)).toEqual(['paycheck', 'paycheck', 'spend', 'note']);
    expect(st.log[1]).toMatchObject({ amount: 0 });
    expect(new Set(st.log.map((l) => l.id)).size).toBe(4);
    expect(st.log.filter(isCheckIn)).toHaveLength(3);
    expect(st.jobs).toEqual(base().jobs);

    const id = st.log[2].id;
    st = applyUpdate(st, { type: 'remove_log', id }, TODAY);
    expect(st.log.find((l) => l.id === id)).toBeUndefined();
  });

  it('never mutates the input state', () => {
    const st = base();
    const before = JSON.stringify(st);
    applyUpdate(st, { type: 'note', text: 'x', date: TODAY }, TODAY);
    applyUpdate(st, { type: 'settings', patch: {} }, TODAY);
    expect(JSON.stringify(st)).toBe(before);
  });

  it('stamps account balances only when the balance changes', () => {
    let st = base();
    const acct = { id: 'a1', name: 'Checking', type: 'checking', balance: 100, asOf: '2026-01-01' } as const;
    st = applyUpdate(st, { type: 'upsert', list: 'accounts', item: { ...acct } as never }, TODAY);
    expect(st.accounts.find((a) => a.id === 'a1')?.asOf).toBe(TODAY);

    st = applyUpdate(st, { type: 'upsert', list: 'accounts', item: { ...acct, name: 'Main', asOf: '2026-01-01' } as never }, '2026-12-01');
    const a = st.accounts.find((x) => x.id === 'a1');
    expect(a?.name).toBe('Main');
    expect(a?.asOf).toBe('2026-01-01');
  });

  it('removing a job also removes its paycheck logs', () => {
    let st = { ...base(), jobs: [{ id: 'j1' }, { id: 'j2' }] } as unknown as LifeState;
    st = applyUpdate(st, { type: 'paycheck', job: 'j1', amount: 1, date: TODAY }, TODAY);
    st = applyUpdate(st, { type: 'paycheck', job: 'j2', amount: 2, date: TODAY }, TODAY);
    st = applyUpdate(st, { type: 'remove', list: 'jobs', id: 'j1' }, TODAY);
    expect(st.jobs.map((j) => j.id)).toEqual(['j2']);
    expect(st.log.map((l) => (l as { job?: string }).job)).toEqual(['j2']);
  });

  it('patches settings, routes, and profile and toggles actions', () => {
    let st = { ...base(), actions: [{ id: 'x', done: false }] } as unknown as LifeState;
    st = applyUpdate(st, { type: 'set_debt_mode', mode: 'steady' as never }, TODAY);
    expect(st.settings.debtMode).toBe('steady');
    st = applyUpdate(st, { type: 'profile', patch: { name: 'Alonso' } }, TODAY);
    expect(st.name).toBe('Alonso');
    st = applyUpdate(st, { type: 'toggle_action', id: 'x' }, TODAY);
    expect(st.actions[0].done).toBe(true);
    st = applyUpdate(st, { type: 'toggle_action', id: 'x' }, TODAY);
    expect(st.actions[0].done).toBe(false);
  });
});
