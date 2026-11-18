/**
 * Accounts and cloud sync. Signing in is optional; without an account the app works exactly
 * as before. Signed in, the plan on this device is backed up and kept in sync with the
 * account's cloud copy (one plan per account). Decisions live in ./decide.ts (tested).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import { localToday } from '@/engine/dates';
import { sanitize } from '@/engine/state';
import type { LifeState } from '@/engine/types';
import { supabase } from '@/lib/supabase';
import { useLifePlan } from '@/store/useLifePlan';

import { decide, EMPTY_META, type RemotePlan, type SyncMeta } from './decide';
import { MIN_PASSWORD_LENGTH, resetRedirectTo } from './recovery';

const META_KEY = 'life-plan-sync-v1';
const DEVICE_KEY = 'life-plan-device-id';
const PUSH_DELAY_MS = 1500;

export type SyncStatus = 'signed-out' | 'idle' | 'syncing' | 'synced' | 'conflict' | 'offline' | 'error';

interface AccountStore {
  session: Session | null;
  ready: boolean;
  status: SyncStatus;
  message: string | null;
  lastSyncedAt: string | null;
  /** The cloud copy, while the user chooses between it and this device's plan */
  conflict: RemotePlan | null;
  /** Signed in from a password-reset link: the person still has to choose a new password */
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<'signed-in' | 'confirm-email'>;
  signOut: (removeLocalPlan: boolean) => Promise<void>;
  deleteAccount: () => Promise<void>;
  /** Email a password-reset link (sent whether or not the account exists, so emails can't be probed) */
  requestPasswordReset: (email: string) => Promise<void>;
  /** Finish a reset: set the new password for the account signed in by the reset link */
  setNewPassword: (password: string) => Promise<void>;
  syncNow: () => Promise<void>;
  resolveConflict: (keep: 'device' | 'cloud') => Promise<void>;
}

// ---------- small helpers ----------

let meta: SyncMeta = { ...EMPTY_META };
let applyingRemote = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;

async function loadMeta() {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    meta = raw ? { ...EMPTY_META, ...JSON.parse(raw) } : { ...EMPTY_META };
  } catch {
    meta = { ...EMPTY_META };
  }
}
async function saveMeta(next: Partial<SyncMeta>) {
  meta = { ...meta, ...next };
  try {
    await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Storage full or unavailable: sync still works this session
  }
}

async function deviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_KEY).catch(() => null);
  if (!id) {
    id = `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_KEY, id).catch(() => {});
  }
  return id;
}

/** The message from an Error, a Supabase error object ({ message, code }), or anything else */
function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return typeof e === 'string' ? e : '';
}

/** Plain-language messages for sign-in and sync failures */
export function friendlyAuthError(e: unknown): string {
  const msg = messageOf(e);
  if (/invalid login credentials/i.test(msg)) return 'That email and password don’t match an account.';
  if (/email not confirmed/i.test(msg)) return 'Confirm your email first: open the link we sent you, then sign in.';
  if (/already registered|already exists/i.test(msg)) return 'There’s already an account with that email. Sign in instead.';
  if (/password should be at least|weak password|password is too/i.test(msg)) return 'Use a longer password (at least 8 characters).';
  if (/valid email|invalid email|unable to validate email/i.test(msg)) return 'Enter a valid email address.';
  if (/different from the old password/i.test(msg)) return 'Pick a new password, not the one you had before.';
  if (/auth session missing|session.*expired|token.*expired|otp_expired/i.test(msg)) return 'This reset link has expired or was already used. Ask for a new one.';
  if (/security purposes|only request this after/i.test(msg)) return 'Wait a minute before asking for another email.';
  if (/rate limit|too many/i.test(msg)) return 'Too many tries. Wait a minute and try again.';
  if (/network|fetch|failed to fetch|timeout/i.test(msg)) return 'Can’t reach the server. Check your connection and try again.';
  return msg || 'Something went wrong. Try again.';
}

const isNetworkError = (e: unknown) => /network|fetch|timeout/i.test(messageOf(e));

async function fetchRemote(userId: string): Promise<RemotePlan | null> {
  const { data, error } = await supabase
    .from('plans')
    .select('state, revision, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { state: data.state, revision: Number(data.revision), updatedAt: data.updated_at } : null;
}

function applyRemote(remote: RemotePlan): boolean {
  const st = sanitize(remote.state, localToday());
  if (!st) return false; // saved by a newer app version this one can't read
  applyingRemote = true;
  try {
    useLifePlan.setState({ state: st });
  } finally {
    applyingRemote = false;
  }
  return true;
}

async function push(userId: string, local: LifeState, mode: 'insert' | 'update'): Promise<number | null> {
  const row = { state: local, schema_version: local.schemaVersion, device_id: await deviceId() };
  if (mode === 'insert') {
    const { data, error } = await supabase.from('plans').insert(row).select('revision').single();
    if (error) {
      if (error.code === '23505') return null; // another device created it first → re-decide
      throw error;
    }
    return Number(data.revision);
  }
  // Only succeeds if nobody else saved since the revision this device last saw
  const { data, error } = await supabase
    .from('plans')
    .update(row)
    .eq('user_id', userId)
    .eq('revision', meta.revision ?? -1)
    .select('revision');
  if (error) throw error;
  return data && data.length ? Number(data[0].revision) : null;
}

// ---------- the store ----------

export const useAccount = create<AccountStore>()((set, get) => {
  const synced = (revision: number) => {
    set({ status: 'synced', message: null, lastSyncedAt: new Date().toISOString(), conflict: null });
    return saveMeta({ revision, dirty: false });
  };

  async function runSync(): Promise<void> {
    const session = get().session;
    if (!session || !useLifePlan.persist.hasHydrated()) return;
    const userId = session.user.id;
    if (get().status === 'conflict') return; // waiting for the user to choose
    set({ status: 'syncing' });
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await fetchRemote(userId);
        const local = useLifePlan.getState().state;
        const d = decide(local, meta, remote, userId);
        if (meta.userId !== userId) await saveMeta({ userId, revision: null, dirty: true });

        if (d.kind === 'none') {
          set({ status: remote ? 'synced' : 'idle', message: null, lastSyncedAt: remote ? new Date().toISOString() : get().lastSyncedAt });
          if (remote) await saveMeta({ revision: remote.revision, dirty: false });
          return;
        }
        if (d.kind === 'adopt' && remote) return void (await synced(remote.revision));
        if (d.kind === 'pull' && remote) {
          if (!applyRemote(remote)) {
            set({ status: 'error', message: 'Your cloud plan was saved by a newer version of Life Plan. Update the app to load it.' });
            return;
          }
          return void (await synced(remote.revision));
        }
        if (d.kind === 'conflict' && remote) {
          set({ status: 'conflict', conflict: remote, message: null });
          return;
        }
        if (d.kind === 'push') {
          const rev = await push(userId, local, d.mode);
          if (rev !== null) return void (await synced(rev));
          // Someone else saved in between: look again
        }
      }
      set({ status: 'error', message: 'Couldn’t finish syncing. Try again in a moment.' });
    } catch (e) {
      set(isNetworkError(e)
        ? { status: 'offline', message: 'Offline. Your changes are saved on this device and will sync later.' }
        : { status: 'error', message: friendlyAuthError(e) });
    }
  }

  async function syncNow() {
    if (running) return running;
    running = runSync().finally(() => {
      running = null;
    });
    return running;
  }

  return {
    session: null,
    ready: false,
    status: 'signed-out',
    message: null,
    lastSyncedAt: null,
    conflict: null,
    recovering: false,

    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(friendlyAuthError(error));
    },

    signUp: async (email, password) => {
      if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Use a longer password (at least ${MIN_PASSWORD_LENGTH} characters).`);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: 'https://life-plan-os.vercel.app' },
      });
      if (error) throw new Error(friendlyAuthError(error));
      return data.session ? 'signed-in' : 'confirm-email';
    },

    signOut: async (removeLocalPlan) => {
      if (pushTimer) clearTimeout(pushTimer);
      // Last chance to save pending changes before leaving
      if (meta.dirty && get().status !== 'conflict') await syncNow().catch(() => {});
      await supabase.auth.signOut().catch(() => {});
      await saveMeta({ ...EMPTY_META });
      if (removeLocalPlan) {
        applyingRemote = true;
        try {
          useLifePlan.getState().reset();
        } finally {
          applyingRemote = false;
        }
      }
      set({ session: null, status: 'signed-out', message: null, conflict: null, lastSyncedAt: null });
    },

    deleteAccount: async () => {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw new Error(friendlyAuthError(error));
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      await saveMeta({ ...EMPTY_META });
      set({ session: null, status: 'signed-out', message: null, conflict: null, lastSyncedAt: null });
    },

    requestPasswordReset: async (email) => {
      const address = email.trim();
      if (!address) throw new Error('Enter the email you signed up with.');
      const origin = Platform.OS === 'web' ? globalThis.location?.origin : null;
      const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: resetRedirectTo(origin) });
      if (error) throw new Error(friendlyAuthError(error));
    },

    setNewPassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(friendlyAuthError(error));
      set({ recovering: false });
    },

    syncNow,

    resolveConflict: async (keep) => {
      const remote = get().conflict;
      const session = get().session;
      if (!remote || !session) return;
      if (keep === 'cloud') {
        if (!applyRemote(remote)) {
          set({ status: 'error', message: 'Your cloud plan was saved by a newer version of Life Plan. Update the app to load it.' });
          return;
        }
        await saveMeta({ userId: session.user.id, revision: remote.revision, dirty: false });
        set({ status: 'synced', conflict: null, lastSyncedAt: new Date().toISOString(), message: null });
        return;
      }
      // Keep this device's plan: overwrite the cloud copy the user just saw
      await saveMeta({ userId: session.user.id, revision: remote.revision, dirty: true });
      set({ status: 'idle', conflict: null });
      await syncNow();
    },
  };
});

// ---------- wiring (runs once when imported) ----------

let started = false;
export function startAccountSync() {
  if (started) return;
  started = true;

  loadMeta().then(async () => {
    const { data } = await supabase.auth.getSession();
    useAccount.setState({ session: data.session, ready: true, status: data.session ? 'idle' : 'signed-out' });
    if (data.session) useAccount.getState().syncNow();
  });

  supabase.auth.onAuthStateChange((event, session) => {
    useAccount.setState(event === 'PASSWORD_RECOVERY' ? { session, recovering: true } : { session });
    if (!session) {
      useAccount.setState({ recovering: false });
      return;
    }
    if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
      useAccount.setState({ status: 'idle' });
      setTimeout(() => useAccount.getState().syncNow(), 0);
    }
  });

  // Every local change marks the plan as changed and schedules an upload
  useLifePlan.subscribe((s, prev) => {
    if (applyingRemote || s.state === prev.state) return;
    saveMeta({ dirty: true });
    if (!useAccount.getState().session) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => useAccount.getState().syncNow(), PUSH_DELAY_MS);
  });

  // Check for changes from other devices when the app comes back to the foreground
  AppState.addEventListener('change', (state) => {
    if (state === 'active' && useAccount.getState().session) useAccount.getState().syncNow();
  });

  // Once saved data has loaded from the device, sync if signed in
  useLifePlan.persist.onFinishHydration(() => {
    if (useAccount.getState().session) useAccount.getState().syncNow();
  });
}
