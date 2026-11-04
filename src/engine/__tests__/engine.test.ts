import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import { sum } from '../format';
import { agenda, buildModel } from '../model';
import { dueDates, paydays } from '../schedule';
import { simulate } from '../simulate';
import { blankState, exampleState, migrateV1, sanitize } from '../state';
import { hoursForNet, paycheckStub } from '../tax';
import type { Job, LifeState } from '../types';
import { applyUpdate } from '../updates';

const TODAY = '2026-11-04';
const END = addDays(TODAY, 365 * 5);

const hourly = (over: Partial<Job> = {}): Job => ({
  id: 'j1',
  name: 'Job',
  payType: 'hourly',
  rate: 16.5,
  hours: 30,
  amount: 0,
  freq: 'biweekly',
  nextPay: '2026-10-09',
  otherDed: 0,
  ...over,
});

/** A minimal plan that starts on `start` with one checking account. */
function plan(start: string, over: Partial<LifeState> = {}): LifeState {
  const st = blankState(start);
  st.onboarded = true;
  st.accounts = [{ id: 'chk', name: 'Checking', type: 'checking', balance: 0, asOf: start }];
  return { ...st, ...over };
}

const acctTotal = (s: ReturnType<typeof simulate>) => sum(Object.values(s.now.acct), (a) => a.v);

describe('tax', () => {
  it('estimates a biweekly hourly paycheck (2026 single filer)', () => {
    const s = paycheckStub(hourly(), 0);
    expect(s.gross).toBeCloseTo(990, 2); // 16.5 × 30 × 2
    // Annual 25,740 − 16,100 standard deduction = 9,640 at 10% = 964 / 26
    expect(s.fed).toBeCloseTo(964 / 26, 2);
    expect(s.ss).toBeCloseTo(990 * 0.062, 2);
    expect(s.med).toBeCloseTo(990 * 0.0145, 2);
    expect(s.net).toBeCloseTo(990 - 964 / 26 - 61.38 - 14.355, 2);
  });
  it('applies state tax and other deductions', () => {
    const base = paycheckStub(hourly(), 0).net;
    expect(paycheckStub(hourly({ otherDed: 25 }), 5).net).toBeCloseTo(base - 990 * 0.05 - 25, 2);
  });
  it('uses the stated amount for non-hourly jobs', () => {
    expect(paycheckStub(hourly({ payType: 'amount', amount: 712 }), 0).net).toBe(712);
  });
  it('inverts take-home back to hours', () => {
    const net = paycheckStub(hourly({ hours: 24 }), 0).net;
    expect(hoursForNet(hourly(), net, 0)).toBe(24);
  });
});

describe('schedule', () => {
  it('steps biweekly paydays from an anchor after the range start', () => {
    expect(paydays(hourly({ nextPay: '2026-11-20' }), '2026-11-01', '2026-12-31')).toEqual(['2026-11-06', '2026-11-20', '2026-12-04', '2026-12-18']);
  });
  it('clamps monthly paydays on the 31st to short months, including leap years', () => {
    const j = hourly({ freq: 'monthly', nextPay: '2028-01-31' });
    expect(paydays(j, '2028-01-01', '2028-03-31')).toEqual(['2028-01-31', '2028-02-29', '2028-03-31']);
  });
  it('pays semimonthly on the 15th and last day', () => {
    expect(paydays(hourly({ freq: 'semimonthly' }), '2027-02-01', '2027-02-28')).toEqual(['2027-02-15', '2027-02-28']);
  });
  it('respects a future job start date', () => {
    const d = paydays(hourly({ startDate: '2026-12-01' }), '2026-11-01', '2026-12-31');
    expect(d[0] >= '2026-12-01').toBe(true);
  });
  it('schedules yearly and monthly bills', () => {
    expect(dueDates({ id: 'e', name: 'Reg', amount: 85, freq: 'yearly', kind: 'bill', nextDue: '2027-03-15' }, '2026-11-01', '2028-12-31')).toEqual([
      '2027-03-15',
      '2028-03-15',
    ]);
    expect(dueDates({ id: 'e', name: 'Rent', amount: 1, freq: 'monthly', kind: 'bill', dueDay: 31 }, '2027-02-01', '2027-04-30')).toEqual([
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
    ]);
    expect(dueDates({ id: 'e', name: 'Food', amount: 1, freq: 'monthly', kind: 'spending' }, '2027-02-01', '2027-04-30')).toEqual([]);
  });
});

describe('simulate', () => {
  it('conserves money: every paycheck lands somewhere in your accounts', () => {
    const st = plan('2026-10-01', { jobs: [hourly({ nextPay: '2026-10-09' })] });
    const s = simulate(st, TODAY, END);
    const net = paycheckStub(hourly(), 0).net;
    const count = paydays(hourly(), '2026-10-01', TODAY).length;
    expect(acctTotal(s)).toBeCloseTo(net * count, 4);
  });

  it('marks past paydays without a log as pending, and logged ones replace the estimate', () => {
    const st = plan('2026-10-01', { jobs: [hourly()] });
    const before = simulate(st, TODAY, END);
    expect(before.pending.map((p) => p.date)).toEqual(['2026-10-09', '2026-10-23']);
    expect(before.now.chk.est).toBe(true);

    const logged = applyUpdate(applyUpdate(st, { type: 'paycheck', job: 'j1', amount: 800, date: '2026-10-09' }, TODAY), { type: 'paycheck', job: 'j1', amount: 810, date: '2026-10-24' }, TODAY);
    const after = simulate(logged, TODAY, END);
    expect(after.pending).toEqual([]);
    expect(after.now.chk.est).toBe(false);
    expect(acctTotal(after)).toBeCloseTo(1610, 4);
  });

  it('treats a $0 paycheck log as "not paid"', () => {
    const st = applyUpdate(plan('2026-10-01', { jobs: [hourly()] }), { type: 'no_paycheck', job: 'j1', date: '2026-10-09' }, TODAY);
    const s = simulate(st, TODAY, END);
    expect(s.pending.map((p) => p.date)).toEqual(['2026-10-23']);
  });

  it('a confirmed balance replaces the estimate', () => {
    const st = applyUpdate(plan('2026-10-01', { jobs: [hourly()] }), { type: 'balance', account: 'acct:chk', amount: 500, date: '2026-11-01' }, TODAY);
    const s = simulate(st, TODAY, END);
    expect(s.now.acct.chk.v).toBeCloseTo(500, 4);
    expect(s.now.acct.chk.est).toBe(false);
    expect(s.now.acct.chk.conf).toBe('2026-11-01');
  });

  it('puts debt first on the fast plan and skips it on the steady plan', () => {
    const debts = [{ id: 'd1', name: 'Card', kind: 'credit_card' as const, balance: 3000, apr: 25, min: 90, due: 15, asOf: '2026-10-01' }];
    const st = plan('2026-10-01', { jobs: [hourly()], debts });
    expect(simulate(st, TODAY, END).now.phase).toBe('debt');
    // Steady: debt is paid in the background, never a phase.
    const steadySim = simulate(st, TODAY, END, { mode: 'steady', captureDays: 400 });
    expect(steadySim.now.phase).not.toBe('debt');
    expect(Object.keys(steadySim.marks).some((k) => k === 'p:debt')).toBe(false);
    expect(steadySim.future.filter((f) => f.kind === 'payday').every((f) => f.kind === 'payday' && !Object.keys(f.moves?.debts ?? {}).length)).toBe(true);
    const fast = simulate(st, TODAY, END).marks.debtFree;
    const steady = simulate(st, TODAY, END, { mode: 'steady' }).marks.debtFree;
    expect(fast && steady && fast < steady).toBe(true);
  });

  it('rolls a paid-off minimum into the next debt', () => {
    const debts = [
      { id: 'small', name: 'Store card', kind: 'credit_card' as const, balance: 150, apr: 20, min: 50, due: 10, asOf: '2026-10-01' },
      { id: 'big', name: 'Loan', kind: 'personal' as const, balance: 5000, apr: 10, min: 100, due: 10, asOf: '2026-10-01' },
    ];
    const st = plan('2026-10-01', { jobs: [hourly()], debts });
    const s = simulate(st, TODAY, END, { mode: 'steady', captureDays: 365 });
    expect(s.marks['d:small']).toBeDefined();
    expect(s.future.some((f) => f.kind === 'debt' && f.id === 'big' && f.rollover)).toBe(true);
  });

  it('keeps a paused goal at $0 until its condition is met', () => {
    const debts = [{ id: 'd1', name: 'Card', kind: 'credit_card' as const, balance: 1500, apr: 25, min: 60, due: 15, asOf: '2026-10-01' }];
    const goals = [{ id: 'trip', name: 'Trip', target: 2000, date: '2028-06', saved: 0, unlockWhen: { kind: 'debt_paid' as const, debtId: 'd1' } }];
    // Custom split sends money to goals from day one, so only the lock holds it back.
    const st = plan('2026-10-01', { jobs: [hourly()], debts, goals, settings: { ...blankState(TODAY).settings, useCustom: true, custom: [10, 40, 30, 0, 20] } });
    const s = simulate(st, TODAY, END, { captureDays: 400 });
    const unlock = s.marks['u:trip'];
    const paidOff = s.marks['d:d1'];
    expect(unlock).toBeDefined();
    expect(unlock).toBe(paidOff);
    const before = s.future.filter((f) => f.kind === 'payday' && f.date < unlock);
    expect(before.every((f) => f.kind === 'payday' && !(f.moves?.goals.trip ?? 0))).toBe(true);
    const after = s.future.filter((f) => f.kind === 'payday' && f.date > unlock);
    expect(after.some((f) => f.kind === 'payday' && (f.moves?.goals.trip ?? 0) > 0)).toBe(true);
  });

  it('adds future income from a job start date', () => {
    const st = plan('2026-10-01', { jobs: [hourly(), hourly({ id: 'j2', name: 'New job', startDate: '2027-01-01', nextPay: '2027-01-08' })] });
    const s = simulate(st, TODAY, END, { captureDays: 120 });
    const j2 = s.future.filter((f) => f.kind === 'payday' && f.job === 'j2');
    expect(j2.length).toBeGreaterThan(0);
    expect(j2.every((f) => f.date >= '2027-01-01')).toBe(true);
    expect(s.incomeM).toBeCloseTo(paycheckStub(hourly(), 0).net * (26 / 12), 4);
  });
});

describe('model', () => {
  it('builds a full model from the example plan', () => {
    const st = exampleState(TODAY);
    const M = buildModel(st, TODAY);
    expect(M.phase).toBe('debt');
    expect(M.pending).toHaveLength(1);
    expect(M.next).not.toBeNull();
    expect(M.needsReview).toBe(false);
    expect(M.marks['d:d_card']).toBeDefined();
    expect(M.goalStatus.g_trip.met).toBe(false);
    expect(M.goalStatus.g_trip.when).toBe(M.marks['d:d_card']);
    expect(M.actions.find((a) => a.id === 'ac4')?.status.met).toBe(false);
    const items = agenda(st, M, 60);
    expect(items.some((i) => i.kind === 'payday')).toBe(true);
    expect(items.some((i) => i.kind === 'career')).toBe(true);
  });

  it('asks for a review after 45 days without an update', () => {
    const st = { ...plan('2026-08-01', { jobs: [hourly({ nextPay: '2026-08-07' })] }), lastReview: '2026-08-01' };
    expect(buildModel(st, '2026-09-10').needsReview).toBe(false);
    expect(buildModel(st, '2026-09-20').needsReview).toBe(true);
  });
});

describe('updates & state', () => {
  it('stamps a debt balance edit with today', () => {
    const st = plan('2026-10-01', { debts: [{ id: 'd1', name: 'Card', kind: 'credit_card', balance: 3000, apr: 25, min: 90, due: 15, asOf: '2026-10-01' }] });
    const next = applyUpdate(st, { type: 'upsert', list: 'debts', item: { ...st.debts[0], balance: 2500 } }, TODAY);
    expect(next.debts[0].asOf).toBe(TODAY);
    const same = applyUpdate(st, { type: 'upsert', list: 'debts', item: { ...st.debts[0], apr: 19.9 } }, TODAY);
    expect(same.debts[0].asOf).toBe('2026-10-01');
  });

  it('migrates v1 saved data', () => {
    const v1 = {
      name: 'Alex',
      income: [{ id: 'i', name: 'Pay', amount: 2000, frequency: 'biweekly' }],
      bills: [{ id: 'b', name: 'Rent', amount: 1400, frequency: 'monthly', dueDay: 1, essential: true }],
      debts: [{ id: 'd', name: 'Card', balance: 1000, apr: 20, minPayment: 40, dueDay: 15 }],
      assets: [
        { id: 'a', name: 'Checking', kind: 'cash', value: 300 },
        { id: 'c', name: 'Car', kind: 'vehicle', value: 9000 },
      ],
      goals: [{ id: 'g', name: 'Move', targetAmount: 3000, targetDate: '2027-06-01', saved: 0 }],
    };
    const st = migrateV1(v1, true, TODAY);
    expect(st.jobs[0]).toMatchObject({ payType: 'amount', amount: 2000, freq: 'biweekly', nextPay: '2026-11-06' });
    expect(simulate(st, TODAY, END, { captureDays: 30 }).future.some((f) => f.kind === 'payday' && f.job === 'i')).toBe(true);
    expect(st.expenses[0]).toMatchObject({ kind: 'bill', dueDay: 1 });
    expect(st.debts[0]).toMatchObject({ min: 40, due: 15, asOf: TODAY });
    expect(st.accounts).toHaveLength(1);
    expect(st.goals[0].date).toBe('2027-06');
    expect(() => buildModel(st, TODAY)).not.toThrow();
  });

  it('repairs partial saved state', () => {
    const st = sanitize({ schemaVersion: 2, jobs: [hourly()], settings: { debtMode: 'steady' } }, TODAY)!;
    expect(st.accounts.length).toBe(1);
    expect(st.settings.efMonths).toBe(3);
    expect(st.settings.debtMode).toBe('steady');
    expect(sanitize({ schemaVersion: 1 }, TODAY)).toBeNull();
  });
});
