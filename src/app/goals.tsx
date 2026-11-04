import { useState } from 'react';
import { View } from 'react-native';

import { EntryList } from '@/components/editors';
import { Button, Card, Chips, EstTag, Field, Progress, Row, Screen, Section, Stat, Text } from '@/components/ui';
import { describeCondition } from '@/engine/conditions';
import { isMonth, monthsBetween, niceMonth } from '@/engine/dates';
import { money, num, sum } from '@/engine/format';
import { accountName, phaseName } from '@/engine/model';
import { useApply, useLifeState, useModel } from '@/store/useLifePlan';
import { space, useColors } from '@/theme';

export default function Goals() {
  const c = useColors();
  const st = useLifeState();
  const M = useModel();
  const apply = useApply();
  const ef = M.now.ef;
  const efPct = M.efTarget > 0 ? Math.min(1, ef.v / M.efTarget) : 0;
  const [savedEdit, setSavedEdit] = useState<Record<string, string>>({});

  const need = sum(st.goals, (g) => {
    if (!isMonth(g.date) || !M.goalStatus[g.id]?.met) return 0;
    const left = Math.max(1, monthsBetween(M.today, `${g.date}-01`));
    return Math.max(0, (g.target - (M.now.goals[g.id]?.v ?? 0)) / left);
  });

  return (
    <Screen back title="Goals" intro="What you’re saving for. Your emergency fund sizes itself from your recurring expenses and minimums.">
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="heading">Emergency fund</Text>
          <EstTag est={ef.est} />
        </Row>
        <Chips options={[3, 4, 6, 9].map((n) => ({ value: n, label: `${n} months` }))} value={st.settings.efMonths} onChange={(efMonths) => apply({ type: 'settings', patch: { efMonths } })} />
        <Text style={{ fontSize: 22, fontWeight: '800' }}>
          {money(ef.v)} <Text muted style={{ fontSize: 15, fontWeight: '500' }}>today of {money(M.efTarget)}</Text>
        </Text>
        <Progress value={efPct} color={c.bucket.emergency} />
        <Text variant="caption" muted style={{ marginTop: 6 }}>
          {efPct >= 1 ? 'Fully funded.' : M.marks.efFull ? `Full around ${niceMonth(M.marks.efFull)} on your plan.` : 'Not growing yet on your plan.'} Kept in {accountName(st, M.routes.emergency)}.
        </Text>
      </Card>

      <Section title="Big goals">
        {st.goals.map((g) => {
          const a = M.now.goals[g.id] ?? { v: 0, est: false };
          const p = g.target > 0 ? Math.min(1, a.v / g.target) : 0;
          const when = M.marks[`g:${g.id}`];
          const late = when && isMonth(g.date) && when.slice(0, 7) > g.date;
          const lock = M.goalStatus[g.id];
          return (
            <Card key={g.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="heading">{g.name}</Text>
                <EstTag est={a.est} />
              </Row>
              <Text>
                <Text style={{ fontWeight: '800', fontSize: 18 }}>{money(a.v)}</Text> <Text muted>of {money(g.target)}{g.date ? ` by ${niceMonth(g.date)}` : ''}</Text>
              </Text>
              <Progress value={p} color={c.bucket.goals} />
              <Text variant="caption" color={late ? c.danger : c.muted} style={{ marginTop: 6 }}>
                {!lock?.met && g.unlockWhen
                  ? `Paused until ${describeCondition(g.unlockWhen, st).toLowerCase()}${lock?.when ? `, around ${niceMonth(lock.when)}` : ''}.`
                  : p >= 1
                    ? 'Done.'
                    : when
                      ? late
                        ? `Around ${niceMonth(when)}, after your date.`
                        : `On track for around ${niceMonth(when)}.`
                      : 'Not funded yet on your plan.'}
              </Text>
              <Row style={{ marginTop: space.sm }}>
                <Field label="Saved today (real amount)" value={savedEdit[g.id] ?? ''} onChangeText={(t) => setSavedEdit({ ...savedEdit, [g.id]: t })} numeric placeholder={String(Math.round(a.v))} />
                <Button
                  small
                  kind="secondary"
                  label="Confirm"
                  disabled={savedEdit[g.id] === undefined || savedEdit[g.id] === ''}
                  onPress={() => {
                    apply({ type: 'balance', account: `goal:${g.id}`, amount: num(savedEdit[g.id]), date: M.today });
                    setSavedEdit({ ...savedEdit, [g.id]: '' });
                  }}
                />
              </Row>
            </Card>
          );
        })}
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
            <Stat label="Goals need / month to hit dates" value={money(need)} />
            <Stat label="Plan sends now" value={money((Math.max(0, M.toPlan) * M.split[2]) / 100)} />
          </View>
          {M.phase === 'debt' || M.phase === 'starter' ? (
            <Text variant="caption" muted style={{ marginTop: 6 }}>
              Goals get a bigger share once you reach “{phaseName('safety')}”.
            </Text>
          ) : null}
        </Card>
      </Section>

      <Section title="Edit goals">
        <EntryList list="goals" />
      </Section>
    </Screen>
  );
}
