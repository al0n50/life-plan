/**
 * Cloud sync decisions: pure functions, no network, fully tested.
 *
 * The app is local-first: the plan on the device is always the one the user sees and edits.
 * When signed in, the device and the cloud copy are compared, and this decides what to do.
 *
 * Every cloud save gets a revision number (the database bumps it). Each device remembers the
 * last revision it synced (`revision`) and whether it has changes since then (`dirty`).
 */
import type { LifeState } from '../engine/types';

/** What this device remembers about syncing, per account. */
export interface SyncMeta {
  /** Account this device last synced with (null = never). */
  userId: string | null;
  /** Cloud revision this device last saw (null = never synced with this account). */
  revision: number | null;
  /** True when the plan changed on this device since the last sync. */
  dirty: boolean;
}

export interface RemotePlan {
  state: unknown;
  revision: number;
  updatedAt: string;
}

export type Decision =
  | { kind: 'none' } // already in sync, nothing worth saving
  | { kind: 'adopt' } // same plan on both sides: just remember the cloud revision
  | { kind: 'push'; mode: 'insert' | 'update' } // send this device's plan up
  | { kind: 'pull' } // replace this device's plan with the cloud copy
  | { kind: 'conflict' }; // both changed: ask which to keep

export const EMPTY_META: SyncMeta = { userId: null, revision: null, dirty: false };

/** Is this plan worth saving to the cloud? The example plan and an untouched blank plan aren't. */
export function isWorthSaving(s: LifeState): boolean {
  if (s.example) return false;
  return (
    s.onboarded ||
    s.name.trim() !== '' ||
    s.jobs.length > 0 ||
    s.expenses.length > 0 ||
    s.debts.length > 0 ||
    s.goals.length > 0 ||
    s.log.length > 0
  );
}

/** JSON with object keys sorted, so two plans compare equal regardless of key order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
}

export function samePlan(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

/**
 * Decide what to do, given this device's plan, what it remembers, the cloud copy (null if the
 * account has none yet) and the signed-in account.
 */
export function decide(local: LifeState, meta: SyncMeta, remote: RemotePlan | null, userId: string): Decision {
  // A different account than last time (or never synced): nothing from before counts
  const sameAccount = meta.userId === userId;
  const seen = sameAccount ? meta.revision : null;
  const dirty = sameAccount ? meta.dirty : true;
  const worth = isWorthSaving(local);

  if (!remote) return worth ? { kind: 'push', mode: 'insert' } : { kind: 'none' };

  // First sync for this account on this device (or the cloud copy was reset)
  if (seen === null || remote.revision < seen) {
    if (!worth) return { kind: 'pull' };
    return samePlan(local, remote.state) ? { kind: 'adopt' } : { kind: 'conflict' };
  }

  if (remote.revision === seen) return dirty && worth ? { kind: 'push', mode: 'update' } : { kind: 'none' };

  // The cloud moved on (another device saved)
  if (!dirty || !worth) return { kind: 'pull' };
  return samePlan(local, remote.state) ? { kind: 'adopt' } : { kind: 'conflict' };
}
