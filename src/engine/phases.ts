// The phases a plan moves through, and how each one splits a paycheck.
import { num } from './format';
import type { DebtMode, PhaseKey, Settings, Split } from './types';

export interface Bucket {
  key: 'emergency' | 'debt' | 'goals' | 'invest' | 'fun';
  name: string;
}

/** Order matches Split: [emergency, debt, goals, invest, fun]. */
export const BUCKETS: Bucket[] = [
  { key: 'emergency', name: 'Emergency fund' },
  { key: 'debt', name: 'Extra debt payment' },
  { key: 'goals', name: 'Big goals' },
  { key: 'invest', name: 'Investing' },
  { key: 'fun', name: 'Guilt-free fun' },
];

export interface PhaseInfo {
  name: string;
  done: string;
  what: string;
  why: string;
  split: Split;
}

export const PHASES: Record<PhaseKey, PhaseInfo> = {
  debt: {
    name: 'Crush the debt',
    done: 'All debt is paid off',
    what: 'Every debt gets its minimum, and most of what’s left goes to the highest-interest debt first. When one is paid off, its payment rolls into the next.',
    why: 'Interest works against you every month. Clearing debt fast frees up money for everything else. A slice still goes to savings, so one surprise bill doesn’t land back on a card.',
    split: [15, 55, 10, 0, 20],
  },
  starter: {
    name: 'Starter emergency fund',
    done: 'Your starter fund is saved',
    what: 'Most of what’s left goes into savings until you reach your starter amount.',
    why: 'A small cushion keeps a flat tire or a short paycheck from becoming new debt.',
    split: [70, 0, 10, 0, 20],
  },
  safety: {
    name: 'Full safety net',
    done: 'Your emergency fund reaches its full size',
    what: 'Keep growing the emergency fund until it covers your chosen number of months of recurring expenses and minimums. Goals start getting a real share.',
    why: 'Months of cushion mean a job loss or a big repair is a problem, not a crisis.',
    split: [50, 0, 25, 5, 20],
  },
  goals: {
    name: 'Fund your big goals',
    done: 'Every goal is fully saved',
    what: 'Half of what’s left goes to your goals (a trip, a car, a move), and investing starts.',
    why: 'With debt handled and a safety net in place, you can save for what you want without risking what you need.',
    split: [10, 0, 50, 20, 20],
  },
  wealth: {
    name: 'Build wealth',
    done: 'Ongoing',
    what: 'Half of what’s left goes to investing for the long term; the rest keeps funding new goals and fun.',
    why: 'This is where money starts working for you. This phase doesn’t end.',
    split: [5, 0, 25, 50, 20],
  },
};

export const PHASE_ORDER: Record<DebtMode, PhaseKey[]> = {
  asap: ['debt', 'starter', 'safety', 'goals', 'wealth'],
  steady: ['starter', 'safety', 'goals', 'wealth'],
};

export function splitFor(phase: PhaseKey, settings: Settings): Split {
  return settings.useCustom ? (settings.custom.map(num) as Split) : ([...PHASES[phase].split] as Split);
}
