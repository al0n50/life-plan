/**
 * "Export my plan": the whole plan as a JSON file the person keeps. Pure, tested in
 * __tests__/exportPlan.test.ts. The file holds exactly what's saved on the device, so a later
 * import (or the app's own sanitize step) can read it back.
 */
import { localToday } from './dates';
import { SCHEMA_VERSION } from './state';
import type { LifeState } from './types';

export interface PlanExportFile {
  app: 'life-plan-os';
  /** The saved-data version the plan was written with (see SCHEMA_VERSION) */
  schemaVersion: number;
  exportedAt: string;
  plan: LifeState;
}

export function buildPlanExport(plan: LifeState, now: Date = new Date()): { filename: string; json: string } {
  const file: PlanExportFile = { app: 'life-plan-os', schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), plan };
  return { filename: `life-plan-${localToday(now)}.json`, json: JSON.stringify(file, null, 2) };
}
