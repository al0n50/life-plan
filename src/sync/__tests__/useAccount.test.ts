/**
 * End-to-end sync flows against an in-memory stand-in for the Supabase `plans` table that
 * follows the same rules as the real one: one row per account, the revision goes up on every
 * save, and an update only applies if the revision the device sends still matches.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- device storage (AsyncStorage) ----
const disk = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => disk.get(k) ?? null,
    setItem: async (k: string, v: string) => void disk.set(k, v),
    removeItem: async (k: string) => void disk.delete(k),
  },
}));
vi.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove() {} }) }, Platform: { OS: 'web' } }));

// ---- the cloud ----
type Row = { user_id: string; state: unknown; schema_version: number; revision: number; updated_at: string; device_id?: string };
const cloud = { row: null as Row | null, session: null as { user: { id: string; email: string } } | null, deleted: false };
const ME = 'user-a';
const now = () => new Date().toISOString();
const serverSave = (state: unknown) => {
  // what another device saving looks like from here
  cloud.row = cloud.row
    ? { ...cloud.row, state, revision: cloud.row.revision + 1, updated_at: now() }
    : { user_id: ME, state, schema_version: 2, revision: 1, updated_at: now() };
};

function plansTable() {
  const q: { op?: string; values?: Record<string, unknown>; filters: Record<string, unknown> } = { filters: {} };
  const matches = () => cloud.row && Object.entries(q.filters).every(([k, v]) => (cloud.row as Record<string, unknown>)[k] === v);
  const chain = {
    select: () => chain,
    insert: (v: Record<string, unknown>) => ((q.op = 'insert'), (q.values = v), chain),
    update: (v: Record<string, unknown>) => ((q.op = 'update'), (q.values = v), chain),
    eq: (k: string, v: unknown) => ((q.filters[k] = v), chain),
    maybeSingle: async () => ({ data: matches() ? { ...cloud.row } : null, error: null }),
    single: async () => {
      if (q.op === 'insert') {
        if (cloud.row) return { data: null, error: { code: '23505', message: 'duplicate key' } };
        cloud.row = { user_id: ME, ...(q.values as object), revision: 1, updated_at: now() } as Row;
        return { data: { revision: 1 }, error: null };
      }
      return { data: null, error: null };
    },
    then: (resolve: (r: unknown) => void) => {
      // update(...).eq().eq().select() awaited directly
      if (q.op === 'update') {
        if (!matches()) return resolve({ data: [], error: null });
        cloud.row = { ...(cloud.row as Row), ...(q.values as object), revision: (cloud.row as Row).revision + 1, updated_at: now() };
        return resolve({ data: [{ revision: cloud.row.revision }], error: null });
      }
      resolve({ data: null, error: null });
    },
  };
  return chain;
}

const authListeners: ((event: string, session: unknown) => void)[] = [];
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => plansTable(),
    rpc: async (fn: string) => {
      if (fn === 'delete_my_account') {
        cloud.row = null;
        cloud.deleted = true;
      }
      return { error: null };
    },
    auth: {
      getSession: async () => ({ data: { session: cloud.session } }),
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => void authListeners.push(cb),
      signInWithPassword: async ({ password }: { password: string }) => {
        if (password !== 'correct horse') return { error: { message: 'Invalid login credentials' } };
        cloud.session = { user: { id: ME, email: 'a@example.com' } };
        authListeners.forEach((cb) => cb('SIGNED_IN', cloud.session));
        return { error: null };
      },
      signUp: async () => ({ data: { session: null }, error: null }),
      signOut: async () => {
        cloud.session = null;
        authListeners.forEach((cb) => cb('SIGNED_OUT', null));
        return { error: null };
      },
    },
  },
}));

const { useLifePlan } = await import('@/store/useLifePlan');
const { useAccount, startAccountSync } = await import('@/sync/useAccount');
const { blankState } = await import('@/engine/state');
const { localToday } = await import('@/engine/dates');

const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async () => {
  for (let i = 0; i < 5; i++) await flush();
  await useAccount.getState().syncNow();
};
const rename = (name: string) => useLifePlan.setState((s) => ({ state: { ...s.state, name, onboarded: true } }));
const localName = () => useLifePlan.getState().state.name;
const cloudName = () => (cloud.row?.state as { name?: string } | undefined)?.name;

startAccountSync();

beforeEach(async () => {
  if (cloud.session) await useAccount.getState().signOut(false);
  cloud.row = null;
  cloud.session = null;
  disk.delete('life-plan-sync-v1');
  useAccount.setState({ status: 'signed-out', conflict: null, message: null });
  useLifePlan.setState({ state: blankState(localToday()) });
  await flush();
});

describe('accounts and cloud sync', () => {
  it('wrong password gives a plain message and stays signed out', async () => {
    await expect(useAccount.getState().signIn('a@example.com', 'nope')).rejects.toThrow('don’t match an account');
    expect(useAccount.getState().session).toBeNull();
  });

  it('first sign-in uploads the plan on this device', async () => {
    rename('Alonso');
    await useAccount.getState().signIn('a@example.com', 'correct horse');
    await settle();
    expect(cloudName()).toBe('Alonso');
    expect(useAccount.getState().status).toBe('synced');
  });

  it('a new device signing in downloads the saved plan', async () => {
    serverSave({ ...blankState(localToday()), name: 'From my phone', onboarded: true });
    await useAccount.getState().signIn('a@example.com', 'correct horse');
    await settle();
    expect(localName()).toBe('From my phone');
  });

  it('changes on this device upload, and changes from another device download', async () => {
    rename('v1');
    await useAccount.getState().signIn('a@example.com', 'correct horse');
    await settle();
    rename('v2');
    await settle();
    expect(cloudName()).toBe('v2');
    expect(cloud.row?.revision).toBe(2);

    serverSave({ ...(cloud.row!.state as object), name: 'edited on the web' });
    await settle();
    expect(localName()).toBe('edited on the web');
  });

  it('when both devices changed, nothing is overwritten until the user chooses', async () => {
    rename('start');
    await useAccount.getState().signIn('a@example.com', 'correct horse');
    await settle();
    serverSave({ ...(cloud.row!.state as object), name: 'web edit' });
    useLifePlan.setState((s) => ({ state: { ...s.state, name: 'phone edit' } }));
    await settle();
    expect(useAccount.getState().status).toBe('conflict');
    expect(localName()).toBe('phone edit');
    expect(cloudName()).toBe('web edit');

    await useAccount.getState().resolveConflict('device');
    expect(cloudName()).toBe('phone edit');
    expect(useAccount.getState().status).toBe('synced');
  });

  it('choosing the cloud plan replaces this device’s plan', async () => {
    rename('start');
    await useAccount.getState().signIn('a@example.com', 'correct horse');
    await settle();
    serverSave({ ...(cloud.row!.state as object), name: 'cloud wins' });
    useLifePlan.setState((s) => ({ state: { ...s.state, name: 'local loses' } }));
    await settle();
    await useAccount.getState().resolveConflict('cloud');
    expect(localName()).toBe('cloud wins');
    rename('next change');
    await settle();
    expect(cloudName()).toBe('next change');
  });

  it('the example plan is never uploaded', async () => {
    useLifePlan.getState().loadExample();
    await useAccount.getState().signIn('a@example.com', 'correct horse');
    await settle();
    expect(cloud.row).toBeNull();
  });

  it('a plan from a newer app version is not loaded over this one', async () => {
    rename('mine');
    serverSave({ schemaVersion: 99, name: 'future' });
    await useAccount.getState().signIn('a@example.com', 'correct horse');
    await settle();
    expect(useAccount.getState().status).toBe('conflict');
    await useAccount.getState().resolveConflict('cloud');
    expect(localName()).toBe('mine');
    expect(useAccount.getState().message).toMatch(/newer version/);
  });

  it('signing out can keep or remove the plan on this device', async () => {
    rename('keep me');
    await useAccount.getState().signIn('a@example.com', 'correct horse');
    await settle();
    await useAccount.getState().signOut(false);
    expect(localName()).toBe('keep me');
    await useAccount.getState().signIn('a@example.com', 'correct horse');
    await settle();
    await useAccount.getState().signOut(true);
    expect(localName()).toBe('');
    expect(cloudName()).toBe('keep me');
  });

  it('deleting the account removes the cloud plan and signs out', async () => {
    rename('bye');
    await useAccount.getState().signIn('a@example.com', 'correct horse');
    await settle();
    await useAccount.getState().deleteAccount();
    expect(cloud.row).toBeNull();
    expect(useAccount.getState().session).toBeNull();
    expect(localName()).toBe('bye');
  });
});

describe('error messages', () => {
  it('reads messages from Supabase error objects, not "[object Object]"', async () => {
    const { friendlyAuthError } = await import('@/sync/useAccount');
    expect(friendlyAuthError({ message: 'Invalid login credentials', status: 400 })).toMatch(/don’t match/);
    expect(friendlyAuthError({ code: '42501', message: 'permission denied for table plans' })).toBe('permission denied for table plans');
    expect(friendlyAuthError(new TypeError('Failed to fetch'))).toMatch(/connection/);
    expect(friendlyAuthError({})).toBe('Something went wrong. Try again.');
  });
});
