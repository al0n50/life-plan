import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { DebtModeChoice } from '@/components/money';
import { Button, Card, Chips, Dot, EstTag, Field, Pill, Row, Screen, Section, Text } from '@/components/ui';
import { niceMonth } from '@/engine/dates';
import { money, num, pct, sum } from '@/engine/format';
import type { BucketColor } from '@/engine/model';
import { BUCKETS, PHASES, splitFor } from '@/engine/phases';
import type { Split } from '@/engine/types';
import { useApply, useLifePlan, useLifeState, useModel } from '@/store/useLifePlan';
import { radius, space, useColors } from '@/theme';

const BUCKET_COLOR: BucketColor[] = ['emergency', 'debt', 'goals', 'invest', 'fun'];

export default function Plan() {
  const c = useColors();
  const st = useLifeState();
  const M = useModel();
  const apply = useApply();
  const reset = useLifePlan((s) => s.reset);
  const [starter, setStarter] = useState(String(st.settings.starter));
  const [taxPct, setTaxPct] = useState(String(st.settings.taxPct));
  const [custom, setCustom] = useState(st.settings.custom.map(String));
  const [confirmReset, setConfirmReset] = useState(false);
  const customTotal = sum(custom, num);

  return (
    <Screen back title="How your plan works" intro="Your plan moves through phases. Each phase splits the money left after recurring expenses and minimums in a different way, and you move up automatically when a phase is done.">
      <Section title="1. Debt approach">
        <DebtModeChoice st={st} M={M} />
      </Section>

      <Section title="2. Your phases">
        <Card>
          {M.order.map((k, i) => {
            const P = PHASES[k];
            const state = i < M.phaseIdx ? 'done' : i === M.phaseIdx ? 'now' : '';
            const when = M.order.slice(i + 1).map((x) => M.marks[`p:${x}`]).filter(Boolean).sort()[0];
            const sp = splitFor(k, st.settings);
            return (
              <View key={k} style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: state === 'now' ? c.primary : state === 'done' ? c.primarySoft : c.surfaceAlt }}>
                  <Text style={{ fontWeight: '800' }} color={state === 'now' ? c.primaryText : state === 'done' ? c.positive : c.muted}>
                    {state === 'done' ? '✓' : i + 1}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Row>
                    <Text variant="heading">{P.name}</Text>
                    {state === 'now' ? <Pill tone="good" label="You are here" /> : state === 'done' ? <Pill label="Done" /> : null}
                  </Row>
                  <Text variant="caption" muted><Text variant="caption" style={{ fontWeight: '700' }}>What happens:</Text> {P.what}</Text>
                  <Text variant="caption" muted><Text variant="caption" style={{ fontWeight: '700' }}>Why:</Text> {P.why}</Text>
                  <Text variant="caption" muted>
                    <Text variant="caption" style={{ fontWeight: '700' }}>Done when:</Text> {P.done.toLowerCase()}
                    {k === 'starter' ? ` (${money(st.settings.starter)})` : k === 'safety' ? ` (${money(M.efTarget)})` : ''}
                    {state !== 'done' && k !== 'wealth' && when ? `. On your plan, around ${niceMonth(when)}.` : '.'}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {BUCKETS.map((b, j) =>
                      sp[j] ? (
                        <View key={b.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: c.surfaceAlt }}>
                          <Dot color={c.bucket[BUCKET_COLOR[j]]} size={8} />
                          <Text variant="caption" style={{ fontWeight: '600' }}>{b.name} {sp[j]}%</Text>
                        </View>
                      ) : null,
                    )}
                  </View>
                </View>
              </View>
            );
          })}
          {st.settings.debtMode === 'steady' && M.now.totalDebt > 0.5 ? (
            <Text variant="caption" muted>
              On this approach, debt isn’t a phase. It’s paid off in the background with minimums and rollovers{M.marks.debtFree ? `, around ${niceMonth(M.marks.debtFree)}` : ''}.
            </Text>
          ) : null}
        </Card>
      </Section>

      <Section title="3. Settings">
        <Card>
          <Row>
            <Field label="Starter emergency fund" value={starter} onChangeText={setStarter} numeric hint="$500 to $1,000 is typical" />
            <Field label="Tax set-aside for side income %" value={taxPct} onChangeText={setTaxPct} numeric hint="No taxes are withheld from it" />
          </Row>
          <Text variant="label" muted style={{ marginBottom: space.xs }}>Full emergency fund</Text>
          <Chips options={[3, 4, 6, 9].map((n) => ({ value: n, label: `${n} months` }))} value={st.settings.efMonths} onChange={(efMonths) => apply({ type: 'settings', patch: { efMonths } })} />
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button
              small
              label="Save settings"
              disabled={num(starter) === st.settings.starter && num(taxPct) === st.settings.taxPct}
              onPress={() => apply({ type: 'settings', patch: { starter: num(starter), taxPct: num(taxPct) } })}
            />
          </Row>
        </Card>
      </Section>

      <Section title="4. Your split">
        <Card>
          <Chips
            options={[
              { value: 'auto', label: 'Change by phase' },
              { value: 'custom', label: 'Use my own' },
            ]}
            value={st.settings.useCustom ? 'custom' : 'auto'}
            onChange={(v) => apply({ type: 'settings', patch: { useCustom: v === 'custom' } })}
          />
          <Text variant="caption" muted>
            “Change by phase” uses the splits above and shifts them as you move up. “Use my own” keeps one split no matter the phase. The 20% for guilt-free fun is on purpose: a plan you can live with beats a perfect one you quit.
          </Text>
          {st.settings.useCustom ? (
            <View style={{ marginTop: space.md }}>
              {BUCKETS.map((b, i) => (
                <Row key={b.key} style={{ flexWrap: 'nowrap' }}>
                  <Dot color={c.bucket[BUCKET_COLOR[i]]} />
                  <Text style={{ flex: 1 }}>{b.name}</Text>
                  <Text variant="caption" muted>Phase {pct(PHASES[M.phase].split[i])}</Text>
                  <View style={{ width: 90 }}>
                    <Field label="Yours %" value={custom[i]} onChangeText={(t) => setCustom(custom.map((x, j) => (j === i ? t : x)))} numeric />
                  </View>
                </Row>
              ))}
              {Math.round(customTotal) !== 100 ? <Text color={c.danger}>Your split adds up to {pct(customTotal)}. Make it 100%.</Text> : null}
              <Row style={{ justifyContent: 'flex-end' }}>
                <Button small label="Save split" disabled={Math.round(customTotal) !== 100} onPress={() => apply({ type: 'settings', patch: { custom: custom.map(num) as Split } })} />
              </Row>
            </View>
          ) : null}
        </Card>
      </Section>

      <Section title="5. What “Estimated” means">
        <Card>
          <Row>
            <EstTag est />
          </Row>
          <Text muted>
            Life Plan knows your paydays, due dates, and plan. When you don’t log anything, it assumes each paycheck arrived as expected, your bills and minimums were paid, and you moved the money the way your plan says. Those numbers are marked Estimated. When you log a paycheck or confirm a balance, the real number replaces the estimate and everything after it is recalculated. If you’re away 45 days or more, Home asks for a quick full review.
          </Text>
        </Card>
      </Section>

      <Section title="6. Start over">
        <Card>
          {confirmReset ? (
            <>
              <Text>This erases your plan and history on this device. You can’t undo it.</Text>
              <Row>
                <Button
                  kind="danger"
                  label="Erase and start over"
                  onPress={() => {
                    reset();
                    router.replace('/onboarding');
                  }}
                />
                <Button kind="ghost" label="Keep my plan" onPress={() => setConfirmReset(false)} />
              </Row>
            </>
          ) : (
            <Row>
              <Button kind="secondary" label="Start over" onPress={() => setConfirmReset(true)} />
            </Row>
          )}
        </Card>
      </Section>
    </Screen>
  );
}
