import { useState } from 'react';
import { View } from 'react-native';

import { EntryList } from '@/components/editors';
import { StubView } from '@/components/money';
import { Button, Callout, Card, Chips, Field, Row, Screen, Section, Stat, Text } from '@/components/ui';
import { addDays, nice } from '@/engine/dates';
import { money, num } from '@/engine/format';
import { paydays } from '@/engine/schedule';
import { hoursForNet, monthlyNet, NO_STATE_TAX, paycheckNet } from '@/engine/tax';
import { useApply, useLifeState, useModel } from '@/store/useLifePlan';
import { space } from '@/theme';

export default function Income() {
  const st = useLifeState();
  const M = useModel();
  const apply = useApply();
  const rate = st.settings.stateTax;
  const [rateText, setRateText] = useState(rate ? String(rate) : '5');

  return (
    <Screen back title="Income" intro="What you expect to earn, including future income like a new job. Real paychecks go in Log and never overwrite this.">
      <Card>
        <Text variant="heading">Your state</Text>
        <Chips
          options={[
            { value: 'none', label: 'No state income tax' },
            { value: 'yes', label: 'My state taxes wages' },
          ]}
          value={rate ? 'yes' : 'none'}
          onChange={(v) => apply({ type: 'settings', patch: { stateTax: v === 'yes' ? num(rateText) || 5 : 0 } })}
        />
        {rate ? (
          <Row>
            <Field label="State rate % (estimate)" value={rateText} onChangeText={setRateText} numeric />
            <Button small kind="secondary" label="Use this rate" onPress={() => apply({ type: 'settings', patch: { stateTax: num(rateText) } })} />
          </Row>
        ) : null}
        <Text variant="caption" muted>
          States with no tax on wages: {NO_STATE_TAX}. Taxes are estimated for a single filer with a standard W-4, using 2026 federal rates. Your paystub has the exact numbers.
        </Text>
      </Card>

      <Section title="Jobs">
        <EntryList list="jobs" />
      </Section>

      {st.jobs.map((j) => {
        const L = M.learned[j.id];
        const next = paydays(j, M.today, addDays(M.today, 50)).slice(0, 3);
        return (
          <Card key={j.id}>
            <Text variant="heading">{j.name}: where each paycheck goes</Text>
            {(j.freq === 'weekly' || j.freq === 'biweekly') && !j.nextPay ? (
              <Callout tone="warn">
                <Text>Add this job’s next payday so its paychecks show up in your plan.</Text>
              </Callout>
            ) : null}
            <StubView job={j} stateTax={rate} />
            <Text variant="caption" muted>
              <Text style={{ fontWeight: '700' }}>{money(monthlyNet(j, rate))}</Text> a month take-home.
              {next.length ? ` Next paydays: ${next.map(nice).join(', ')}.` : j.startDate ? ` Starts ${nice(j.startDate)}.` : ''}
            </Text>
            {L ? (
              <Callout
                action={
                  <Row>
                    <Button
                      small
                      kind="secondary"
                      label={j.payType === 'hourly' ? `Use ${hoursForNet(j, L.avg, rate)} hours` : `Use ${money(L.avg)}`}
                      onPress={() =>
                        apply({ type: 'upsert', list: 'jobs', item: j.payType === 'hourly' ? { ...j, hours: hoursForNet(j, L.avg, rate) } : { ...j, amount: Math.round(L.avg) } })
                      }
                    />
                  </Row>
                }
              >
                <Text>
                  Your last {L.count} paychecks here averaged <Text style={{ fontWeight: '700' }}>{money(L.avg)}</Text>, not {money(paycheckNet(j, rate))}.
                  {j.payType === 'hourly' ? ` That’s about ${hoursForNet(j, L.avg, rate)} hours a week.` : ''}
                </Text>
              </Callout>
            ) : null}
          </Card>
        );
      })}

      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          <Stat label="Take-home / month" value={money(M.incomeM)} />
          <Stat label="Recurring + minimums" value={money(M.F)} />
          <Stat label="Yours to plan" value={money(Math.max(0, M.toPlan))} />
        </View>
      </Card>
    </Screen>
  );
}
