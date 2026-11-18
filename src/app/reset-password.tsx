import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Callout, Card, Field, Row, Screen, Text } from '@/components/ui';
import { newPasswordProblem } from '@/sync/recovery';
import { useAccount } from '@/sync/useAccount';
import { space } from '@/theme';

/** Where a password-reset email lands: choose a new password for the account. */
export default function ResetPassword() {
  const { session, ready, setNewPassword } = useAccount();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (busy) return;
    const problem = newPasswordProblem(password, confirm);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await setNewPassword(password);
      setDone(true);
      setPassword('');
      setConfirm('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Choose a new password">
      {!ready ? (
        <Text muted>Loading…</Text>
      ) : done ? (
        <Card>
          <Text variant="heading" style={{ marginBottom: space.sm }}>Password changed</Text>
          <Text muted style={{ marginBottom: space.md }}>
            You’re signed in. Use the new password next time, on this device and your others.
          </Text>
          <Button label="Go to my plan" onPress={() => router.replace('/')} />
        </Card>
      ) : !session ? (
        <Card>
          <Text variant="heading" style={{ marginBottom: space.sm }}>This link didn’t work</Text>
          <Text muted style={{ marginBottom: space.md }}>
            Reset links work once and expire after an hour. Ask for a new one from the sign-in screen.
          </Text>
          <Button label="Back to sign in" onPress={() => router.replace('/account')} />
        </Card>
      ) : (
        <Card>
          <Text muted style={{ marginBottom: space.md }}>For {session.user.email}</Text>
          <Field label="New password" value={password} onChangeText={setPassword} kind="new-password" hint="At least 8 characters." />
          <Field label="Type it again" value={confirm} onChangeText={setConfirm} kind="new-password" />
          {error ? <Callout tone="warn"><Text>{error}</Text></Callout> : null}
          <Row style={{ gap: space.sm, flexWrap: 'wrap' }}>
            <Button label={busy ? 'Saving…' : 'Save new password'} onPress={submit} disabled={busy} />
          </Row>
        </Card>
      )}
    </Screen>
  );
}
