import {describe, expect, it} from 'vitest';
import {buildReport, type ReportFilters, type ReportInput} from '../buildReport';
import {AUTO_END_NOTE} from '../../../core/cycleEnd';
import type {ProcessLoadRecord, SterilizationCycleRecord} from '../../../types/domain';

const filters = {
  group: 'department',
  department: 'ALL',
  specialty: 'ALL',
  assetKind: 'ALL',
  status: 'ALL',
  issueStatus: 'ALL',
  issueType: 'ALL',
  usageFilter: 'ALL',
  loadStatus: 'ALL',
  sterilizerName: 'ALL',
  expiryState: 'ALL',
  signature: 'ALL',
} as ReportFilters;
const load = (over: Partial<ProcessLoadRecord>): ProcessLoadRecord => ({
  id: 'L2',
  workflowVersion: 1,
  kind: 'STERILIZATION',
  equipment: 'ΚΛΙΒΑΝΟΣ Α',
  cycleNumber: 'Α2',
  program: '134°C · 5 min',
  status: 'FAILED',
  items: [],
  createdByUserId: 'u1',
  createdByName: 'Φόρτωσε',
  createdAt: '24/11/2026 17:16',
  completedAt: '24/11/2026 19:31',
  ...over,
});
const cycle = {loadId: 'L2', completedByName: 'ΠΑΠΑΧΡΗΣΤΟΥ ΕΛΕΝΗ'} as SterilizationCycleRecord;
const report = (loads: ProcessLoadRecord[]) =>
  buildReport(
    'loads',
    {
      sets: [],
      tools: [],
      retiredTools: [],
      issues: [],
      processLoads: loads,
      sterilizationReleases: [],
      sterilizationCycles: [cycle],
      receipts: [],
      deliveries: [],
      warningThreshold: 3,
    } as unknown as ReportInput,
    filters,
  );

describe('loads report', () => {
  it('says who ended the cycle, and when', () => {
    const [row] = report([load({})]).rows;
    expect(row.endedBy).toBe('ΠΑΠΑΧΡΗΣΤΟΥ ΕΛΕΝΗ');
    expect(row.endedInfo).toBe('24/11/2026 19:31 · ΠΑΠΑΧΡΗΣΤΟΥ ΕΛΕΝΗ');
  });

  it('says a cycle that ended by itself ended automatically, and a running one has not ended', () => {
    const [auto, open] = report([
      load({status: 'AWAITING_RELEASE', note: AUTO_END_NOTE}),
      load({id: 'L3', status: 'OPEN', completedAt: undefined}),
    ]).rows;
    expect(auto.endedBy).toBe('αυτόματα');
    expect(open.endedInfo).toBe('—');
  });

  it('names who ended a cycle that went back into the sterilizer after ending by itself', () => {
    const [row] = report([load({note: AUTO_END_NOTE, reopenedAt: '24/11/2026 18:00'})]).rows;
    expect(row.endedBy).toBe('ΠΑΠΑΧΡΗΣΤΟΥ ΕΛΕΝΗ');
  });
});
