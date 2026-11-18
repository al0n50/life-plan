import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { Button, Callout, Card, Field, Row, Screen, Section, Text } from '@/components/ui';
import { buildPlanExport } from '@/engine/exportPlan';
import { saveTextFile } from '@/lib/saveFile';
import { useLifeState } from '@/store/useLifePlan';
import { useAccount, type SyncStatus } from '@/sync/useAccount';
import { space } from '@/theme';

/** Ask before something that can't be undone (Alert on phones, confirm on web). */
function confirmAction(title: string, message: string, action: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: action, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

const STATUS_TEXT: Record<SyncStatus, string> = {
  'signed-out': 'Not signed in',
  idle: 'Ready to sync',
  syncing: 'Syncing…',
  synced: 'Synced',
  conflict: 'Choose which plan to keep',
  offline: 'Offline',
  error: 'Sync problem',
};

function when(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function SignInForm() {
  const { signIn, signUp, requestPasswordReset } = useAccount();
  const [mode, setMode] = useState<'sign-in' | 'sign-up' | 'reset'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setError(null);
    setNotice(null);
    if (mode === 'reset') {
      if (!email.trim()) return setError('Enter the email you signed up with.');
    } else if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    try {
      if (mode === 'reset') {
        await requestPasswordReset(email);
        setNotice('If there’s an account with that email, a link to choose a new password is on its way. It works once, for an hour.');
        setMode('sign-in');
      } else if (mode === 'sign-in') await signIn(email, password);
      else if ((await signUp(email, password)) === 'confirm-email') {
        setNotice('Check your email and open the confirmation link, then come back and sign in.');
        setMode('sign-in');
        setPassword('');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Text variant="heading" style={{ marginBottom: space.md }}>
        {mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create an account' : 'Reset your password'}
      </Text>
      {mode === 'reset' ? (
        <Text muted style={{ marginBottom: space.md }}>We’ll email you a link to choose a new password.</Text>
      ) : null}
      <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" kind="email" />
      {mode !== 'reset' ? (
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          kind={mode === 'sign-in' ? 'password' : 'new-password'}
          hint={mode === 'sign-up' ? 'At least 8 characters.' : undefined}
        />
      ) : null}
      {error ? <Callout tone="warn"><Text>{error}</Text></Callout> : null}
      {notice ? <Callout tone="good"><Text>{notice}</Text></Callout> : null}
      <Row style={{ gap: space.sm, flexWrap: 'wrap' }}>
        <Button
          label={busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Email me a link'}
          onPress={submit}
          disabled={busy}
        />
        <Button
          kind="ghost"
          label={mode === 'sign-in' ? 'New here? Create an account' : 'Have an account? Sign in'}
          onPress={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            setError(null);
          }}
        />
        {mode === 'sign-in' ? (
          <Button
            kind="ghost"
            label="Forgot password?"
            onPress={() => {
              setMode('reset');
              setError(null);
              setNotice(null);
            }}
          />
        ) : null}
      </Row>
    </Card>
  );
}

function ConflictCard() {
  const { conflict, resolveConflict } = useAccount();
  const local = useLifeState();
  const [busy, setBusy] = useState(false);
  if (!conflict) return null;
  const choose = async (keep: 'device' | 'cloud') => {
    const ok = await confirmAction(
      keep === 'device' ? 'Keep this device’s plan?' : 'Use the cloud plan?',
      keep === 'device'
        ? 'The plan saved in your account will be replaced by the one on this device.'
        : 'The plan on this device will be replaced by the one saved in your account.',
      'Replace',
    );
    if (!ok) return;
    setBusy(true);
    try {
      await resolveConflict(keep);
    } finally {
      setBusy(false);
    }
  };
  const cloudName = (conflict.state as { name?: string })?.name || 'Unnamed plan';
  return (
    <Card tone="warning" style={{ marginTop: space.md }}>
      <Text variant="heading">Two different plans</Text>
      <Text muted style={{ marginVertical: space.sm }}>
        This device and your account each have changes. Pick the one to keep everywhere.
      </Text>
      <Text>• This device: {local.name || 'Unnamed plan'}</Text>
      <Text style={{ marginBottom: space.md }}>• Your account: {cloudName} (saved {when(conflict.updatedAt)})</Text>
      <Row style={{ gap: space.sm, flexWrap: 'wrap' }}>
        <Button label="Keep this device’s plan" onPress={() => choose('device')} disabled={busy} />
        <Button kind="secondary" label="Use the cloud plan" onPress={() => choose('cloud')} disabled={busy} />
      </Row>
    </Card>
  );
}

function SignedIn() {
  const { session, status, message, lastSyncedAt, syncNow, signOut, deleteAccount } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <Text variant="label" muted>SIGNED IN AS</Text>
        <Text variant="heading" style={{ marginBottom: space.md }}>{session?.user.email}</Text>
        <Text>
          {STATUS_TEXT[status]}
          {status === 'synced' && lastSyncedAt ? ` · ${when(lastSyncedAt)}` : ''}
        </Text>
        {message ? <Text muted style={{ marginTop: space.xs }}>{message}</Text> : null}
        <View style={{ marginTop: space.md }}>
          <Button kind="secondary" icon="sync-outline" label="Sync now" onPress={() => run(syncNow)} disabled={busy || status === 'syncing'} small />
        </View>
      </Card>
      <ConflictCard />
      {error ? <Callout tone="warn"><Text>{error}</Text></Callout> : null}

      <Section title="Sign out">
        <Text muted style={{ marginBottom: space.md }}>
          Your plan stays saved in your account either way. On a shared device, remove it from this device too.
        </Text>
        <Row style={{ gap: space.sm, flexWrap: 'wrap' }}>
          <Button kind="secondary" label="Sign out" onPress={() => run(() => signOut(false))} disabled={busy} />
          <Button
            kind="ghost"
            label="Sign out and remove from this device"
            onPress={() =>
              run(async () => {
                if (await confirmAction('Remove the plan from this device?', 'It stays saved in your account. Sign in again to get it back.', 'Remove')) await signOut(true);
              })
            }
            disabled={busy}
          />
        </Row>
      </Section>

      <Section title="Delete account">
        <Text muted style={{ marginBottom: space.md }}>
          Permanently deletes your account and the plan saved in it. The copy on this device stays until you clear it.
        </Text>
        <Button
          kind="danger"
          label="Delete my account"
          onPress={() =>
            run(async () => {
              if (await confirmAction('Delete your account?', 'Your account and the plan saved in it will be permanently deleted. This can’t be undone.', 'Delete')) await deleteAccount();
            })
          }
          disabled={busy}
        />
      </Section>
    </>
  );
}

/** Export works signed in or out: it's the person's own copy of what's on this device. */
function YourData() {
  const plan = useLifeState();
  const [error, setError] = useState<string | null>(null);
  const exportPlan = async () => {
    setError(null);
    try {
      const { filename, json } = buildPlanExport(plan);
      await saveTextFile(filename, json);
    } catch {
      setError('Couldn’t save the file. Try again.');
    }
  };
  return (
    <Section title="Your data">
      <Text muted style={{ marginBottom: space.md }}>
        Download your whole plan as a file to keep your own copy. It stays private: the file is made on this device.
      </Text>
      <View style={{ alignSelf: 'flex-start' }}>
        <Button kind="secondary" icon="download-outline" label="Export my plan" onPress={exportPlan} small />
      </View>
      {error ? <Callout tone="warn"><Text>{error}</Text></Callout> : null}
    </Section>
  );
}

export default function Account() {
  const { session, ready } = useAccount();
  return (
    <Screen
      back
      title="Account & sync"
      intro="Optional. Sign in to back up your plan and use it on your phone and on the web. Without an account, your plan stays only on this device."
    >
      {!ready ? <Text muted>Loading…</Text> : session ? <SignedIn /> : <SignInForm />}
      <YourData />
      <Text variant="caption" muted style={{ marginTop: space.xl }}>
        Your plan is private to your account: only you can read or change it.
      </Text>
    </Screen>
  );
}
