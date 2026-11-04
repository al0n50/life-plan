import { EntryList } from '@/components/editors';
import { Card, Row, Screen, Stat, Text } from '@/components/ui';
import { money } from '@/engine/format';
import { useModel } from '@/store/useLifePlan';

export default function Expenses() {
  const M = useModel();
  return (
    <Screen
      back
      title="Recurring expenses"
      intro="Everything that repeats. Bills come out on a due date. Everyday spending, like food, gas, and subscriptions you don’t track one by one, is a monthly budget you spend through the month. Loan and card payments go under Debt."
    >
      <EntryList list="expenses" />
      <Card style={{ marginTop: 12 }}>
        <Row>
          <Stat label="Bills / month" value={money(M.expensesM - M.flexM)} />
          <Stat label="Everyday spending" value={money(M.flexM)} />
          <Stat label="Debt minimums" value={money(M.planMins)} />
          <Stat label="All recurring + mins" value={money(M.F)} />
        </Row>
      </Card>
      <Text variant="caption" muted>
        Give a bill a due date and it shows up in your calendar and under “Coming up”. Bills without one count as everyday spending.
      </Text>
    </Screen>
  );
}
