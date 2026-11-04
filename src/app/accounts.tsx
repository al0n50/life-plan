import { useState } from 'react';
import { View } from 'react-native';

import { ACCOUNT_TYPES, EntryList } from '@/components/editors';
import { LegendRow } from '@/components/plan';
import { Button, Callout, Card, Chips, EstTag, Field, Row, Screen, Section, Text } from '@/components/ui';
import { money, num } from '@/engine/format';
import type { BucketColor } from '@/engine/model';
import type { Part } from '@/engine/simulate';
import type { Routes } from '@/engine/types';
import { useApply, useLifeState, useModel } from '@/store/useLifePlan';
import { space, useColors } from '@/theme';

const ROUTES: { key: keyof Routes; label: string; why: string; color: BucketColor }[] = [
  { key: 'pay', label: 'Paychecks land in', why: 'Bills, minimums, everyday spending, and fun money stay here.', color: 'mins' },
  { key: 'emergency', label: 'Emergency fund', why: 'Only for real emergencies: job loss, car repair, medical bills.', color: 'emergency' },
  { key: 'goals', label: 'Big goals', why: 'Trips, a car, a move. Kept separate so it doesn’t get spent.', color: 'goals' },
  { key: 'invest', label: 'Investing', why: 'Long-term money you won’t touch for years.', color: 'invest' },
  { key: 'tax', label: 'Tax set-aside', why: 'From side-hustle income, saved for tax time.', color: 'tax' },
];

export default function Accounts() {
  const c = useColors();
  const st = useLifeState();
  const M = useModel();
  const apply = useApply();
  const [confirm, setConfirm] = useState<Record<string, string>>({});
  const partName = (p: Part) =>
    p === 'chk' ? 'Money for bills and spending' : p === 'ef' ? 'Emergency fund' : p === 'inv' ? 'Investing' : p === 'tax' ? 'Tax set-aside' : (st.goals.find((g) => g.id === p.slice(2))?.name ?? 'Goal');
  const partVal = (p: Part) =>
    p === 'chk' ? M.now.chk.v : p === 'ef' ? M.now.ef.v : p === 'inv' ? M.now.inv.v : p === 'tax' ? M.now.tax.v : (M.now.goals[p.slice(2)]?.v ?? 0);
  const hasHysa = st.accounts.some((a) => a.type === 'hysa');
  const hasInv = st.accounts.some((a) => a.type === 'investing');

  return (
    <Screen back title="Accounts" intro="Where your money actually lives. Each part of your paycheck has a home, so you always know what’s yours to spend and what’s set aside.">
      {st.accounts.map((a) => {
        const s = M.now.acct[a.id] ?? { v: 0, est: false, parts: [] };
        const parts = s.parts.filter((p) => Math.abs(partVal(p)) > 0.5);
        const other = M.now.other[a.id]?.v ?? 0;
        return (
          <Card key={a.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text variant="heading">{a.name}</Text>
                <Text variant="caption" muted>{ACCOUNT_TYPES[a.type]}</Text>
              </View>
              <EstTag est={s.est} conf={s.conf} />
            </Row>
            <Text style={{ fontSize: 24, fontWeight: '800' }}>{money(s.v)}</Text>
            {parts.length + (other > 0.5 ? 1 : 0) > 1 ? (
              <View>
                {parts.map((p) => (
                  <Row key={p} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text muted>{partName(p)}</Text>
                    <Text style={{ fontWeight: '700' }}>{money(partVal(p))}</Text>
                  </Row>
                ))}
                {other > 0.5 ? (
                  <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text muted>Other money</Text>
                    <Text style={{ fontWeight: '700' }}>{money(other)}</Text>
                  </Row>
                ) : null}
              </View>
            ) : null}
            <Row>
              <Field label="Real balance" value={confirm[a.id] ?? ''} onChangeText={(t) => setConfirm({ ...confirm, [a.id]: t })} numeric placeholder={String(Math.round(s.v))} />
              <Button
                small
                kind="secondary"
                label="Confirm balance"
                disabled={!confirm[a.id]}
                onPress={() => {
                  apply({ type: 'balance', account: `acct:${a.id}`, amount: num(confirm[a.id]), date: M.today });
                  setConfirm({ ...confirm, [a.id]: '' });
                }}
              />
            </Row>
          </Card>
        );
      })}
      <Text variant="caption" muted>
        Estimates assume your paychecks arrived, your bills and minimums were paid on their due dates, and you spent your everyday budget and fun money. When one account holds several things, a confirmed balance adjusts each of them by the same share.
      </Text>

      <Section title="Where each part of your paycheck goes">
        <Card>
          {ROUTES.map((r) => (
            <View key={r.key} style={{ marginBottom: space.sm }}>
              <LegendRow color={c.bucket[r.color]} title={r.label} sub={r.why} />
              <Chips options={st.accounts.map((a) => ({ value: a.id, label: a.name }))} value={M.routes[r.key]} onChange={(id) => apply({ type: 'routes', patch: { [r.key]: id } })} />
            </View>
          ))}
        </Card>
        {!hasHysa ? (
          <Callout>
            <Text>
              <Text style={{ fontWeight: '700' }}>Tip:</Text> a high-yield savings account (HYSA) usually pays more interest than a regular savings account, and keeping your emergency fund there makes it harder to spend by accident.
            </Text>
          </Callout>
        ) : null}
        {!hasInv && (M.phase === 'goals' || M.phase === 'wealth') ? (
          <Callout>
            <Text>
              <Text style={{ fontWeight: '700' }}>Tip:</Text> you’ve reached the investing phases. A Roth IRA is a common first investing account. Add it here once you open one.
            </Text>
          </Callout>
        ) : null}
      </Section>

      <Section title="Edit accounts">
        <EntryList list="accounts" minItems={1} />
      </Section>
    </Screen>
  );
}
