// Life Plan data model (schema v2).
// LifeState is everything the user has told us plus what really happened (the log).
// The engine never mutates it; it only reads it to build a Model.

/** YYYY-MM-DD */
export type ISODate = string;
/** YYYY-MM */
export type ISOMonth = string;

// ---------------- Money ----------------

export type PayFreq = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

export interface Job {
  id: string;
  name: string;
  payType: 'hourly' | 'amount';
  rate: number;
  hours: number;
  /** Take-home per paycheck when payType is 'amount'. */
  amount: number;
  freq: PayFreq;
  /** A known payday. Anchors weekly/biweekly schedules and the monthly day. */
  nextPay: ISODate | '';
  /** Per-paycheck deductions like health insurance or a 401(k). */
  otherDed: number;
  /** Future income: the job starts paying on/after this date. */
  startDate?: ISODate;
  endDate?: ISODate;
  careerTrackId?: string;
}

export type ExpenseFreq = 'monthly' | 'weekly' | 'biweekly' | 'yearly';

export interface Expense {
  id: string;
  name: string;
  amount: number;
  freq: ExpenseFreq;
  /** A bill comes out on a due date. Everyday spending is drawn down through the month. */
  kind: 'bill' | 'spending';
  /** Day of month, for monthly bills. */
  dueDay?: number;
  /** Next due date, for weekly/biweekly/yearly bills. */
  nextDue?: ISODate;
}

export type DebtKind = 'credit_card' | 'auto' | 'student_loan' | 'personal' | 'medical' | 'bnpl' | 'mortgage' | 'other';

export interface Debt {
  id: string;
  name: string;
  kind: DebtKind;
  balance: number;
  /** Annual percentage rate, e.g. 24.99 */
  apr: number;
  min: number;
  /** Due day of month. */
  due: number;
  /** The date `balance` was true. */
  asOf: ISODate;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  /** Target month. */
  date: ISOMonth | '';
  /** Already saved when the goal was added. */
  saved: number;
  /** Paused until this is true (e.g. "when the credit card is paid off"). */
  unlockWhen?: Condition;
}

export type AccountType = 'checking' | 'savings' | 'hysa' | 'investing' | 'cash';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  asOf: ISODate;
}

/** Which account each part of the plan lives in. */
export interface Routes {
  pay: string;
  emergency: string;
  goals: string;
  invest: string;
  tax: string;
}

// ---------------- What really happened ----------------

export type LogEntry =
  | { id: string; date: ISODate; type: 'paycheck'; job: string; amount: number }
  | { id: string; date: ISODate; type: 'extra'; source: string; amount: number; selfEmployed: boolean; taxPct?: number }
  | { id: string; date: ISODate; type: 'spend'; what: string; amount: number; from: Where }
  | { id: string; date: ISODate; type: 'balance'; account: Where; amount: number }
  | { id: string; date: ISODate; type: 'note'; text: string };

/**
 * A place money sits:
 * 'acct:<id>' an account, 'debt:<id>' a debt balance, 'goal:<id>' goal savings, 'emergency' the emergency fund.
 */
export type Where = string;

// ---------------- Plan settings ----------------

export type DebtMode = 'asap' | 'steady';
export type PhaseKey = 'debt' | 'starter' | 'safety' | 'goals' | 'wealth';
/** Emergency, extra debt, goals, investing, fun — percentages of what's left after recurring + minimums. */
export type Split = [number, number, number, number, number];

export interface Settings {
  debtMode: DebtMode;
  starter: number;
  efMonths: number;
  useCustom: boolean;
  custom: Split;
  /** Share of self-employment income set aside for taxes. */
  taxPct: number;
  /** State income tax rate on wages (percent). 0 for no-income-tax states. */
  stateTax: number;
}

// ---------------- Life layer ----------------

export type Condition =
  | { kind: 'debt_paid'; debtId: string }
  | { kind: 'all_debt_paid' }
  | { kind: 'phase_reached'; phase: PhaseKey }
  | { kind: 'date'; date: ISODate };

export interface NorthStar {
  statement: string;
  /** The people and things this is all for. */
  anchors: string[];
  /** e.g. 30 for "by 30". */
  targetAge?: number;
  birthYear?: number;
}

export interface LifeEvent {
  id: string;
  title: string;
  date: ISODate;
  /** Anchor events are the milestones everything else is planned around. */
  kind: 'anchor' | 'event';
  detail?: string;
}

export type MilestoneStatus = 'done' | 'now' | 'next' | 'question';

export interface CareerMilestone {
  id: string;
  title: string;
  date?: ISODate;
  status: MilestoneStatus;
  /** The job this milestone turns into income (a Job with a startDate). */
  incomeJobId?: string;
}

export interface CareerTrack {
  id: string;
  name: string;
  /** Short status line, e.g. "Applying" or "Partially planned". */
  status: string;
  milestones: CareerMilestone[];
  target?: string;
}

export type Urgency = 'urgent' | 'month' | 'unlocked';

export interface Action {
  id: string;
  title: string;
  detail?: string;
  urgency: Urgency;
  /** For 'unlocked' actions: what has to be true first. */
  unlockWhen?: Condition;
  due?: ISODate;
  done: boolean;
}

// ---------------- Whole state ----------------

export interface LifeState {
  schemaVersion: 2;
  example: boolean;
  onboarded: boolean;
  createdAt: ISODate;
  lastReview: ISODate;
  name: string;
  jobs: Job[];
  expenses: Expense[];
  debts: Debt[];
  goals: Goal[];
  accounts: Account[];
  routes: Partial<Routes>;
  settings: Settings;
  log: LogEntry[];
  northStar: NorthStar;
  lifeEvents: LifeEvent[];
  careerTracks: CareerTrack[];
  actions: Action[];
}
