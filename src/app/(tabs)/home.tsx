import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Agenda, LegendRow, PaycheckSplit, PhaseCard } from '@/components/plan';
import { Button, Callout, Card, EstTag, Label, Pill, Progress, Row, Screen, Stat, Text } from '@/components/ui';
import { addDays, daysBetween, nice, niceMonth, relDay, wdName } from '@/engine/dates';
import { money, num, sum } from '@/engine/format';
import { accountName, agenda, jobName } from '@/engine/model';
import { hasDueDate } from '@/engine/schedule';
import { useApply, useLifePlan, useLifeState, useModel } from '@/store/useLifePlan';
import { radius, space, useColors } from '@/theme';

export default function Home() {
  const c = useColors();
  const st = useLifeState();
  const M = useModel();
  const apply = useApply();
  const startFresh = useLifePlan((s) => s.startFresh);
  const [snoozed, setSnoozed] = useState<Record<string, boolean>>({});
  const [amt, setAmt] = useState('');

  const prompt = M.pending.find((p) => p.date >= addDays(M.today, -7) && !snoozed[p.job + p.date]);
  const soon = agenda(st, M, 14).filter((x) => x.kind !== 'pending');
  const beforePay = M.next ? M.future.filter((f) => (f.kind === 'bill' || f.kind === 'debt') && f.date < M.next!.date) : [];
  const flex = st.expenses.filter((e) => !hasDueDate(e));
  const chk = M.now.acct[M.routes.pay] ?? { v: 0, est: false };
  const ef = M.now.ef;
  const efPct = M.efTarget > 0 ? Math.min(1, ef.v / M.efTarget) : 0;
  const nameOf = (f: (typeof beforePay)[number]) =>
    f.kind === 'bill' ? st.expenses.find((e) => e.id === f.id)?.name : f.kind === 'debt' ? st.debts.find((d) => d.id === f.id)?.name : '';

  return (
    <Screen subtitle={`As of ${nice(M.today)}`} title={st.name ? `${st.name}’s plan` : 'Your plan'}>
      {st.example ? (
        <Callout
          action={
            <Row>
              <Button
                small
                label="Build my own plan"
                onPress={() => {
                  startFresh();
                  router.replace('/onboarding');
                }}
              />
            </Row>
          }
        >
          <Text>You’re exploring an example plan. The first change you make turns it into yours.</Text>
        </Callout>
      ) : null}

      {prompt ? (
        <View style={{ borderWidth: 2, borderColor: c.primary, borderRadius: radius.lg, padding: space.lg, gap: space.md, marginBottom: space.md, backgroundColor: c.surface }}>
          <Label>
            {nice(prompt.date)} · {jobName(st, prompt.job)}
          </Label>
          <Text style={{ fontSize: 20, fontWeight: '800' }}>
            {prompt.date === M.today
              ? 'It’s payday!'
              : `Payday was ${daysBetween(prompt.date, M.today) === 1 ? 'yesterday' : `${wdName(prompt.date)}, ${nice(prompt.date)}`}.`}{' '}
            What hit your account?
          </Text>
          <Row>
            <TextInput
              value={amt}
              onChangeText={setAmt}
              keyboardType="decimal-pad"
              placeholder={String(Math.round(prompt.expected))}
              placeholderTextColor={c.muted}
              accessibilityLabel="Amount you got paid"
              style={{ width: 140, fontSize: 20, fontWeight: '700', color: c.text, backgroundColor: c.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10 }}
            />
            <Button
              label="Log it"
              disabled={num(amt) <= 0}
              onPress={() => {
                apply({ type: 'paycheck', job: prompt.job, amount: num(amt), date: prompt.date });
                setAmt('');
              }}
            />
            <Button kind="ghost" label={`It was ${money(prompt.expected)}`} onPress={() => apply({ type: 'paycheck', job: prompt.job, amount: Math.round(prompt.expected * 100) / 100, date: prompt.date })} />
            <Button kind="ghost" label="Not yet" onPress={() => setSnoozed({ ...snoozed, [prompt.job + prompt.date]: true })} />
          </Row>
          <Text variant="caption" muted>
            Your plan expected about {money(prompt.expected)}. Enter what actually landed and your plan adjusts. Your income plan stays the same.
          </Text>
        </View>
      ) : null}

      {M.needsReview ? (
        <Callout action={<Row><Button small label="Start a full review" onPress={() => router.push('/review')} /></Row>}>
          <Text>
            <Text style={{ fontWeight: '700' }}>It’s been {M.daysAway} days since your last update.</Text> Your plan kept running, but it’s an estimate now. A full review takes about 5 minutes.
          </Text>
        </Callout>
      ) : !prompt && M.pending.length ? (
        <Callout action={<Row><Button small label="Confirm paydays" onPress={() => router.push('/log')} /></Row>}>
          <Text>
            <Text style={{ fontWeight: '700' }}>
              {M.pending.length} payday{M.pending.length > 1 ? 's' : ''} to confirm.
            </Text>{' '}
            Until you confirm, they count as what your plan expected.
          </Text>
        </Callout>
      ) : null}

      <PhaseCard M={M} />

      <Card>
        <Row>
          <Stat label="Take-home / month" value={money(M.incomeM)} sub={`From ${st.jobs.filter((j) => !j.startDate || j.startDate <= M.today).length} job(s), after taxes`} />
          <Stat label="Recurring + minimums" value={money(M.F)} sub={`${money(M.expensesM)} expenses · ${money(M.planMins)} minimums`} />
        </Row>
        <Row style={{ marginTop: space.md }}>
          <Stat label="Yours to plan / month" value={money(Math.max(0, M.toPlan))} color={M.toPlan < 0 ? c.danger : undefined} sub={M.toPlan < 0 ? `${money(-M.toPlan)} short each month` : 'Split across your buckets'} />
          <Stat
            label="Total debt"
            value={money(M.now.totalDebt)}
            sub={M.now.totalDebt > 0.5 ? (M.marks.debtFree ? `Debt-free around ${niceMonth(M.marks.debtFree)}` : 'Not on track to pay off') : 'Debt-free'}
          />
        </Row>
      </Card>

      <Card>
        {M.next ? (
          <>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text variant="heading">Your next paycheck</Text>
                <Text variant="caption" muted>
                  {relDay(M.next.date, M.today)} · {jobName(st, M.next.job)}
                </Text>
              </View>
              <Text style={{ fontSize: 22, fontWeight: '800' }}>{money(M.next.amount)}</Text>
            </Row>
            <PaycheckSplit st={st} M={M} amount={M.next.amount} reserve={M.next.reserve} moves={M.next.moves} />
          </>
        ) : (
          <>
            <Text variant="heading">Your next paycheck</Text>
            <Text muted>Add a job and its next payday in Income to see where your next paycheck goes.</Text>
            <Row style={{ marginTop: space.sm }}>
              <Button small kind="secondary" label="Go to Income" onPress={() => router.push('/income')} />
            </Row>
          </>
        )}
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="heading">Coming up</Text>
          <Button small kind="ghost" label="Full calendar" onPress={() => router.push('/calendar')} />
        </Row>
        {soon.length ? <Agenda st={st} M={M} items={soon} /> : <Text muted>Nothing scheduled in the next two weeks.</Text>}
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="heading">{accountName(st, M.routes.pay)}</Text>
          <EstTag est={chk.est} conf={chk.conf} />
        </Row>
        <Text style={{ fontSize: 22, fontWeight: '800' }} color={chk.v < 0 ? c.danger : c.text}>
          {money(chk.v)}
        </Text>
        {chk.v < 0 ? <Text color={c.danger}>Your checking may be running low. Confirm your real balance in Log.</Text> : null}
        {M.next ? (
          <LegendRow
            color={c.bucket.mins}
            title="Bills before your next payday"
            sub={beforePay.length ? beforePay.map((f) => `${nameOf(f)} ${nice(f.date)}`).join(' · ') : `Nothing due before ${nice(M.next.date)}`}
            amount={sum(beforePay, (f) => f.amount)}
          />
        ) : null}
        {flex.length ? <LegendRow color={c.bucket.fun} title="Everyday spending budget" sub={`${flex.map((e) => e.name).join(', ')}. Spend it through the month.`} amount={M.flexM} right="/mo" /> : null}
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="heading">Emergency fund</Text>
          <EstTag est={ef.est} />
        </Row>
        <Text style={{ fontSize: 22, fontWeight: '800' }}>
          {money(ef.v)} <Text muted style={{ fontSize: 15, fontWeight: '500' }}>of {money(M.efTarget)}</Text>
        </Text>
        <Progress value={efPct} color={c.bucket.emergency} />
        <Text variant="caption" muted style={{ marginTop: 6 }}>
          {efPct >= 1 ? 'Fully funded.' : M.marks.efFull ? `Full around ${niceMonth(M.marks.efFull)} on your plan. Kept in ${accountName(st, M.routes.emergency)}.` : 'Not growing yet on your plan.'}
        </Text>
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="heading">Debt</Text>
          {M.now.totalDebt > 0.5 ? <EstTag est={st.debts.some((d) => M.now.debts[d.id]?.est && M.now.debts[d.id].v > 0.5)} /> : <Pill tone="good" label="Debt-free" />}
        </Row>
        {M.now.totalDebt > 0.5 ? (
          <Text>
            {money(M.now.totalDebt)} left.{' '}
            {st.settings.debtMode === 'asap' ? 'Extra money goes to ' : 'Paying minimums, with freed-up payments rolling into '}
            <Text style={{ fontWeight: '700' }}>{M.focus?.name}</Text>
            {st.settings.debtMode === 'asap' ? ' first.' : '.'}
            {M.marks.debtFree ? (
              <>
                {' '}Debt-free around <Text style={{ fontWeight: '700' }}>{niceMonth(M.marks.debtFree)}</Text>.
              </>
            ) : null}
          </Text>
        ) : (
          <Text muted>Nothing owed. Your debt share now goes to savings.</Text>
        )}
      </Card>
    </Screen>
  );
}
