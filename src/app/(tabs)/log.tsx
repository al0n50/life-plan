import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Chips, Divider, EstTag, Field, Row, Screen, Section, Text } from '@/components/ui';
import { isDate, nice } from '@/engine/dates';
import { money, num } from '@/engine/format';

import type { Where } from '@/engine/types';
import { describeLog, PendingRows } from '@/components/logging';
import { useApply, useLifeState, useModel } from '@/store/useLifePlan';
import { space, useColors } from '@/theme';

type Quick = 'paid' | 'extra' | 'spend' | 'balance';


export default function Log() {
  const c = useColors();
  const st = useLifeState();
  const M = useModel();
  const apply = useApply();
  const [q, setQ] = useState<Quick>('paid');
  const [job, setJob] = useState(st.jobs[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(M.today);
  const [what, setWhat] = useState('');
  const [selfEmp, setSelfEmp] = useState(false);
  const [from, setFrom] = useState<Where>(`acct:${M.routes.pay}`);
  const [acct, setAcct] = useState<Where>(`acct:${M.routes.pay}`);
  const [done, setDone] = useState('');

  const ok = num(amount) > 0 && isDate(date) && date <= M.today;
  const clear = (msg: string) => {
    setAmount('');
    setWhat('');
    setDone(msg);
  };
  const spendFrom: { value: Where; label: string }[] = [
    ...st.accounts.map((a) => ({ value: `acct:${a.id}`, label: a.name })),
    { value: 'emergency', label: 'Emergency fund' },
    ...st.goals.map((g) => ({ value: `goal:${g.id}`, label: `${g.name} (goal)` })),
  ];
  const balanceOf: { value: Where; label: string }[] = [
    ...st.accounts.map((a) => ({ value: `acct:${a.id}`, label: a.name })),
    ...st.debts.map((d) => ({ value: `debt:${d.id}`, label: `${d.name} (debt)` })),
  ];
  const feed = [...st.log].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 40);

  return (
    <Screen title="Log" intro="Log real life here, whenever it happens. Your plan stays the same unless you change it, and everything you log replaces an estimate.">
      {M.pending.length ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="heading">Paydays to confirm</Text>
            <EstTag est />
          </Row>
          <Text variant="caption" muted>These counted as the amount your plan expected.</Text>
          <PendingRows st={st} M={M} />
        </Card>
      ) : null}

      <Card>
        <Text variant="heading" style={{ marginBottom: space.sm }}>Add an update</Text>
        <Chips
          options={[
            { value: 'paid', label: 'Got paid' },
            { value: 'extra', label: 'Extra money' },
            { value: 'spend', label: 'One-time expense' },
            { value: 'balance', label: 'Confirm a balance' },
          ]}
          value={q}
          onChange={(v) => {
            setQ(v);
            setDone('');
          }}
        />
        {q === 'paid' && !st.jobs.length ? (
          <Text muted>Add a job in Income first.</Text>
        ) : (
          <>
            {q === 'paid' ? <Chips options={st.jobs.map((j) => ({ value: j.id, label: j.name }))} value={job} onChange={setJob} /> : null}
            {q === 'extra' || q === 'spend' ? (
              <Field label="What it was" value={what} onChangeText={setWhat} placeholder={q === 'extra' ? 'Tax refund, side gig…' : 'Car repair'} />
            ) : null}
            {q === 'spend' ? (
              <>
                <Text variant="label" muted style={{ marginBottom: space.xs }}>Paid from</Text>
                <Chips options={spendFrom} value={from} onChange={setFrom} />
              </>
            ) : null}
            {q === 'balance' ? <Chips options={balanceOf} value={acct} onChange={setAcct} /> : null}
            <Row>
              <Field label={q === 'balance' ? 'Real balance' : 'Amount'} value={amount} onChangeText={setAmount} numeric />
              <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" hint={date > M.today ? 'Can’t log the future' : !isDate(date) ? 'Use YYYY-MM-DD' : undefined} />
            </Row>
            {q === 'extra' ? (
              <Chips
                options={[
                  { value: 'no', label: 'Regular income' },
                  { value: 'yes', label: `Side hustle (set aside ${st.settings.taxPct}% for taxes)` },
                ]}
                value={selfEmp ? 'yes' : 'no'}
                onChange={(v) => setSelfEmp(v === 'yes')}
              />
            ) : null}
            <Row>
              <Button
                label={q === 'paid' ? 'Log paycheck' : q === 'extra' ? 'Add income' : q === 'spend' ? 'Log expense' : 'Confirm balance'}
                disabled={!ok || (q === 'paid' && !job) || ((q === 'extra' || q === 'spend') && !what)}
                onPress={() => {
                  const a = num(amount);
                  if (q === 'paid') apply({ type: 'paycheck', job, amount: a, date });
                  if (q === 'extra') apply({ type: 'extra', source: what, amount: a, date, selfEmployed: selfEmp });
                  if (q === 'spend') apply({ type: 'spend', what, amount: a, date, from });
                  if (q === 'balance') apply({ type: 'balance', account: acct, amount: a, date });
                  clear(`Saved. ${q === 'balance' ? 'That balance replaces the estimate from ' + nice(date) + ' on.' : 'Your plan has been updated.'}`);
                }}
              />
              {done ? <Text color={c.positive}>{done}</Text> : null}
            </Row>
          </>
        )}
        <Text variant="caption" muted style={{ marginTop: space.md }}>
          Changing your pay, expenses, or debts for good? Edit them in More.
        </Text>
      </Card>

      <Section title="History" action={<Button small kind="ghost" label="Full review" onPress={() => router.push('/review')} />}>
        <Card>
          {feed.length ? (
            feed.map((l, i) => {
              const [t, d] = describeLog(st, l);
              const amt = l.type === 'note' ? '' : `${l.type === 'spend' ? '−' : ''}${money(num(l.amount))}`;
              return (
                <View key={l.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 4 }}>
                    <Text variant="caption" muted style={{ width: 52, fontWeight: '600' }}>{nice(l.date)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600' }}>{t}</Text>
                      {d ? <Text variant="caption" muted>{d}</Text> : null}
                    </View>
                    <Text style={{ fontWeight: '700' }}>{amt}</Text>
                    <Pressable accessibilityLabel="Remove this update" hitSlop={8} onPress={() => apply({ type: 'remove_log', id: l.id })}>
                      <Ionicons name="close" size={18} color={c.muted} />
                    </Pressable>
                  </View>
                </View>
              );
            })
          ) : (
            <Text muted>Nothing logged yet.</Text>
          )}
        </Card>
      </Section>
    </Screen>
  );
}
