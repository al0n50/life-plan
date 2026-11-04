/** Whole dollars, with a real minus sign for negatives: "$1,250", "−$40". */
export function money(v: number, opts: { cents?: boolean; compact?: boolean } = {}): string {
  const neg = v < (opts.cents ? -0.004 : -0.5);
  const abs = Math.abs(v);
  const sign = neg ? '−$' : '$';
  if (opts.compact && abs >= 1000) {
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
    return `${sign}${(abs / 1000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  }
  const digits = opts.cents ? 2 : 0;
  const shown = opts.cents ? abs : Math.round(abs);
  return sign + shown.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export const pct = (v: number) => `${Math.round(v)}%`;

let counter = 0;
export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** Parse user-typed currency/number text ("$1,200.50") to a number. Empty → 0. */
export function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const x = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(x) ? x : 0;
}

export const sum = <T,>(arr: readonly T[], f: (x: T) => number) => arr.reduce((a, r) => a + f(r), 0);
