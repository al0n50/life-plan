import { View } from 'react-native';

import { niceMonth, nice, wdName } from '@/engine/dates';
import { money } from '@/engine/format';
import { accountName, jobName, movesFor, type AgendaItem, type Model } from '@/engine/model';
import { PHASES } from '@/engine/phases';
import type { LifeState } from '@/engine/types';
import { radius, space, useColors } from '@/theme';

import { Divider, Dot, Label, Text } from './ui';

/** One paycheck drawn as a bar that splits into colored buckets, with a "do this" legend. */
export function PaycheckSplit({ st, M, amount, reserve, moves }: { st: LifeState; M: Model; amount: number; reserve: number; moves: Parameters<typeof movesFor>[4] }) {
  const c = useColors();
  const rows = movesFor(st, M, amount, reserve, moves);
  const kept = Math.min(reserve, amount);
  const segs = [{ key: 'mins', v: kept, color: c.bucket.mins }, ...rows.map((r, i) => ({ key: `${r.label}${i}`, v: r.amount, color: c.bucket[r.color] }))].filter(
    (s) => s.v > 0.5,
  );
  const total = Math.max(amount, 0.0001);
  return (
    <View style={{ gap: space.sm }}>
      {amount < reserve ? (
        <View style={{ backgroundColor: c.dangerSoft, borderRadius: radius.sm, padding: space.md }}>
          <Text color={c.danger} style={{ fontWeight: '600' }}>
            This paycheck is {money(reserve - amount)} short of its share of expenses and minimums. Checking will run lower until your next paycheck.
          </Text>
        </View>
      ) : null}
      <View
        accessibilityRole="image"
        accessibilityLabel="How this paycheck splits"
        style={{ flexDirection: 'row', height: 40, borderRadius: radius.sm, overflow: 'hidden', gap: 2, backgroundColor: c.surfaceAlt }}
      >
        {segs.map((s) => (
          <View key={s.key} style={{ flex: s.v / total, backgroundColor: s.color }} />
        ))}
      </View>
      <LegendRow color={c.bucket.mins} title="Recurring expenses + minimums" sub={`Stays in ${accountName(st, M.routes.pay)} for bills and everyday spending`} amount={kept} />
      {rows.map((r, i) => (
        <LegendRow key={`${r.label}${i}`} color={c.bucket[r.color]} title={r.label} sub={r.instruction} amount={r.amount} />
      ))}
    </View>
  );
}

export function LegendRow({ color, title, sub, amount, right }: { color: string; title: string; sub?: string; amount?: number; right?: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border }}>
      <Dot color={color} size={12} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600' }}>{title}</Text>
        {sub ? <Text variant="caption" muted>{sub}</Text> : null}
      </View>
      {amount !== undefined ? <Text style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>{money(amount)}</Text> : null}
      {right ? <Text variant="caption" muted>{right}</Text> : null}
    </View>
  );
}

/** Upcoming items grouped by day. `full` shows the per-paycheck moves. */
export function Agenda({ st, M, items, full }: { st: LifeState; M: Model; items: AgendaItem[]; full?: boolean }) {
  const c = useColors();
  const byDay = new Map<string, AgendaItem[]>();
  for (const it of items) byDay.set(it.date, [...(byDay.get(it.date) ?? []), it]);
  const days = [...byDay.keys()].sort();
  return (
    <View>
      {days.map((d, i) => {
        const isToday = d === M.today;
        return (
          <View key={d}>
            {i > 0 ? <Divider /> : null}
            <View style={{ flexDirection: 'row', gap: space.md, paddingVertical: 4 }}>
              <View style={{ width: 52 }}>
                <Text variant="caption" color={isToday ? c.primary : c.muted} style={{ fontWeight: '700', textTransform: 'uppercase' }}>
                  {isToday ? 'Today' : wdName(d)}
                </Text>
                <Text style={{ fontWeight: '800', fontSize: 16 }} color={isToday ? c.primary : c.text}>
                  {nice(d)}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                {byDay.get(d)!.map((it, k) => (
                  <AgendaRow key={k} st={st} M={M} it={it} full={full} />
                ))}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function AgendaRow({ st, M, it, full }: { st: LifeState; M: Model; it: AgendaItem; full?: boolean }) {
  const c = useColors();
  const row = (color: string, title: string, sub?: string, amount?: number) => (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ marginTop: 6 }}>
        <Dot color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600' }}>{title}</Text>
        {sub ? <Text variant="caption" muted>{sub}</Text> : null}
      </View>
      {amount !== undefined ? <Text style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>{money(amount)}</Text> : null}
    </View>
  );
  switch (it.kind) {
    case 'payday': {
      const moves = full ? movesFor(st, M, it.amount, it.reserve, it.moves) : [];
      return (
        <View>
          {row(c.bucket.emergency, `Payday · ${jobName(st, it.job)}`, 'Expected', it.amount)}
          {moves.map((m, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginLeft: 20, marginTop: 2 }}>
              <Dot color={c.bucket[m.color]} size={7} />
              <Text variant="caption" muted style={{ flex: 1 }}>
                {m.instruction}
              </Text>
              <Text variant="caption" style={{ fontWeight: '700' }}>
                {money(m.amount)}
              </Text>
            </View>
          ))}
        </View>
      );
    }
    case 'pending':
      return row(c.bucket.emergency, `Payday · ${jobName(st, it.job)}`, 'Not logged yet', it.amount);
    case 'bill':
      return row(c.bucket.mins, `${st.expenses.find((e) => e.id === it.id)?.name ?? 'Bill'} due`, `From ${accountName(st, M.routes.pay)}`, it.amount);
    case 'debt':
      return row(
        c.bucket.debt,
        `${st.debts.find((d) => d.id === it.id)?.name ?? 'Debt'} payment`,
        it.rollover ? 'Rolled over from a paid-off debt' : 'Minimum payment',
        it.amount,
      );
    case 'milestone':
      return row(c.bucket[it.color], it.title, 'Projected milestone');
    case 'goal_date':
      return row(c.bucket.goals, it.title, 'Goal date you set');
    case 'life':
      return row(it.anchor ? c.primary : c.muted, it.title, it.anchor ? 'Anchor milestone' : 'Life event');
    case 'career':
      return row(c.bucket.invest, it.title, `${it.track} track`);
    case 'action':
      return row(c.warning, it.title, 'Action due');
  }
}

/** The big "which phase am I in" card. */
export function PhaseCard({ M }: { M: Model }) {
  const c = useColors();
  const info = PHASES[M.phase];
  const nextDate = M.order
    .slice(M.phaseIdx + 1)
    .map((k) => M.marks[`p:${k}`])
    .filter(Boolean)
    .sort()[0];
  return (
    <View style={{ backgroundColor: c.primary, borderRadius: radius.lg, padding: space.xl, gap: space.lg, marginBottom: space.md }}>
      <View style={{ gap: 4 }}>
        <Label color={c.primaryText}>
          Phase {M.phaseIdx + 1} of {M.order.length}
        </Label>
        <Text color={c.primaryText} style={{ fontSize: 28, fontWeight: '800', lineHeight: 32 }}>
          {info.name}
        </Text>
        <Text color={c.primaryText} style={{ opacity: 0.92 }}>
          {M.phase === 'wealth'
            ? 'Keep building. This phase never ends.'
            : `Next milestone: ${info.done.charAt(0).toLowerCase()}${info.done.slice(1)}${nextDate ? `, around ${niceMonth(nextDate)}.` : '.'}`}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {M.order.map((k, i) => (
          <View key={k} style={{ flex: 1, gap: 4 }}>
            <View style={{ height: 6, borderRadius: 99, backgroundColor: c.primaryText, opacity: i <= M.phaseIdx ? 1 : 0.25 }} />
            <Text variant="caption" color={c.primaryText} numberOfLines={1} style={{ opacity: i === M.phaseIdx ? 1 : 0.7, fontWeight: '600' }}>
              {i + 1}. {PHASES[k].name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
