import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { describeCondition } from '@/engine/conditions';
import { isDate, isMonth, nice, niceMonth } from '@/engine/dates';
import { money, num, uid } from '@/engine/format';
import { PHASES } from '@/engine/phases';
import { EXPENSE_FREQ_LABEL, expenseMonthly } from '@/engine/schedule';
import { monthlyNet, PAY_FREQ_LABEL } from '@/engine/tax';
import type {
  Account,
  AccountType,
  Action,
  CareerTrack,
  Condition,
  Debt,
  DebtKind,
  Expense,
  ExpenseFreq,
  Goal,
  Job,
  LifeEvent,
  LifeState,
  PayFreq,
  Urgency,
} from '@/engine/types';
import type { ListKey } from '@/engine/updates';
import { useApply, useLifeState, useToday } from '@/store/useLifePlan';
import { space, useColors } from '@/theme';

import { Button, Card, Chips, Field, Row, Text } from './ui';

export const ACCOUNT_TYPES: Record<AccountType, string> = {
  checking: 'Checking',
  savings: 'Savings',
  hysa: 'High-yield savings',
  investing: 'Investing / retirement',
  cash: 'Cash',
};
const DEBT_KINDS: { value: DebtKind; label: string }[] = [
  { value: 'credit_card', label: 'Credit card' },
  { value: 'auto', label: 'Car loan' },
  { value: 'student_loan', label: 'Student loan' },
  { value: 'personal', label: 'Personal loan' },
  { value: 'bnpl', label: 'Buy now, pay later' },
  { value: 'medical', label: 'Medical' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'other', label: 'Other' },
];
const opts = <T extends string>(r: Record<T, string>) => (Object.entries(r) as [T, string][]).map(([value, label]) => ({ value, label }));
const str = (n: number | undefined) => (n === undefined || n === 0 ? '' : String(n));

interface FormProps<T> {
  initial?: T;
  onSave: (item: T) => void;
  onCancel: () => void;
}

function Shell({ children, onSave, onCancel, canSave }: { children: ReactNode; onSave: () => void; onCancel: () => void; canSave: boolean }) {
  return (
    <Card>
      {children}
      <Row style={{ justifyContent: 'flex-end' }}>
        <Button label="Cancel" kind="ghost" small onPress={onCancel} />
        <Button label="Save" small onPress={onSave} disabled={!canSave} />
      </Row>
    </Card>
  );
}

function Lbl({ children }: { children: ReactNode }) {
  return (
    <Text variant="label" muted style={{ marginBottom: space.xs }}>
      {children}
    </Text>
  );
}

const dateHint = (v: string, month = false) => (v && !(month ? isMonth(v) : isDate(v)) ? `Use ${month ? 'YYYY-MM' : 'YYYY-MM-DD'}` : undefined);

// ---------------- Forms ----------------

export function JobForm({ initial, onSave, onCancel }: FormProps<Job>) {
  const st = useLifeState();
  const [j, setJ] = useState<Job>(
    initial ?? { id: uid('j'), name: '', payType: 'hourly', rate: 0, hours: 0, amount: 0, freq: 'biweekly', nextPay: '', otherDed: 0 },
  );
  const [rate, setRate] = useState(str(j.rate));
  const [hours, setHours] = useState(str(j.hours));
  const [amount, setAmount] = useState(str(j.amount));
  const [ded, setDed] = useState(str(j.otherDed));
  const [future, setFuture] = useState(Boolean(j.startDate));
  const built: Job = { ...j, rate: num(rate), hours: num(hours), amount: num(amount), otherDed: num(ded), startDate: future ? j.startDate : undefined };
  const needsDate = j.freq !== 'semimonthly';
  const ok = !!j.name && (j.payType === 'hourly' ? num(rate) > 0 && num(hours) > 0 : num(amount) > 0) && (!needsDate || isDate(j.nextPay)) && (!future || isDate(j.startDate));
  return (
    <Shell canSave={ok} onCancel={onCancel} onSave={() => onSave(built)}>
      <Field label="Job" value={j.name} onChangeText={(name) => setJ({ ...j, name })} placeholder="Where you work" />
      <Chips
        options={[
          { value: 'hourly', label: 'Hourly' },
          { value: 'amount', label: 'Rough paycheck amount' },
        ]}
        value={j.payType}
        onChange={(payType) => setJ({ ...j, payType })}
      />
      <Row>
        {j.payType === 'hourly' ? (
          <>
            <Field label="Hourly rate" value={rate} onChangeText={setRate} numeric placeholder="16.50" />
            <Field label="Usual hours / week" value={hours} onChangeText={setHours} numeric placeholder="30" />
            <Field label="Other deductions / paycheck" value={ded} onChangeText={setDed} numeric placeholder="0" hint="Health insurance, 401(k)" />
          </>
        ) : (
          <Field label="Take-home per paycheck" value={amount} onChangeText={setAmount} numeric placeholder="750" />
        )}
      </Row>
      <Lbl>How often you’re paid</Lbl>
      <Chips options={opts(PAY_FREQ_LABEL)} value={j.freq} onChange={(freq: PayFreq) => setJ({ ...j, freq })} />
      {needsDate ? (
        <Field
          label={j.freq === 'monthly' ? 'A payday (sets the day of month)' : 'Next payday'}
          value={j.nextPay}
          onChangeText={(nextPay) => setJ({ ...j, nextPay })}
          placeholder="YYYY-MM-DD"
          hint={dateHint(j.nextPay)}
        />
      ) : null}
      <Chips
        options={[
          { value: 'now', label: 'I have this job now' },
          { value: 'future', label: 'Future income' },
        ]}
        value={future ? 'future' : 'now'}
        onChange={(v) => setFuture(v === 'future')}
      />
      {future ? (
        <Field label="Starts on" value={j.startDate ?? ''} onChangeText={(startDate) => setJ({ ...j, startDate })} placeholder="YYYY-MM-DD" hint={dateHint(j.startDate ?? '')} />
      ) : null}
      {st.careerTracks.length ? (
        <>
          <Lbl>Part of a career track?</Lbl>
          <Chips
            options={[{ value: '', label: 'No' }, ...st.careerTracks.map((t) => ({ value: t.id, label: t.name }))]}
            value={j.careerTrackId ?? ''}
            onChange={(careerTrackId) => setJ({ ...j, careerTrackId: careerTrackId || undefined })}
          />
        </>
      ) : null}
    </Shell>
  );
}

export function ExpenseForm({ initial, onSave, onCancel }: FormProps<Expense>) {
  const [e, setE] = useState<Expense>(initial ?? { id: uid('e'), name: '', amount: 0, freq: 'monthly', kind: 'bill' });
  const [amount, setAmount] = useState(str(e.amount));
  const [dueDay, setDueDay] = useState(str(e.dueDay));
  const built: Expense = {
    ...e,
    amount: num(amount),
    dueDay: e.kind === 'bill' && e.freq === 'monthly' && num(dueDay) ? Math.min(31, Math.max(1, Math.round(num(dueDay)))) : undefined,
    nextDue: e.kind === 'bill' && e.freq !== 'monthly' && isDate(e.nextDue) ? e.nextDue : undefined,
  };
  return (
    <Shell canSave={!!e.name && num(amount) > 0} onCancel={onCancel} onSave={() => onSave(built)}>
      <Row>
        <Field label="Expense" value={e.name} onChangeText={(name) => setE({ ...e, name })} placeholder="Phone" />
        <Field label="Amount" value={amount} onChangeText={setAmount} numeric placeholder="55" />
      </Row>
      <Chips options={opts(EXPENSE_FREQ_LABEL)} value={e.freq} onChange={(freq: ExpenseFreq) => setE({ ...e, freq })} />
      <Chips
        options={[
          { value: 'bill', label: 'Bill (has a due date)' },
          { value: 'spending', label: 'Everyday spending' },
        ]}
        value={e.kind}
        onChange={(kind) => setE({ ...e, kind })}
      />
      {e.kind === 'bill' ? (
        e.freq === 'monthly' ? (
          <Field label="Due day of month (optional)" value={dueDay} onChangeText={setDueDay} numeric placeholder="12" />
        ) : (
          <Field label="Next due (optional)" value={e.nextDue ?? ''} onChangeText={(nextDue) => setE({ ...e, nextDue })} placeholder="YYYY-MM-DD" hint={dateHint(e.nextDue ?? '')} />
        )
      ) : (
        <Text variant="caption" muted style={{ marginBottom: space.md }}>
          Spent through the month, like food, gas, or subscriptions you don’t track one by one.
        </Text>
      )}
    </Shell>
  );
}

export function DebtForm({ initial, onSave, onCancel }: FormProps<Debt>) {
  const today = useToday();
  const [d, setD] = useState<Debt>(initial ?? { id: uid('d'), name: '', kind: 'credit_card', balance: 0, apr: 0, min: 0, due: 15, asOf: today });
  const [balance, setBalance] = useState(str(d.balance));
  const [apr, setApr] = useState(str(d.apr));
  const [min, setMin] = useState(str(d.min));
  const [due, setDue] = useState(str(d.due));
  const built: Debt = { ...d, balance: num(balance), apr: num(apr), min: num(min), due: Math.min(31, Math.max(1, Math.round(num(due)) || 1)) };
  return (
    <Shell canSave={!!d.name && num(balance) > 0} onCancel={onCancel} onSave={() => onSave(built)}>
      <Field label="Debt" value={d.name} onChangeText={(name) => setD({ ...d, name })} placeholder="Visa card" />
      <Chips options={DEBT_KINDS} value={d.kind} onChange={(kind) => setD({ ...d, kind })} />
      <Row>
        <Field label="Balance today" value={balance} onChangeText={setBalance} numeric placeholder="3,500" />
        <Field label="APR %" value={apr} onChangeText={setApr} numeric placeholder="24.99" hint="The yearly interest rate on your statement" />
      </Row>
      <Row>
        <Field label="Minimum payment" value={min} onChangeText={setMin} numeric placeholder="95" />
        <Field label="Due day of month" value={due} onChangeText={setDue} numeric placeholder="15" />
      </Row>
    </Shell>
  );
}

export function AccountForm({ initial, onSave, onCancel }: FormProps<Account>) {
  const today = useToday();
  const [a, setA] = useState<Account>(initial ?? { id: uid('a'), name: '', type: 'savings', balance: 0, asOf: today });
  const [balance, setBalance] = useState(initial ? String(initial.balance) : '');
  return (
    <Shell canSave={!!a.name} onCancel={onCancel} onSave={() => onSave({ ...a, balance: num(balance) })}>
      <Row>
        <Field label="Account" value={a.name} onChangeText={(name) => setA({ ...a, name })} placeholder="High-yield savings" />
        <Field label="Balance today" value={balance} onChangeText={setBalance} numeric placeholder="0" />
      </Row>
      <Chips options={opts(ACCOUNT_TYPES)} value={a.type} onChange={(type) => setA({ ...a, type })} />
    </Shell>
  );
}

/** Pick an "unlocked when…" condition. */
export function ConditionPicker({ value, onChange, st }: { value?: Condition; onChange: (c?: Condition) => void; st: LifeState }) {
  const key = !value ? '' : value.kind === 'debt_paid' ? `debt:${value.debtId}` : value.kind === 'phase_reached' ? `phase:${value.phase}` : value.kind;
  const [date, setDate] = useState(value?.kind === 'date' ? value.date : '');
  const options = [
    { value: '', label: 'No condition' },
    ...st.debts.map((d) => ({ value: `debt:${d.id}`, label: `${d.name} paid off` })),
    ...(st.debts.length > 1 ? [{ value: 'all_debt_paid', label: 'All debt paid' }] : []),
    { value: 'phase:safety', label: `Reach “${PHASES.safety.name}”` },
    { value: 'phase:goals', label: `Reach “${PHASES.goals.name}”` },
    { value: 'date', label: 'On a date' },
  ];
  return (
    <View>
      <Chips
        options={options}
        value={key}
        onChange={(v) => {
          if (!v) onChange(undefined);
          else if (v.startsWith('debt:')) onChange({ kind: 'debt_paid', debtId: v.slice(5) });
          else if (v.startsWith('phase:')) onChange({ kind: 'phase_reached', phase: v.slice(6) as 'safety' | 'goals' });
          else if (v === 'all_debt_paid') onChange({ kind: 'all_debt_paid' });
          else if (v === 'date') onChange(isDate(date) ? { kind: 'date', date } : { kind: 'date', date: '' });
        }}
      />
      {key === 'date' ? (
        <Field
          label="Unlocks on"
          value={date}
          onChangeText={(t) => {
            setDate(t);
            onChange({ kind: 'date', date: t });
          }}
          placeholder="YYYY-MM-DD"
          hint={dateHint(date)}
        />
      ) : null}
    </View>
  );
}

export function GoalForm({ initial, onSave, onCancel }: FormProps<Goal>) {
  const st = useLifeState();
  const [g, setG] = useState<Goal>(initial ?? { id: uid('g'), name: '', target: 0, date: '', saved: 0 });
  const [target, setTarget] = useState(str(g.target));
  const [saved, setSaved] = useState(str(g.saved));
  const condOk = !g.unlockWhen || g.unlockWhen.kind !== 'date' || isDate(g.unlockWhen.date);
  return (
    <Shell canSave={!!g.name && num(target) > 0 && (!g.date || isMonth(g.date)) && condOk} onCancel={onCancel} onSave={() => onSave({ ...g, target: num(target), saved: num(saved) })}>
      <Field label="Goal" value={g.name} onChangeText={(name) => setG({ ...g, name })} placeholder="Trip, car, move…" />
      <Row>
        <Field label="Target" value={target} onChangeText={setTarget} numeric placeholder="3,000" />
        <Field label="By (month)" value={g.date} onChangeText={(date) => setG({ ...g, date })} placeholder="YYYY-MM" hint={dateHint(g.date, true)} />
        {!initial ? <Field label="Already saved" value={saved} onChangeText={setSaved} numeric placeholder="0" /> : null}
      </Row>
      <Lbl>Paused until…</Lbl>
      <ConditionPicker st={st} value={g.unlockWhen} onChange={(unlockWhen) => setG({ ...g, unlockWhen })} />
    </Shell>
  );
}

export function LifeEventForm({ initial, onSave, onCancel }: FormProps<LifeEvent>) {
  const [e, setE] = useState<LifeEvent>(initial ?? { id: uid('ev'), title: '', date: '', kind: 'event' });
  return (
    <Shell canSave={!!e.title && isDate(e.date)} onCancel={onCancel} onSave={() => onSave(e)}>
      <Row>
        <Field label="What" value={e.title} onChangeText={(title) => setE({ ...e, title })} placeholder="Mom turns 50" />
        <Field label="When" value={e.date} onChangeText={(date) => setE({ ...e, date })} placeholder="YYYY-MM-DD" hint={dateHint(e.date)} />
      </Row>
      <Field label="Note (optional)" value={e.detail ?? ''} onChangeText={(detail) => setE({ ...e, detail })} />
      <Chips
        options={[
          { value: 'anchor', label: 'Anchor milestone' },
          { value: 'event', label: 'Life event' },
        ]}
        value={e.kind}
        onChange={(kind) => setE({ ...e, kind })}
      />
    </Shell>
  );
}

export function ActionForm({ initial, onSave, onCancel }: FormProps<Action>) {
  const st = useLifeState();
  const [a, setA] = useState<Action>(initial ?? { id: uid('ac'), title: '', urgency: 'urgent', done: false });
  const ok = !!a.title && (!a.due || isDate(a.due)) && (a.urgency !== 'unlocked' || !!a.unlockWhen);
  return (
    <Shell canSave={ok} onCancel={onCancel} onSave={() => onSave({ ...a, due: a.due || undefined, unlockWhen: a.urgency === 'unlocked' ? a.unlockWhen : undefined })}>
      <Field label="Action" value={a.title} onChangeText={(title) => setA({ ...a, title })} placeholder="Call the card company about my APR" />
      <Field label="Detail (optional)" value={a.detail ?? ''} onChangeText={(detail) => setA({ ...a, detail })} />
      <Chips
        options={[
          { value: 'urgent', label: 'Urgent: do now' },
          { value: 'month', label: 'This month' },
          { value: 'unlocked', label: 'When something is done' },
        ]}
        value={a.urgency}
        onChange={(urgency: Urgency) => setA({ ...a, urgency })}
      />
      {a.urgency === 'unlocked' ? (
        <>
          <Lbl>Unlocks when…</Lbl>
          <ConditionPicker st={st} value={a.unlockWhen} onChange={(unlockWhen) => setA({ ...a, unlockWhen })} />
        </>
      ) : (
        <Field label="Due (optional)" value={a.due ?? ''} onChangeText={(due) => setA({ ...a, due })} placeholder="YYYY-MM-DD" hint={dateHint(a.due ?? '')} />
      )}
    </Shell>
  );
}

export function TrackForm({ initial, onSave, onCancel }: FormProps<CareerTrack>) {
  const [t, setT] = useState<CareerTrack>(initial ?? { id: uid('t'), name: '', status: '', milestones: [] });
  return (
    <Shell canSave={!!t.name} onCancel={onCancel} onSave={() => onSave(t)}>
      <Row>
        <Field label="Track" value={t.name} onChangeText={(name) => setT({ ...t, name })} placeholder="Tech, Healthcare, Business…" />
        <Field label="Status" value={t.status} onChangeText={(status) => setT({ ...t, status })} placeholder="Applying" />
      </Row>
      <Field label="Target (optional)" value={t.target ?? ''} onChangeText={(target) => setT({ ...t, target })} placeholder="Cybersecurity analyst, $65k+" />
    </Shell>
  );
}

// ---------------- List + editor wired to the store ----------------

type EditableList = Exclude<ListKey, 'careerTracks'> | 'careerTracks';

const ADD_LABEL: Record<EditableList, string> = {
  jobs: 'Add a job',
  expenses: 'Add an expense',
  debts: 'Add a debt',
  accounts: 'Add an account',
  goals: 'Add a goal',
  lifeEvents: 'Add a life event',
  actions: 'Add an action',
  careerTracks: 'Add a career track',
};

function describe(list: EditableList, item: any, st: LifeState): { title: string; sub: string; amount?: string } {
  switch (list) {
    case 'jobs': {
      const j = item as Job;
      return {
        title: j.name,
        sub: `${j.payType === 'hourly' ? `$${j.rate}/hr × ${j.hours} hrs` : 'Set amount'} · ${PAY_FREQ_LABEL[j.freq].toLowerCase()}${j.startDate ? ` · starts ${nice(j.startDate)}` : ''}`,
        amount: `${money(monthlyNet(j, st.settings.stateTax))}/mo`,
      };
    }
    case 'expenses': {
      const e = item as Expense;
      const due = e.kind === 'spending' ? 'everyday spending' : e.dueDay ? `due the ${e.dueDay}${ord(e.dueDay)}` : e.nextDue ? `next ${nice(e.nextDue)}` : 'no due date';
      return { title: e.name, sub: `${EXPENSE_FREQ_LABEL[e.freq]} · ${due}`, amount: `${money(expenseMonthly(e))}/mo` };
    }
    case 'debts': {
      const d = item as Debt;
      return { title: d.name, sub: `${d.apr}% APR · ${money(d.min)} min · due the ${d.due}${ord(d.due)} · as of ${nice(d.asOf)}`, amount: money(d.balance) };
    }
    case 'accounts': {
      const a = item as Account;
      return { title: a.name, sub: `${ACCOUNT_TYPES[a.type]} · as of ${nice(a.asOf)}`, amount: money(a.balance) };
    }
    case 'goals': {
      const g = item as Goal;
      return {
        title: g.name,
        sub: `${g.date ? `By ${niceMonth(g.date)}` : 'No date'}${g.unlockWhen ? ` · paused until ${describeCondition(g.unlockWhen, st).toLowerCase()}` : ''}`,
        amount: money(g.target),
      };
    }
    case 'lifeEvents': {
      const e = item as LifeEvent;
      return { title: e.title, sub: `${nice(e.date)}, ${e.date.slice(0, 4)} · ${e.kind === 'anchor' ? 'anchor' : 'event'}` };
    }
    case 'actions': {
      const a = item as Action;
      return { title: a.title, sub: a.urgency === 'unlocked' && a.unlockWhen ? `When ${describeCondition(a.unlockWhen, st).toLowerCase()}` : a.due ? `Due ${nice(a.due)}` : a.urgency === 'urgent' ? 'Urgent' : 'This month' };
    }
    case 'careerTracks': {
      const t = item as CareerTrack;
      return { title: t.name, sub: `${t.status || 'No status'} · ${t.milestones.length} milestones` };
    }
  }
}

function ord(n: number) {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}

export function EntryList({ list, minItems = 0 }: { list: EditableList; minItems?: number }) {
  const c = useColors();
  const st = useLifeState();
  const apply = useApply();
  const items = st[list] as { id: string }[];
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  const save = (item: any) => {
    apply({ type: 'upsert', list, item } as never);
    setEditing(null);
  };
  const cancel = () => setEditing(null);
  const form = (initial?: any) => {
    const p = { initial, onSave: save, onCancel: cancel };
    switch (list) {
      case 'jobs':
        return <JobForm {...p} />;
      case 'expenses':
        return <ExpenseForm {...p} />;
      case 'debts':
        return <DebtForm {...p} />;
      case 'accounts':
        return <AccountForm {...p} />;
      case 'goals':
        return <GoalForm {...p} />;
      case 'lifeEvents':
        return <LifeEventForm {...p} />;
      case 'actions':
        return <ActionForm {...p} />;
      case 'careerTracks':
        return <TrackForm {...p} />;
    }
  };

  return (
    <View>
      {items.map((item) => {
        if (editing === item.id) return <View key={item.id}>{form(item)}</View>;
        const d = describe(list, item, st);
        return (
          <Pressable key={item.id} onPress={() => setEditing(item.id)} accessibilityRole="button" accessibilityLabel={`Edit ${d.title}`}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md }}>
              <View style={{ flex: 1 }}>
                <Text variant="heading" style={{ fontSize: 15 }}>
                  {d.title}
                </Text>
                <Text variant="caption" muted>
                  {d.sub}
                </Text>
              </View>
              {d.amount ? <Text variant="heading" style={{ fontVariant: ['tabular-nums'] }}>{d.amount}</Text> : null}
              {items.length > minItems ? (
                <Pressable accessibilityLabel={`Remove ${d.title}`} hitSlop={10} onPress={() => apply({ type: 'remove', list, id: item.id })}>
                  <Ionicons name="close-circle-outline" size={20} color={c.muted} />
                </Pressable>
              ) : null}
            </Card>
          </Pressable>
        );
      })}
      {editing === 'new' ? form() : <Button label={ADD_LABEL[list]} kind="secondary" icon="add" onPress={() => setEditing('new')} />}
    </View>
  );
}
