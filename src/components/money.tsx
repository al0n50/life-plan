import { Pressable, View } from 'react-native';

import { niceMonth } from '@/engine/dates';
import { money } from '@/engine/format';
import type { Model } from '@/engine/model';
import { paycheckStub, PERIODS } from '@/engine/tax';
import type { Job, LifeState } from '@/engine/types';
import { useApply } from '@/store/useLifePlan';
import { radius, space, useColors } from '@/theme';

import { Text } from './ui';

/** Where a paycheck goes before it reaches you. */
export function StubView({ job, stateTax }: { job: Job; stateTax: number }) {
  const c = useColors();
  const s = paycheckStub(job, stateTax);
  const row = (label: string, value: number, why?: string, note?: string, total?: boolean) => (
    <View key={label} style={{ paddingVertical: 8, borderTopWidth: total ? 2 : 1, borderTopColor: total ? c.text : c.border }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
        <Text style={{ fontWeight: total ? '700' : '500' }}>
          {label}
          {note ? <Text variant="caption" muted>  {note}</Text> : null}
        </Text>
        <Text style={{ fontWeight: '700', fontSize: total ? 17 : 15 }}>{money(value, { cents: true })}</Text>
      </View>
      {why ? <Text variant="caption" muted>{why}</Text> : null}
    </View>
  );
  if (s.gross === null) {
    return <View style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: space.md }}>{row('About this much hits your account each paycheck', s.net, undefined, undefined, true)}</View>;
  }
  const wk = Math.round((52 / PERIODS[job.freq]) * 100) / 100;
  return (
    <View style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: space.md }}>
      {row('Gross pay', s.gross, 'What you earn before anything is taken out.', `$${job.rate.toFixed(2)} × ${job.hours} hrs × ${wk} wk`)}
      {row('Federal income tax', -s.fed, 'Withheld toward your yearly income tax. The first $16,100 you earn in a year isn’t taxed (2026 standard deduction), so this is small on part-time pay.')}
      {row('Social Security', -s.ss, 'Funds retirement and disability benefits.', '6.2%')}
      {row('Medicare', -s.med, 'Funds health coverage for people 65 and older.', '1.45%')}
      {row('State income tax', -s.state, stateTax ? 'Your state’s income tax. Check a paystub for the real amount.' : 'Your state doesn’t tax wages.', stateTax ? `${stateTax}%` : 'None')}
      {job.otherDed ? row('Other deductions', -s.other, 'Health insurance, a 401(k), and similar.') : null}
      {row('Take-home per paycheck', s.net, undefined, undefined, true)}
    </View>
  );
}

/** Pay debt off fast vs. minimums with rollover, each with its debt-free date. */
export function DebtModeChoice({ st, M }: { st: LifeState; M: Model }) {
  const c = useColors();
  const apply = useApply();
  const none = M.now.totalDebt <= 0.5;
  const fast = st.settings.debtMode === 'asap' ? M.marks.debtFree : M.otherMarks.debtFree;
  const steady = st.settings.debtMode === 'steady' ? M.marks.debtFree : M.otherMarks.debtFree;
  const opt = (mode: 'asap' | 'steady', title: string, body: string, date?: string) => {
    const on = st.settings.debtMode === mode;
    return (
      <Pressable
        key={mode}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        onPress={() => apply({ type: 'set_debt_mode', mode })}
        style={{ flex: 1, minWidth: 240, borderWidth: on ? 2 : 1, borderColor: on ? c.primary : c.border, borderRadius: radius.md, padding: space.lg, gap: 6, backgroundColor: c.surface }}
      >
        <Text style={{ fontWeight: '700' }}>{title}</Text>
        <Text variant="caption" muted>{body}</Text>
        <Text style={{ fontWeight: '700' }} color={on ? c.primary : c.text}>
          {none ? 'No debt right now' : date ? `Debt-free around ${niceMonth(date)}` : 'Not on track to pay off'}
        </Text>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
      {opt('asap', 'Pay it off as fast as possible', 'Debt becomes Phase 1. Most of what’s left after expenses goes to the highest-interest debt, while a smaller share still builds your emergency fund and goals.', fast)}
      {opt('steady', 'Minimums, rolled over', 'Pay only the minimums. When one debt is paid off, its payment rolls into the next. Your extra money goes to savings and goals.', steady)}
    </View>
  );
}
