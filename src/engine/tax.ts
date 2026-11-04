// Paycheck estimate for hourly jobs: 2026 federal brackets, single filer, standard W-4.
// An estimate for planning; a real paystub always wins (log it).
import { num } from './format';
import type { Job, PayFreq } from './types';

export const TAX_2026 = {
  standardDeduction: 16100,
  brackets: [
    [12400, 0.1],
    [50400, 0.12],
    [105700, 0.22],
    [201775, 0.24],
    [256225, 0.32],
    [640600, 0.35],
    [Infinity, 0.37],
  ] as const,
  ssRate: 0.062,
  ssWageCap: 184500,
  medicareRate: 0.0145,
};

export const NO_STATE_TAX = 'Alaska, Florida, Nevada, New Hampshire, South Dakota, Tennessee, Texas, Washington, and Wyoming';

export const PERIODS: Record<PayFreq, number> = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 };
export const PAY_FREQ_LABEL: Record<PayFreq, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  semimonthly: 'Twice a month (15th and last day)',
  monthly: 'Monthly',
};
export const paychecksPerMonth = (f: PayFreq) => PERIODS[f] / 12;

export function federalIncomeTax(annualGross: number): number {
  const taxable = Math.max(0, annualGross - TAX_2026.standardDeduction);
  let tax = 0;
  let lo = 0;
  for (const [hi, rate] of TAX_2026.brackets) {
    if (taxable <= lo) break;
    tax += (Math.min(taxable, hi) - lo) * rate;
    lo = hi;
  }
  return tax;
}

export interface Stub {
  gross: number | null;
  fed: number;
  ss: number;
  med: number;
  state: number;
  other: number;
  net: number;
}

/** What one paycheck from this job looks like. */
export function paycheckStub(job: Job, stateTaxPct: number): Stub {
  const per = PERIODS[job.freq] ?? 26;
  if (job.payType !== 'hourly') {
    return { gross: null, fed: 0, ss: 0, med: 0, state: 0, other: 0, net: Math.max(0, num(job.amount)) };
  }
  const gross = (num(job.rate) * num(job.hours) * 52) / per;
  const annual = gross * per;
  const fed = federalIncomeTax(annual) / per;
  const ss = (Math.min(annual, TAX_2026.ssWageCap) * TAX_2026.ssRate) / per;
  const med = gross * TAX_2026.medicareRate;
  const state = (gross * num(stateTaxPct)) / 100;
  const other = num(job.otherDed);
  return { gross, fed, ss, med, state, other, net: Math.max(0, gross - fed - ss - med - state - other) };
}

export const paycheckNet = (job: Job, stateTaxPct: number) => paycheckStub(job, stateTaxPct).net;
export const monthlyNet = (job: Job, stateTaxPct: number) => paycheckNet(job, stateTaxPct) * paychecksPerMonth(job.freq);

/** Weekly hours that would produce this take-home per paycheck (to the nearest half hour). */
export function hoursForNet(job: Job, targetNet: number, stateTaxPct: number): number {
  let lo = 0;
  let hi = 80;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (paycheckNet({ ...job, hours: mid }, stateTaxPct) < targetNet) lo = mid;
    else hi = mid;
  }
  return Math.round(lo * 2) / 2;
}
