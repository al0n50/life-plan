import { useState } from 'react';

import { Agenda } from '@/components/plan';
import { Card, Chips, Screen, Text } from '@/components/ui';
import { agenda } from '@/engine/model';
import { useLifeState, useModel } from '@/store/useLifePlan';

export default function Calendar() {
  const st = useLifeState();
  const M = useModel();
  const [days, setDays] = useState(60);
  const items = agenda(st, M, days);
  return (
    <Screen title="Calendar" intro="Every payday, bill, debt payment, milestone and life event in your plan, with what to move where on each payday.">
      <Chips
        options={[
          { value: 14, label: '2 weeks' },
          { value: 60, label: '60 days' },
          { value: 120, label: '4 months' },
        ]}
        value={days}
        onChange={setDays}
      />
      <Card>
        <Text variant="caption" muted>
          Amounts are what your plan expects.
        </Text>
        {items.length ? <Agenda st={st} M={M} items={items} full /> : <Text muted>Add your income, expenses, and debts to fill your calendar.</Text>}
      </Card>
    </Screen>
  );
}
