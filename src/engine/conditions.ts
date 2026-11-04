// "Paused until…" conditions for goals and actions.
import { niceMonth } from './dates';
import { PHASES } from './phases';
import type { Marks, Snapshot } from './simulate';
import type { Condition, ISODate, LifeState, PhaseKey } from './types';

export interface ConditionStatus {
  met: boolean;
  /** Projected date it becomes true, if it isn't yet. */
  when?: ISODate;
}

export function conditionStatus(
  c: Condition | undefined,
  ctx: { now: Snapshot; marks: Marks; order: PhaseKey[]; phaseIdx: number; today: ISODate },
): ConditionStatus {
  if (!c) return { met: true };
  switch (c.kind) {
    case 'debt_paid': {
      const d = ctx.now.debts[c.debtId];
      if (!d || (d.started && d.v <= 0.005)) return { met: true };
      return { met: false, when: ctx.marks[`d:${c.debtId}`] };
    }
    case 'all_debt_paid':
      return ctx.now.totalDebt <= 0.5 ? { met: true } : { met: false, when: ctx.marks.debtFree };
    case 'phase_reached': {
      const idx = ctx.order.indexOf(c.phase);
      if (idx < 0 || ctx.phaseIdx >= idx) return { met: true };
      return { met: false, when: ctx.marks[`p:${c.phase}`] };
    }
    case 'date':
      return c.date <= ctx.today ? { met: true } : { met: false, when: c.date };
  }
}

export function describeCondition(c: Condition, st: LifeState): string {
  switch (c.kind) {
    case 'debt_paid':
      return `${st.debts.find((d) => d.id === c.debtId)?.name ?? 'That debt'} is paid off`;
    case 'all_debt_paid':
      return 'All debt is paid off';
    case 'phase_reached':
      return `You reach “${PHASES[c.phase].name}”`;
    case 'date':
      return niceMonth(c.date);
  }
}
