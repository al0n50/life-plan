import { EntryList } from '@/components/editors';
import { DebtModeChoice } from '@/components/money';
import { Card, EstTag, Pill, Row, Screen, Section, Stat, Text } from '@/components/ui';
import { niceMonth } from '@/engine/dates';
import { money } from '@/engine/format';
import { useLifeState, useModel } from '@/store/useLifePlan';

export default function Debt() {
  const st = useLifeState();
  const M = useModel();
  return (
    <Screen back title="Debt" intro="Your balances, rates, and minimums. Update a balance whenever you check it; Life Plan keeps it moving in between.">
      <Section title="Your approach">
        <DebtModeChoice st={st} M={M} />
      </Section>

      <Section title="Today">
        {st.debts.map((d) => {
          const now = M.now.debts[d.id];
          const off = M.marks[`d:${d.id}`];
          return (
            <Card key={d.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="heading">{d.name}</Text>
                {now && now.v <= 0.5 ? <Pill tone="good" label="Paid off" /> : <EstTag est={!!now?.est} conf={now?.conf} />}
              </Row>
              <Text style={{ fontSize: 20, fontWeight: '800' }}>{money(now?.v ?? d.balance)}</Text>
              <Text variant="caption" muted>
                {M.focus?.id === d.id ? 'Focus · ' : ''}
                {d.apr ? `${d.apr}% APR` : 'Add the APR'} · {off ? `Paid off around ${niceMonth(off)}` : now && now.v <= 0.5 ? 'Done' : 'Minimum too low to pay off'}
              </Text>
            </Card>
          );
        })}
        <Card>
          <Row>
            <Stat label="Total today" value={money(M.now.totalDebt)} />
            <Stat label="Minimums / month" value={money(M.planMins)} />
            <Stat label="Debt-free" value={M.now.totalDebt <= 0.5 ? 'Now' : M.marks.debtFree ? niceMonth(M.marks.debtFree) : 'Not on track'} />
          </Row>
        </Card>
      </Section>

      <Section title="Edit debts">
        <EntryList list="debts" />
      </Section>
      <Text variant="caption" muted>
        APR is the yearly interest rate; your statement or app shows it. Today’s numbers assume each minimum was paid on its due day, plus the extra payments in your plan.
      </Text>
    </Screen>
  );
}
