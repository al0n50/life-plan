// Calendar math on ISO date strings, done in UTC so time zones and DST never shift a day.
import type { ISODate, ISOMonth } from './types';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MS = 86_400_000;

export function parse(s: ISODate): Date {
  const [y, m, d] = String(s).split('-').map(Number);
  const t = new Date(Date.UTC(2000, 0, 1));
  t.setUTCFullYear(y, (m || 1) - 1, d || 1);
  return t;
}

export const fmt = (t: Date): ISODate => t.toISOString().slice(0, 10);

/** Today in the device's local time zone, as an ISO date. */
export function localToday(now: Date = new Date()): ISODate {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function addDays(s: ISODate, k: number): ISODate {
  const t = parse(s);
  t.setUTCDate(t.getUTCDate() + k);
  return fmt(t);
}

export function addMonths(s: ISODate, k: number): ISODate {
  const t = parse(s);
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth() + k;
  const ny = y + Math.floor(m / 12);
  const nm = ((m % 12) + 12) % 12;
  return onDay(ny, nm, t.getUTCDate());
}

export const daysBetween = (a: ISODate, b: ISODate) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY_MS);
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** The given day in month m (0-based), clamped to the month's last day. */
export function onDay(y: number, m: number, day: number): ISODate {
  const t = new Date(Date.UTC(2000, 0, 1));
  t.setUTCFullYear(y, m, Math.max(1, Math.min(day, daysInMonth(y, m))));
  return fmt(t);
}

/** Calls fn(year, monthIndex) for every month from `from` through `to`, inclusive. */
export function eachMonth(from: ISODate, to: ISODate, fn: (y: number, m: number) => void) {
  const a = parse(from);
  const b = parse(to);
  let y = a.getUTCFullYear();
  let m = a.getUTCMonth();
  while (y < b.getUTCFullYear() || (y === b.getUTCFullYear() && m <= b.getUTCMonth())) {
    fn(y, m);
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
}

export const weekday = (s: ISODate) => parse(s).getUTCDay();
export const dayOfMonth = (s: ISODate) => parse(s).getUTCDate();
export const monthOf = (s: ISODate): ISOMonth => s.slice(0, 7);

/** Monday of the week containing s. */
export function startOfWeek(s: ISODate): ISODate {
  return addDays(s, -((weekday(s) + 6) % 7));
}

export const isDate = (s: unknown): s is ISODate =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && +s.slice(0, 4) >= 2000 && +s.slice(0, 4) <= 2100;
export const isMonth = (s: unknown): s is ISOMonth =>
  typeof s === 'string' && /^\d{4}-\d{2}$/.test(s) && +s.slice(0, 4) >= 2000 && +s.slice(0, 4) <= 2100;

export function monthsBetween(a: ISODate, b: ISODate): number {
  const x = parse(a);
  const y = parse(b);
  return (y.getUTCFullYear() - x.getUTCFullYear()) * 12 + (y.getUTCMonth() - x.getUTCMonth());
}

// ---------------- Formatting ----------------

/** "Nov 4" */
export const nice = (s: ISODate) => (s ? `${MON[parse(s).getUTCMonth()]} ${parse(s).getUTCDate()}` : '');
/** "Nov 2026" from a date or month. */
export const niceMonth = (s: ISODate | ISOMonth) => {
  if (!s) return '';
  const t = parse(s.length === 7 ? `${s}-01` : s);
  return `${MON[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
};
/** "Wed, Nov 4, 2026" */
export const longDate = (s: ISODate) => `${WD[weekday(s)]}, ${nice(s)}, ${parse(s).getUTCFullYear()}`;
export const wdName = (s: ISODate) => WD[weekday(s)];

/** "Today", "Tomorrow", "Fri", or "Nov 14". */
export function relDay(s: ISODate, today: ISODate): string {
  const k = daysBetween(today, s);
  if (k === 0) return 'Today';
  if (k === 1) return 'Tomorrow';
  if (k === -1) return 'Yesterday';
  if (k < 0) return `${wdName(s)}, ${nice(s)}`;
  if (k < 7) return wdName(s);
  return nice(s);
}

/** "in 4 months", "in 2y 3m" */
export function fromNow(s: ISODate, today: ISODate): string {
  const m = monthsBetween(today, s);
  if (m <= 0) return 'this month';
  if (m === 1) return 'next month';
  if (m < 24) return `in ${m} months`;
  const y = Math.floor(m / 12);
  return m % 12 ? `in ${y}y ${m % 12}m` : `in ${y} years`;
}
