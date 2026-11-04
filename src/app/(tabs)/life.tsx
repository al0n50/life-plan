import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { EntryList } from '@/components/editors';
import { Button, Callout, Card, Chips, Divider, Field, Label, Pill, Row, Screen, Section, Text } from '@/components/ui';
import { describeCondition } from '@/engine/conditions';
import { isDate, niceMonth } from '@/engine/dates';
import { uid } from '@/engine/format';
import type { ActionView, Model } from '@/engine/model';
import type { CareerMilestone, CareerTrack, LifeState, MilestoneStatus } from '@/engine/types';
import { useApply, useLifeState, useModel } from '@/store/useLifePlan';
import { radius, space, useColors } from '@/theme';

const STATUS: Record<MilestoneStatus, { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }> = {
  done: { icon: 'checkmark-circle', label: 'Done' },
  now: { icon: 'arrow-forward-circle', label: 'Now' },
  next: { icon: 'ellipse-outline', label: 'Next' },
  question: { icon: 'help-circle-outline', label: 'Undecided' },
};
const CYCLE: MilestoneStatus[] = ['next', 'now', 'done', 'question'];

export default function Life() {
  const st = useLifeState();
  const M = useModel();
  return (
    <Screen title="Life" intro="The why behind the money: what you’re building toward, the people it’s for, and every path that gets you there.">
      <NorthStarCard st={st} />
      <ActionsSection st={st} M={M} />
      <TracksSection st={st} />
      <RoadSection st={st} M={M} />
    </Screen>
  );
}

function NorthStarCard({ st }: { st: LifeState }) {
  const c = useColors();
  const apply = useApply();
  const ns = st.northStar;
  const [editing, setEditing] = useState(!ns.statement);
  const [statement, setStatement] = useState(ns.statement);
  const [anchors, setAnchors] = useState(ns.anchors.join(', '));
  const [age, setAge] = useState(ns.targetAge ? String(ns.targetAge) : '');
  const [born, setBorn] = useState(ns.birthYear ? String(ns.birthYear) : '');
  if (editing) {
    return (
      <Card>
        <Text variant="heading" style={{ marginBottom: space.sm }}>Your North Star</Text>
        <Field label="What does the life you’re building look like?" value={statement} onChangeText={setStatement} placeholder="Financial independence, not to escape, but to show up for everyone I love." />
        <Field label="Who is it for? (comma separated)" value={anchors} onChangeText={setAnchors} placeholder="Mom & Dad, my sisters, friends who are family" />
        <Row>
          <Field label="By age (optional)" value={age} onChangeText={setAge} numeric placeholder="30" />
          <Field label="Birth year (optional)" value={born} onChangeText={setBorn} numeric placeholder="2003" />
        </Row>
        <Row style={{ justifyContent: 'flex-end' }}>
          {ns.statement ? <Button small kind="ghost" label="Cancel" onPress={() => setEditing(false)} /> : null}
          <Button
            small
            label="Save"
            disabled={!statement.trim()}
            onPress={() => {
              apply({
                type: 'profile',
                patch: {
                  northStar: {
                    statement: statement.trim(),
                    anchors: anchors.split(',').map((s) => s.trim()).filter(Boolean),
                    targetAge: Number(age) || undefined,
                    birthYear: Number(born) || undefined,
                  },
                },
              });
              setEditing(false);
            }}
          />
        </Row>
      </Card>
    );
  }
  return (
    <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Edit your North Star">
      <View style={{ backgroundColor: c.warningSoft, borderRadius: radius.lg, padding: space.lg, gap: space.sm, marginBottom: space.md }}>
        <Label color={c.warning}>The North Star{ns.targetAge ? ` · by ${ns.targetAge}` : ''}</Label>
        <Text style={{ fontSize: 17, fontWeight: '700', lineHeight: 24 }}>“{ns.statement}”</Text>
        {ns.anchors.length ? <Text muted>For: {ns.anchors.join(' · ')}</Text> : null}
      </View>
    </Pressable>
  );
}

function ActionsSection({ st, M }: { st: LifeState; M: Model }) {
  const c = useColors();
  const apply = useApply();
  const [manage, setManage] = useState(false);
  const groups: { key: ActionView['urgency']; title: string; color: string }[] = [
    { key: 'urgent', title: 'Urgent: do now', color: c.danger },
    { key: 'month', title: 'This month', color: c.warning },
    { key: 'unlocked', title: 'Unlocks later', color: c.positive },
  ];
  return (
    <Section title="Actions" action={<Button small kind="ghost" label={manage ? 'Done' : 'Edit'} onPress={() => setManage(!manage)} />}>
      {manage ? (
        <EntryList list="actions" />
      ) : M.actions.length === 0 ? (
        <Callout action={<Row><Button small kind="secondary" label="Add an action" onPress={() => setManage(true)} /></Row>}>
          <Text>Actions are the concrete steps: calls to make, applications to send, accounts to open when the time comes.</Text>
        </Callout>
      ) : (
        groups.map((g) => {
          const list = M.actions.filter((a) => a.urgency === g.key);
          if (!list.length) return null;
          return (
            <View key={g.key} style={{ marginBottom: space.md }}>
              <Label color={g.color}>{g.title}</Label>
              {list.map((a) => {
                const locked = a.urgency === 'unlocked' && !a.status.met;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => !locked && apply({ type: 'toggle_action', id: a.id })}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: a.done, disabled: locked }}
                    style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start', padding: space.md, marginTop: 6, backgroundColor: c.surface, borderRadius: radius.sm, borderLeftWidth: 3, borderLeftColor: g.color, opacity: locked ? 0.75 : 1 }}
                  >
                    <Ionicons name={locked ? 'lock-closed-outline' : a.done ? 'checkbox' : 'square-outline'} size={20} color={a.done ? c.positive : g.color} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', textDecorationLine: a.done ? 'line-through' : 'none', color: a.done ? c.muted : c.text }}>{a.title}</Text>
                      {a.detail ? <Text variant="caption" muted>{a.detail}</Text> : null}
                      {a.urgency === 'unlocked' && a.unlockWhen ? (
                        <Text variant="caption" color={a.status.met ? c.positive : c.muted}>
                          {a.status.met ? 'Unlocked: ' : 'Unlocks when '}
                          {describeCondition(a.unlockWhen, st).toLowerCase()}
                          {!a.status.met && a.status.when ? `, around ${niceMonth(a.status.when)}` : ''}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          );
        })
      )}
    </Section>
  );
}

function TracksSection({ st }: { st: LifeState }) {
  const apply = useApply();
  const [manage, setManage] = useState(false);
  return (
    <Section title="Career tracks" action={<Button small kind="ghost" label={manage ? 'Done' : 'Edit'} onPress={() => setManage(!manage)} />}>
      {manage ? (
        <EntryList list="careerTracks" />
      ) : st.careerTracks.length === 0 ? (
        <Callout action={<Row><Button small kind="secondary" label="Add a track" onPress={() => setManage(true)} /></Row>}>
          <Text>Run more than one path at once, like tech and healthcare, and see how each turns into income.</Text>
        </Callout>
      ) : (
        st.careerTracks.map((t) => <TrackCard key={t.id} st={st} t={t} onChange={(item) => apply({ type: 'upsert', list: 'careerTracks', item })} />)
      )}
    </Section>
  );
}

function TrackCard({ st, t, onChange }: { st: LifeState; t: CareerTrack; onChange: (t: CareerTrack) => void }) {
  const c = useColors();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<MilestoneStatus>('next');
  const color = (s: MilestoneStatus) => (s === 'done' ? c.positive : s === 'now' ? c.primary : s === 'question' ? c.warning : c.muted);
  const setMs = (ms: CareerMilestone[]) => onChange({ ...t, milestones: ms });
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="heading">{t.name}</Text>
        {t.status ? <Pill label={t.status} /> : null}
      </Row>
      {t.target ? <Text variant="caption" muted>Target: {t.target}</Text> : null}
      <View style={{ marginTop: space.sm, gap: 2 }}>
        {t.milestones.map((m) => {
          const job = m.incomeJobId ? st.jobs.find((j) => j.id === m.incomeJobId) : undefined;
          return (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 5 }}>
              <Pressable
                accessibilityLabel={`Status: ${STATUS[m.status].label}. Tap to change.`}
                hitSlop={8}
                onPress={() => setMs(t.milestones.map((x) => (x.id === m.id ? { ...x, status: CYCLE[(CYCLE.indexOf(x.status) + 1) % CYCLE.length] } : x)))}
              >
                <Ionicons name={STATUS[m.status].icon} size={20} color={color(m.status)} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{ textDecorationLine: m.status === 'done' ? 'line-through' : 'none', color: m.status === 'done' ? c.muted : c.text }}>{m.title}</Text>
                {job ? <Text variant="caption" color={c.positive}>Income in your plan: {job.name}</Text> : null}
              </View>
              {m.date ? <Text variant="caption" muted>{niceMonth(m.date)}</Text> : null}
              <Pressable accessibilityLabel={`Remove ${m.title}`} hitSlop={8} onPress={() => setMs(t.milestones.filter((x) => x.id !== m.id))}>
                <Ionicons name="close" size={16} color={c.muted} />
              </Pressable>
            </View>
          );
        })}
      </View>
      {adding ? (
        <View style={{ marginTop: space.sm }}>
          <Divider />
          <Row>
            <Field label="Milestone" value={title} onChangeText={setTitle} placeholder="Earn Security+" />
            <Field label="Date (optional)" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" hint={date && !isDate(date) ? 'Use YYYY-MM-DD' : undefined} />
          </Row>
          <Chips options={CYCLE.map((s) => ({ value: s, label: STATUS[s].label }))} value={status} onChange={setStatus} />
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button small kind="ghost" label="Cancel" onPress={() => setAdding(false)} />
            <Button
              small
              label="Add"
              disabled={!title || (!!date && !isDate(date))}
              onPress={() => {
                setMs([...t.milestones, { id: uid('m'), title, date: date || undefined, status }]);
                setTitle('');
                setDate('');
                setAdding(false);
              }}
            />
          </Row>
        </View>
      ) : (
        <Row style={{ marginTop: space.sm }}>
          <Button small kind="ghost" icon="add" label="Add milestone" onPress={() => setAdding(true)} />
        </Row>
      )}
    </Card>
  );
}

/** "Road to 30": life events, career steps and money milestones on one timeline. */
function RoadSection({ st, M }: { st: LifeState; M: Model }) {
  const c = useColors();
  const [manage, setManage] = useState(false);
  const ns = st.northStar;
  const ageAt = (d: string) => (ns.birthYear ? Number(d.slice(0, 4)) - ns.birthYear : undefined);
  type Item = { date: string; title: string; kind: 'anchor' | 'event' | 'career' | 'money'; detail?: string };
  const items: Item[] = [
    ...st.lifeEvents.filter((e) => e.date >= M.today).map((e) => ({ date: e.date, title: e.title, kind: e.kind, detail: e.detail })),
    ...st.careerTracks.flatMap((t) =>
      t.milestones.filter((m) => m.date && m.date >= M.today && m.status !== 'done').map((m) => ({ date: m.date!, title: m.title, kind: 'career' as const, detail: `${t.name} track` })),
    ),
    ...(M.marks.debtFree ? [{ date: M.marks.debtFree, title: 'Debt-free', kind: 'money' as const }] : []),
    ...(M.marks.efFull ? [{ date: M.marks.efFull, title: 'Emergency fund fully funded', kind: 'money' as const }] : []),
    ...st.goals.filter((g) => M.marks[`g:${g.id}`]).map((g) => ({ date: M.marks[`g:${g.id}`], title: `${g.name} fully saved`, kind: 'money' as const })),
  ].sort((a, b) => (a.date < b.date ? -1 : 1));
  const dot = (k: Item['kind']) => (k === 'anchor' ? c.primary : k === 'career' ? c.bucket.invest : k === 'money' ? c.bucket.goals : c.muted);
  const title = ns.targetAge ? `Road to ${ns.targetAge}` : 'The road ahead';
  return (
    <Section title={title} action={<Button small kind="ghost" label={manage ? 'Done' : 'Edit events'} onPress={() => setManage(!manage)} />}>
      {manage ? (
        <EntryList list="lifeEvents" />
      ) : (
        <Card>
          <View style={{ paddingLeft: 6 }}>
            <TimelineRow color={c.primary} label={`Now${ageAt(M.today) ? ` · age ${ageAt(M.today)}` : ''}`} title={`Phase ${M.phaseIdx + 1}`} />
            {items.map((it, i) => (
              <TimelineRow
                key={i}
                color={dot(it.kind)}
                label={`${niceMonth(it.date)}${ageAt(it.date) ? ` · age ${ageAt(it.date)}` : ''}${it.kind === 'anchor' ? ' · anchor' : ''}`}
                title={it.title}
                detail={it.detail}
              />
            ))}
            {ns.targetAge && ns.birthYear ? (
              <TimelineRow color={c.warning} label={`${ns.birthYear + ns.targetAge} · age ${ns.targetAge}`} title="The North Star" detail={ns.statement} last />
            ) : null}
          </View>
          {items.length === 0 ? <Text muted>Add life events, career milestones with dates, or goals to see your road.</Text> : null}
        </Card>
      )}
    </Section>
  );
}

function TimelineRow({ color, label, title, detail, last }: { color: string; label: string; title: string; detail?: string; last?: boolean }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: space.md }}>
      <View style={{ alignItems: 'center', width: 12 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color, marginTop: 4 }} />
        {!last ? <View style={{ flex: 1, width: 2, backgroundColor: c.border }} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: space.lg }}>
        <Label>{label}</Label>
        <Text style={{ fontWeight: '700' }}>{title}</Text>
        {detail ? <Text variant="caption" muted>{detail}</Text> : null}
      </View>
    </View>
  );
}
