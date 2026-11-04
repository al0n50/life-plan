// The one way state changes. Forms call applyUpdate today; an AI "tell me what changed"
// layer can produce the same Update objects later without touching the engine.
import { uid } from './format';
import type { DebtMode, ISODate, LifeState, LogEntry, Routes, Settings, Where } from './types';

export type ListKey = 'jobs' | 'expenses' | 'debts' | 'goals' | 'accounts' | 'lifeEvents' | 'careerTracks' | 'actions';
type ItemOf<K extends ListKey> = LifeState[K][number];

export type Update =
  // What really happened (goes in the log, never changes the plan)
  | { type: 'paycheck'; job: string; amount: number; date: ISODate }
  | { type: 'no_paycheck'; job: string; date: ISODate }
  | { type: 'extra'; source: string; amount: number; date: ISODate; selfEmployed: boolean; taxPct?: number }
  | { type: 'spend'; what: string; amount: number; date: ISODate; from: Where }
  | { type: 'balance'; account: Where; amount: number; date: ISODate }
  | { type: 'note'; text: string; date: ISODate }
  | { type: 'remove_log'; id: string }
  // Plan changes
  | { [K in ListKey]: { type: 'upsert'; list: K; item: ItemOf<K> } }[ListKey]
  | { type: 'remove'; list: ListKey; id: string }
  | { type: 'set_debt_mode'; mode: DebtMode }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'routes'; patch: Partial<Routes> }
  | { type: 'profile'; patch: Partial<Pick<LifeState, 'name' | 'northStar' | 'onboarded' | 'lastReview'>> }
  | { type: 'toggle_action'; id: string };

/** LogEntry without its id, kept as a union (plain Omit would collapse the variants). */
type NewLogEntry = LogEntry extends infer E ? (E extends LogEntry ? Omit<E, 'id'> : never) : never;

function addLog(st: LifeState, entry: NewLogEntry & { id?: string }): LifeState {
  return { ...st, log: [...st.log, { ...entry, id: entry.id ?? uid('l') } as LogEntry] };
}

/** Returns a new state with the update applied. `today` stamps balance edits. */
export function applyUpdate(st: LifeState, u: Update, today: ISODate): LifeState {
  switch (u.type) {
    case 'paycheck':
      return addLog(st, { type: 'paycheck', job: u.job, amount: u.amount, date: u.date });
    case 'no_paycheck':
      return addLog(st, { type: 'paycheck', job: u.job, amount: 0, date: u.date });
    case 'extra':
      return addLog(st, { type: 'extra', source: u.source, amount: u.amount, date: u.date, selfEmployed: u.selfEmployed, taxPct: u.taxPct });
    case 'spend':
      return addLog(st, { type: 'spend', what: u.what, amount: u.amount, date: u.date, from: u.from });
    case 'balance':
      return addLog(st, { type: 'balance', account: u.account, amount: u.amount, date: u.date });
    case 'note':
      return addLog(st, { type: 'note', text: u.text, date: u.date });
    case 'remove_log':
      return { ...st, log: st.log.filter((l) => l.id !== u.id) };

    case 'upsert': {
      const list = st[u.list] as { id: string }[];
      const prev = list.find((x) => x.id === u.item.id) as Record<string, unknown> | undefined;
      let item = u.item as unknown as Record<string, unknown>;
      // Editing a balance means "this is true as of today".
      if ((u.list === 'debts' || u.list === 'accounts') && (!prev || prev.balance !== item.balance)) {
        item = { ...item, asOf: today };
      }
      const next = prev ? list.map((x) => (x.id === u.item.id ? item : x)) : [...list, item];
      return { ...st, [u.list]: next };
    }
    case 'remove': {
      const next = { ...st, [u.list]: (st[u.list] as { id: string }[]).filter((x) => x.id !== u.id) } as LifeState;
      if (u.list === 'jobs') next.log = next.log.filter((l) => !(l.type === 'paycheck' && l.job === u.id));
      return next;
    }
    case 'set_debt_mode':
      return { ...st, settings: { ...st.settings, debtMode: u.mode } };
    case 'settings':
      return { ...st, settings: { ...st.settings, ...u.patch } };
    case 'routes':
      return { ...st, routes: { ...st.routes, ...u.patch } };
    case 'profile':
      return { ...st, ...u.patch };
    case 'toggle_action':
      return { ...st, actions: st.actions.map((a) => (a.id === u.id ? { ...a, done: !a.done } : a)) };
  }
}

/** The log entries that count as "the user checked in" (for the 45-day review prompt). */
export const isCheckIn = (l: LogEntry) => l.type !== 'note';
