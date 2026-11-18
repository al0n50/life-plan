import { describe, expect, it } from 'vitest';

import { blankState, exampleState } from '../../engine/state';
import type { LifeState } from '../../engine/types';
import { decide, EMPTY_META, isWorthSaving, samePlan, stableStringify, type RemotePlan } from '../decide';

const TODAY = '2026-11-18';
const ME = 'user-a';
const mine = (name = 'Alonso'): LifeState => ({ ...blankState(TODAY), name, onboarded: true });
const remote = (state: unknown, revision: number): RemotePlan => ({ state, revision, updatedAt: '2026-11-18T00:00:00Z' });

describe('what is worth saving', () => {
  it('skips the example plan and an untouched blank plan', () => {
    expect(isWorthSaving(exampleState(TODAY))).toBe(false);
    expect(isWorthSaving(blankState(TODAY))).toBe(false);
  });
  it('saves a plan the user has started', () => {
    expect(isWorthSaving(mine())).toBe(true);
    expect(isWorthSaving({ ...blankState(TODAY), name: 'Sam' })).toBe(true);
  });
});

describe('comparing plans', () => {
  it('ignores key order', () => {
    expect(samePlan({ a: 1, b: { c: 2, d: [1, { e: 3, f: 4 }] } }, { b: { d: [1, { f: 4, e: 3 }], c: 2 }, a: 1 })).toBe(true);
    expect(samePlan({ a: 1 }, { a: 2 })).toBe(false);
    expect(stableStringify({ b: undefined, a: null })).toBe('{"a":null}');
  });
});

describe('sync decisions', () => {
  it('first sign-in with a plan on the device and nothing in the cloud: upload it', () => {
    expect(decide(mine(), EMPTY_META, null, ME)).toEqual({ kind: 'push', mode: 'insert' });
  });

  it('nothing worth saving and nothing in the cloud: do nothing', () => {
    expect(decide(exampleState(TODAY), EMPTY_META, null, ME)).toEqual({ kind: 'none' });
  });

  it('new device (blank or example plan) signing into an account with a cloud plan: download it', () => {
    expect(decide(blankState(TODAY), EMPTY_META, remote(mine(), 4), ME)).toEqual({ kind: 'pull' });
    expect(decide(exampleState(TODAY), EMPTY_META, remote(mine(), 4), ME)).toEqual({ kind: 'pull' });
  });

  it('first sync where both sides have the same plan: just link them', () => {
    const p = mine();
    expect(decide(p, EMPTY_META, remote(JSON.parse(JSON.stringify(p)), 2), ME)).toEqual({ kind: 'adopt' });
  });

  it('first sync where the device and the cloud have different plans: ask', () => {
    expect(decide(mine('Device'), EMPTY_META, remote(mine('Cloud'), 2), ME)).toEqual({ kind: 'conflict' });
  });

  it('in sync, no changes: do nothing', () => {
    expect(decide(mine(), { userId: ME, revision: 3, dirty: false }, remote(mine(), 3), ME)).toEqual({ kind: 'none' });
  });

  it('in sync, changed on this device: upload the change', () => {
    expect(decide(mine('New'), { userId: ME, revision: 3, dirty: true }, remote(mine(), 3), ME)).toEqual({ kind: 'push', mode: 'update' });
  });

  it('another device saved, nothing changed here: download', () => {
    expect(decide(mine(), { userId: ME, revision: 3, dirty: false }, remote(mine('Other'), 5), ME)).toEqual({ kind: 'pull' });
  });

  it('another device saved and this device changed too: ask', () => {
    expect(decide(mine('Here'), { userId: ME, revision: 3, dirty: true }, remote(mine('There'), 5), ME)).toEqual({ kind: 'conflict' });
  });

  it('both changed to the same thing: no conflict', () => {
    const p = mine('Same');
    expect(decide(p, { userId: ME, revision: 3, dirty: true }, remote({ ...p }, 5), ME)).toEqual({ kind: 'adopt' });
  });

  it('a different account on this device: treat as a first sync, never mix accounts', () => {
    const meta = { userId: 'someone-else', revision: 9, dirty: false };
    expect(decide(mine('Device'), meta, remote(mine('Cloud'), 9), ME)).toEqual({ kind: 'conflict' });
    expect(decide(blankState(TODAY), meta, remote(mine('Cloud'), 9), ME)).toEqual({ kind: 'pull' });
  });

  it('the cloud copy was reset (lower revision than this device saw): treat as a first sync', () => {
    expect(decide(mine('Device'), { userId: ME, revision: 8, dirty: false }, remote(mine('Cloud'), 1), ME)).toEqual({ kind: 'conflict' });
  });
});
