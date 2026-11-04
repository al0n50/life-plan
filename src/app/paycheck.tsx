import { router } from 'expo-router';
import { View } from 'react-native';

import { PaycheckSplit } from '@/components/plan';
import { Button, Card, Row, Screen, Section, Text } from '@/components/ui';
import { niceMonth, relDay } from '@/engine/dates';
import { money } from '@/engine/format';
import { jobName, phaseName } from '@/engine/model';
import { useLifeState, useModel } from '@/store/useLifePlan';

export default function Paycheck() {
  const st = useLifeState();
  const M = useModel();
  const upcoming = M.paydays.slice(0, 6);
  return (
    <Screen back title="Paycheck" intro="Exactly where each paycheck goes, by phase. Log what actually landed in Log; your income plan stays the same.">
      {upcoming.length ? (
        upcoming.map((p, i) => (
          <Card key={p.date + p.job}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text variant="heading">{i === 0 ? 'Your next paycheck' : relDay(p.date, M.today)}</Text>
                <Text variant="caption" muted>
                  {relDay(p.date, M.today)} · {jobName(st, p.job)} · expected
                </Text>
              </View>
              <Text style={{ fontSize: 22, fontWeight: '800' }}>{money(p.amount)}</Text>
            </Row>
            <PaycheckSplit st={st} M={M} amount={p.amount} reserve={p.reserve} moves={p.moves} />
          </Card>
        ))
      ) : (
        <Card>
          <Text muted>Add a job with its next payday in Income.</Text>
          <Row>
            <Button small kind="secondary" label="Go to Income" onPress={() => router.push('/income')} />
          </Row>
        </Card>
      )}
      <Section title="Why it changes">
        <Text muted>
          Splits shift as you move through phases. Right now you’re in “{phaseName(M.phase)}”{M.marks.debtFree ? `; debt-free around ${niceMonth(M.marks.debtFree)}` : ''}. Paychecks after a phase change show the new split automatically.
        </Text>
      </Section>
    </Screen>
  );
}
