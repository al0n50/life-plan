import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button, Divider, Row, Text } from '@/components/ui';
import { relDay } from '@/engine/dates';
import { money, num } from '@/engine/format';
import { accountName, jobName, type Model } from '@/engine/model';
import type { LifeState, LogEntry, Where } from '@/engine/types';
import { useApply } from '@/store/useLifePlan';
import { radius, space, useColors } from '@/theme';

export function whereName(st: LifeState, w: Where): string {
  if (w === 'emergency') return 'Emergency fund';
  if (w === 'invest') return 'Investing';
  if (w.startsWith('acct:')) return accountName(st, w.slice(5));
  if (w.startsWith('debt:')) return st.debts.find((d) => d.id === w.slice(5))?.name ?? 'a removed debt';
  if (w.startsWith('goal:')) return `${st.goals.find((g) => g.id === w.slice(5))?.name ?? 'a removed goal'} (goal)`;
  return w;
}

export function describeLog(st: LifeState, l: LogEntry): [string, string] {
  switch (l.type) {
    case 'paycheck':
      return num(l.amount) > 0 ? ['Paycheck', jobName(st, l.job)] : ['No paycheck', jobName(st, l.job)];
    case 'extra':
      return ['Extra income', `${l.source}${l.selfEmployed ? ` · ${l.taxPct ?? st.settings.taxPct}% set aside for taxes` : ''}`];
    case 'spend':
      return ['One-time expense', `${l.what} · from ${whereName(st, l.from)}`];
    case 'balance':
      return ['Balance confirmed', whereName(st, l.account)];
    case 'note':
      return ['Plan change', l.text];
  }
}

export function PendingRows({ st, M, limit = 8 }: { st: LifeState; M: Model; limit?: number }) {
  const c = useColors();
  const apply = useApply();
  const [other, setOther] = useState<Record<string, string>>({});
  return (
    <View>
      {M.pending.slice(0, limit).map((p, i) => {
        const key = p.job + p.date;
        return (
          <View key={key}>
            {i > 0 ? <Divider /> : null}
            <View style={{ gap: space.sm, paddingVertical: 4 }}>
              <View>
                <Text style={{ fontWeight: '700' }}>
                  {relDay(p.date, M.today)} · {jobName(st, p.job)}
                </Text>
                <Text variant='caption' muted>Expected {money(p.expected)}</Text>
              </View>
              <Row>
                <Button small kind='secondary' label={`Got ${money(p.expected)}`} onPress={() => apply({ type: 'paycheck', job: p.job, amount: Math.round(p.expected * 100) / 100, date: p.date })} />
                <TextInput
                  value={other[key] ?? ''}
                  onChangeText={(t) => setOther({ ...other, [key]: t })}
                  placeholder='Other'
                  placeholderTextColor={c.muted}
                  keyboardType='decimal-pad'
                  accessibilityLabel='Actual amount'
                  style={{ width: 100, color: c.text, backgroundColor: c.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 7 }}
                />
                <Button small kind='secondary' label='Save' disabled={num(other[key]) <= 0} onPress={() => apply({ type: 'paycheck', job: p.job, amount: num(other[key]), date: p.date })} />
                <Button small kind='ghost' label='Not paid' onPress={() => apply({ type: 'no_paycheck', job: p.job, date: p.date })} />
              </Row>
            </View>
          </View>
        );
      })}
    </View>
  );
}

