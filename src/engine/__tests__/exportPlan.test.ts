import { describe, expect, it } from 'vitest';

import { buildPlanExport } from '../exportPlan';
import { exampleState, sanitize, SCHEMA_VERSION } from '../state';

const NOW = new Date(2026, 10, 18, 9, 30);
const TODAY = '2026-11-18';

describe('buildPlanExport', () => {
  it('names the file after today', () => {
    expect(buildPlanExport(exampleState(TODAY), NOW).filename).toBe('life-plan-2026-11-18.json');
  });

  it('labels the file with the app and saved-data version', () => {
    const file = JSON.parse(buildPlanExport(exampleState(TODAY), NOW).json);
    expect(file.app).toBe('life-plan-os');
    expect(file.schemaVersion).toBe(SCHEMA_VERSION);
    expect(file.exportedAt).toBe(NOW.toISOString());
  });

  it('holds the whole plan, and it reads back unchanged', () => {
    const plan = exampleState(TODAY);
    const file = JSON.parse(buildPlanExport(plan, NOW).json);
    expect(file.plan).toEqual(plan);
    expect(sanitize(file.plan, TODAY)).toEqual(sanitize(plan, TODAY));
  });
});
