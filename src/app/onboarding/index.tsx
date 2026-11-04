import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { EntryList } from '@/components/editors';
import { DebtModeChoice } from '@/components/money';
import { Button, Callout, Card, Chips, Field, Progress, Row, Screen, Stat, Text } from '@/components/ui';
import { niceMonth } from '@/engine/dates';
import { money, num } from '@/engine/format';
import { phaseName } from '@/engine/model';
import { NO_STATE_TAX } from '@/engine/tax';
import { useApply, useLifePlan, useLifeState, useModel } from '@/store/useLifePlan';
import { space, useColors } from '@/theme';

const STEPS = ['welcome', 'jobs', 'expenses', 'debts', 'accounts', 'goals', 'northStar', 'review'] as const;
type Step = (typeof STEPS)[number];

const COPY: Record<Exclude<Step, 'welcome' | 'review' | 'northStar'>, { title: string; body: string }> = {
  jobs: { title: 'Where your money comes from', body: 'Add each job. For hourly jobs, your rate and usual hours are enough to estimate exactly what lands. Add future income too, like a job you start next month.' },
  expenses: { title: 'What repeats', body: 'Bills with due dates (phone, insurance, rent or helping at home), and a rough monthly amount for everyday spending like food and gas.' },
  debts: { title: 'What you owe', body: 'Cards, car loan, student loans, buy now pay later. Lots of people carry a balance; rough numbers are fine.' },
  accounts: { title: 'Where your money lives', body: 'Roughly what’s in checking, savings or a high-yield savings account, and any investing account.' },
  goals: { title: 'What you’re saving for', body: 'A trip, a car, a move. You can pause a goal until something else is done, like “after the card is paid off.”' },
};

export default function Onboarding() {
  const c = useColors();
  const st = useLifeState();
  const apply = useApply();
  const loadExample = useLifePlan((s) => s.loadExample);
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const next = () => setI((n) => Math.min(STEPS.length - 1, n + 1));
  const back = () => setI((n) => Math.max(0, n - 1));
  const finish = () => {
    apply({ type: 'profile', patch: { onboarded: true } });
    router.replace('/home');
  };

  if (step === 'welcome') {
    return (
      <Screen>
        <View style={{ paddingTop: 56, gap: space.lg }}>
          <Text variant="label" color={c.primary}>LIFE PLAN</Text>
          <Text variant="title" style={{ fontSize: 34, lineHeight: 40 }}>Plan everything, starting with what you know now.</Text>
          <Text muted>
            Your paychecks, bills, debt, savings, career, and the life you’re building, in one plan that runs every day. Rough numbers are fine, you can skip anything, and everyone starts somewhere.
          </Text>
          <Field label="What should we call you?" value={st.name} onChangeText={(name) => apply({ type: 'profile', patch: { name } })} placeholder="First name" />
          <Button label="Start my plan" icon="arrow-forward" onPress={next} />
          <Button
            label="Explore an example plan first"
            kind="secondary"
            onPress={() => {
              loadExample();
              router.replace('/home');
            }}
          />
          <Text variant="caption" muted>Takes about 10 minutes. Your data stays on this device. Never enter account numbers or passwords.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingTop: space.lg, gap: space.sm }}>
        <Progress value={i / (STEPS.length - 1)} />
        <Text variant="caption" muted>Step {i} of {STEPS.length - 1}</Text>
      </View>

      <View style={{ marginTop: space.lg }}>
        {step === 'review' ? (
          <Review />
        ) : step === 'northStar' ? (
          <NorthStarStep />
        ) : (
          <>
            <Text variant="title">{COPY[step].title}</Text>
            <Text muted style={{ marginTop: space.xs, marginBottom: space.lg }}>{COPY[step].body}</Text>
            {step === 'jobs' ? <StateTax /> : null}
            <EntryList list={step} minItems={step === 'accounts' ? 1 : 0} />
            {step === 'debts' && st.debts.length ? (
              <View style={{ marginTop: space.lg, gap: space.sm }}>
                <Text variant="heading">How do you want to handle it?</Text>
                <DebtModeChoiceWithModel />
              </View>
            ) : null}
          </>
        )}
      </View>

      <Row style={{ marginTop: space.xl, justifyContent: 'space-between' }}>
        <Button label="Back" kind="ghost" icon="arrow-back" onPress={back} />
        {step === 'review' ? (
          <Button label="Looks right, build my plan" icon="sparkles" onPress={finish} disabled={!st.jobs.length} />
        ) : (
          <Button label={step === 'northStar' ? 'Review' : 'Next'} icon="arrow-forward" onPress={next} />
        )}
      </Row>
    </Screen>
  );
}

function StateTax() {
  const st = useLifeState();
  const apply = useApply();
  const [rate, setRate] = useState(st.settings.stateTax ? String(st.settings.stateTax) : '');
  return (
    <Card>
      <Text variant="heading">Does your state tax wages?</Text>
      <Chips
        options={[
          { value: 'none', label: 'No' },
          { value: 'yes', label: 'Yes' },
        ]}
        value={st.settings.stateTax ? 'yes' : 'none'}
        onChange={(v) => apply({ type: 'settings', patch: { stateTax: v === 'yes' ? num(rate) || 5 : 0 } })}
      />
      {st.settings.stateTax ? (
        <Field label="Rate % (estimate)" value={rate} onChangeText={(t) => { setRate(t); apply({ type: 'settings', patch: { stateTax: num(t) } }); }} numeric placeholder="5" />
      ) : null}
      <Text variant="caption" muted>No tax on wages in {NO_STATE_TAX}.</Text>
    </Card>
  );
}

function DebtModeChoiceWithModel() {
  const st = useLifeState();
  const M = useModel();
  return <DebtModeChoice st={st} M={M} />;
}

function NorthStarStep() {
  const st = useLifeState();
  const apply = useApply();
  const ns = st.northStar;
  const set = (patch: Partial<typeof ns>) => apply({ type: 'profile', patch: { northStar: { ...ns, ...patch } } });
  const [anchors, setAnchors] = useState(ns.anchors.join(', '));
  return (
    <View>
      <Text variant="title">Your North Star</Text>
      <Text muted style={{ marginTop: space.xs, marginBottom: space.lg }}>
        Optional, but it’s the point of all this. What does the life you’re building look like, and who is it for?
      </Text>
      <Field label="The life you’re building" value={ns.statement} onChangeText={(statement) => set({ statement })} placeholder="Financial independence, not to escape, but to show up for everyone I love." />
      <Field
        label="Who it’s for (comma separated)"
        value={anchors}
        onChangeText={(t) => {
          setAnchors(t);
          set({ anchors: t.split(',').map((s) => s.trim()).filter(Boolean) });
        }}
        placeholder="Mom & Dad, my sisters, friends who are family"
      />
      <Row>
        <Field label="By age (optional)" value={ns.targetAge ? String(ns.targetAge) : ''} onChangeText={(t) => set({ targetAge: Number(t) || undefined })} numeric placeholder="30" />
        <Field label="Birth year (optional)" value={ns.birthYear ? String(ns.birthYear) : ''} onChangeText={(t) => set({ birthYear: Number(t) || undefined })} numeric placeholder="2003" />
      </Row>
      <Text variant="caption" muted>You can add career tracks, life events and actions any time in the Life tab.</Text>
    </View>
  );
}

function Review() {
  const c = useColors();
  const st = useLifeState();
  const M = useModel();
  return (
    <View>
      <Text variant="title">Here’s your starting point</Text>
      <Text muted style={{ marginTop: space.xs, marginBottom: space.lg }}>Check it over. You can change anything later.</Text>
      {!st.jobs.length ? (
        <Callout tone="warn">
          <Text>Add at least one job so your plan has paychecks to work with.</Text>
        </Callout>
      ) : null}
      <Card>
        <Row>
          <Stat label="Take-home / month" value={money(M.incomeM)} />
          <Stat label="Recurring + minimums" value={money(M.F)} />
          <Stat label="Yours to plan" value={money(M.toPlan)} color={M.toPlan < 0 ? c.danger : c.positive} />
        </Row>
      </Card>
      <Card>
        <Text variant="heading">You start in: {phaseName(M.phase)}</Text>
        <Text muted>
          {M.now.totalDebt > 0.5 && M.marks.debtFree ? `Debt-free around ${niceMonth(M.marks.debtFree)}. ` : ''}
          {M.marks.efFull ? `Emergency fund full around ${niceMonth(M.marks.efFull)}.` : ''}
        </Text>
      </Card>
    </View>
  );
}
