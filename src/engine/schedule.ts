// When money moves: paydays and bill due dates.
import { addDays, daysBetween, dayOfMonth, eachMonth, isDate, onDay, parse } from './dates';
import { num } from './format';
import type { Expense, ExpenseFreq, ISODate, Job } from './types';

/** Step a weekly/biweekly anchor into [from, to]. */
function stepped(anchor: ISODate, step: number, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const offset = daysBetween(anchor, from);
  // First occurrence on/after `from`, whether the anchor is before or after the range.
  let d = addDays(anchor, Math.ceil(offset / step) * step);
  for (; d <= to; d = addDays(d, step)) out.push(d);
  return out;
}

/** Every payday for this job in [from, to], respecting its start/end dates. */
export function paydays(job: Job, from: ISODate, to: ISODate): ISODate[] {
  if (job.startDate && job.startDate > from) from = job.startDate;
  if (job.endDate && job.endDate < to) to = job.endDate;
  if (!from || !to || from > to) return [];
  const out: ISODate[] = [];
  switch (job.freq) {
    case 'weekly':
    case 'biweekly': {
      const anchor = isDate(job.nextPay) ? job.nextPay : job.startDate;
      if (!isDate(anchor)) return [];
      return stepped(anchor, job.freq === 'weekly' ? 7 : 14, from, to);
    }
    case 'monthly': {
      const day = isDate(job.nextPay) ? dayOfMonth(job.nextPay) : 1;
      eachMonth(from, to, (y, m) => {
        const d = onDay(y, m, day);
        if (d >= from && d <= to) out.push(d);
      });
      return out;
    }
    case 'semimonthly':
      eachMonth(from, to, (y, m) => {
        for (const d of [onDay(y, m, 15), onDay(y, m, 31)]) if (d >= from && d <= to) out.push(d);
      });
      return out;
  }
}

export const EXPENSE_PER_MONTH: Record<ExpenseFreq, number> = { monthly: 1, weekly: 52 / 12, biweekly: 26 / 12, yearly: 1 / 12 };
export const EXPENSE_FREQ_LABEL: Record<ExpenseFreq, string> = { monthly: 'Monthly', weekly: 'Weekly', biweekly: 'Every 2 weeks', yearly: 'Yearly' };
export const expenseMonthly = (e: Expense) => num(e.amount) * (EXPENSE_PER_MONTH[e.freq] ?? 1);

/** A bill with a usable due date. Bills without one are treated as everyday spending. */
export function hasDueDate(e: Expense): boolean {
  if (e.kind !== 'bill') return false;
  if (e.freq === 'monthly') return num(e.dueDay) >= 1 || isDate(e.nextDue);
  return isDate(e.nextDue);
}

export function dueDates(e: Expense, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  if (!hasDueDate(e) || from > to) return out;
  if (e.freq === 'monthly') {
    const day = num(e.dueDay) >= 1 ? Math.min(31, Math.round(num(e.dueDay))) : dayOfMonth(e.nextDue!);
    eachMonth(from, to, (y, m) => {
      const d = onDay(y, m, day);
      if (d >= from && d <= to) out.push(d);
    });
    return out;
  }
  if (e.freq === 'yearly') {
    const t = parse(e.nextDue!);
    for (let y = parse(from).getUTCFullYear(); y <= parse(to).getUTCFullYear(); y++) {
      const d = onDay(y, t.getUTCMonth(), t.getUTCDate());
      if (d >= from && d <= to) out.push(d);
    }
    return out;
  }
  return stepped(e.nextDue!, e.freq === 'weekly' ? 7 : 14, from, to);
}

export const nextDueDate = (e: Expense, today: ISODate) => dueDates(e, today, addDays(today, 400))[0] ?? '';
