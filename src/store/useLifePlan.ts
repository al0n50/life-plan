import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { localToday } from '@/engine/dates';
import { buildModel, type Model } from '@/engine/model';
import { blankState, exampleState, migrateV1, sanitize } from '@/engine/state';
import type { LifeState } from '@/engine/types';
import { applyUpdate, type Update } from '@/engine/updates';

interface Store {
  state: LifeState;
  /** Apply one or more updates. Any change to the example plan turns it into the user's own. */
  apply: (...updates: Update[]) => void;
  loadExample: () => void;
  startFresh: () => void;
  reset: () => void;
}

export const useLifePlan = create<Store>()(
  persist(
    (set) => ({
      state: blankState(localToday()),
      apply: (...updates) =>
        set((s) => {
          const today = localToday();
          let next = s.state;
          for (const u of updates) next = applyUpdate(next, u, today);
          return { state: next.example ? { ...next, example: false } : next };
        }),
      loadExample: () => set({ state: exampleState(localToday()) }),
      startFresh: () => set({ state: blankState(localToday()) }),
      reset: () => set({ state: blankState(localToday()) }),
    }),
    {
      // Same storage key as v1 so existing data migrates in place.
      name: 'life-plan-v1',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ state: s.state }),
      migrate: (persisted, version) => {
        const today = localToday();
        const p = persisted as Record<string, unknown> | null;
        if (version < 2 && p && typeof p === 'object' && 'profile' in p) {
          return { state: migrateV1(p.profile as Parameters<typeof migrateV1>[0], Boolean(p.onboarded), today) };
        }
        return { state: sanitize(p?.state, today) ?? blankState(today) };
      },
      merge: (persisted, current) => {
        const st = sanitize((persisted as { state?: unknown } | undefined)?.state, localToday());
        return st ? { ...current, state: st } : current;
      },
    },
  ),
);

export const useLifeState = () => useLifePlan((s) => s.state);
export const useApply = () => useLifePlan((s) => s.apply);

/** Today's date, as the device sees it. Re-read each render so the app rolls over at midnight. */
export const useToday = () => localToday();

/** The full plan model for today, rebuilt whenever state or the day changes. */
export function useModel(): Model {
  const state = useLifeState();
  const today = useToday();
  return useMemo(() => buildModel(state, today), [state, today]);
}

/** True once saved data has been loaded from device storage. */
export function useHydrated() {
  return useSyncExternalStore(
    (onChange) => useLifePlan.persist.onFinishHydration(onChange),
    () => useLifePlan.persist.hasHydrated(),
    () => false,
  );
}
