import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { PendingRows } from '@/components/logging';
import { Button, Card, Divider, Field, Row, Screen, Section, Text } from '@/components/ui';
import { money, num } from '@/engine/format';
import { paycheckNet } from '@/engine/tax';
import type { Update } from '@/engine/updates';
import { useApply, useLifeState, useModel } from '@/store/useLifePlan';
import { space } from '@/theme';

export default function Review() {
  const st = useLifeState();
  const M = useModel();
  const apply = useApply();
  const rows = [
    ...st.accounts.map((a) => ({ key: `acct:${a.id}`, label: a.name, v: M.now.acct[a.id]?.v ?? 0 })),
    ...st.debts.filter((d) => (M.now.debts[d.id]?.v ?? 0) > 0.5).map((d) => ({ key: `debt:${d.id}`, label: `${d.name} (debt)`, v: M.now.debts[d.id].v })),
  ];
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.key, String(Math.round(Math.max(0, r.v)))])));

  return (
    <Screen back title="Full review" intro="Check your real balances against the estimates. Anything you change replaces the estimate from today on. About 5 minutes.">
      <Section title="1. Balances">
        <Card>
          {rows.map((r, i) => (
            <View key={r.key}>
              {i > 0 ? <Divider /> : null}
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700' }}>{r.label}</Text>
                  <Text variant="caption" muted>Estimated {money(r.v)}</Text>
                </View>
                <View style={{ width: 150 }}>
                  <Field label="Real balance" value={vals[r.key] ?? ''} onChangeText={(t) => setVals({ ...vals, [r.key]: t })} numeric />
                </View>
              </Row>
            </View>
          ))}
        </Card>
      </Section>

      {M.pending.length ? (
        <Section title="2. Paydays">
          <Card>
            <PendingRows st={st} M={M} />
          </Card>
        </Section>
      ) : null}

      <Section title={`${M.pending.length ? 3 : 2}. Income and expenses`}>
        <Card>
          <Text muted>
            {st.jobs.map((j) => `${j.name}: about ${money(paycheckNet(j, st.settings.stateTax))} per paycheck`).join(' · ') || 'No jobs yet'}. Still the same hours?
          </Text>
          <Row style={{ marginBottom: space.sm }}>
            <Button small kind="ghost" label="Edit income" onPress={() => router.push('/income')} />
          </Row>
          <Text muted>
            {st.expenses.length} recurring expenses, {money(M.expensesM)} a month. Anything new or cancelled?
          </Text>
          <Row>
            <Button small kind="ghost" label="Review expenses" onPress={() => router.push('/expenses')} />
          </Row>
        </Card>
      </Section>

      <Row style={{ marginTop: space.xl }}>
        <Button
          label="Save review"
          onPress={() => {
            const updates: Update[] = rows
              .filter((r) => vals[r.key] !== undefined && vals[r.key] !== '' && Math.abs(num(vals[r.key]) - Math.max(0, r.v)) >= 1)
              .map((r) => ({ type: 'balance', account: r.key, amount: num(vals[r.key]), date: M.today }));
            apply(...updates, { type: 'profile', patch: { lastReview: M.today } });
            router.back();
          }}
        />
      </Row>
    </Screen>
  );
}
