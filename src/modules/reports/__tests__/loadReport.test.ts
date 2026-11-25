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
const cycle = {id: 'sc1', loadId: 'L2', completedByName: 'ΠΑΠΑΧΡΗΣΤΟΥ ΕΛΕΝΗ'} as SterilizationCycleRecord;
const report = (loads: ProcessLoadRecord[], cycles: SterilizationCycleRecord[] = [cycle]) =>
  buildReport(
    'loads',
    {
      sets: [],
      tools: [],
      retiredTools: [],
      issues: [],
      processLoads: loads,
      sterilizationReleases: [],
      sterilizationCycles: cycles,
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

  it('without cycle records, says a cycle that ended by itself ended automatically, and a running one has not ended', () => {
    const [auto, open] = report(
      [
        load({status: 'AWAITING_RELEASE', note: AUTO_END_NOTE}),
        load({id: 'L3', status: 'OPEN', completedAt: undefined}),
      ],
      [],
    ).rows;
    expect(auto.endedBy).toBe('αυτόματα');
    expect(open.endedInfo).toBe('—');
  });

  it('names who ended a cycle that went back into the sterilizer after ending by itself', () => {
    const [row] = report([load({note: AUTO_END_NOTE, reopenedAt: '24/11/2026 18:00'})]).rows;
    expect(row.endedBy).toBe('ΠΑΠΑΧΡΗΣΤΟΥ ΕΛΕΝΗ');
  });

  it('keeps «αυτόματα» from the cycle record, whatever the load note says after release', () => {
    const autoRecord = {...cycle, id: 'sc-auto-L2-SET-s1', completedByName: 'Όποιος είχε ανοιχτή την εφαρμογή'};
    const [row] = report([load({status: 'RELEASED', note: 'Σημείωση αποδέσμευσης'})], [autoRecord]).rows;
    expect(row.endedBy).toBe('αυτόματα');
  });

  it('lists the instruments kept until worn in the usage report, with their uses and no limit', () => {
    const rows = buildReport(
      'usage',
      {
        sets: [],
        tools: [
          {id: 't1', barcode: 'T1', name: 'ΨΑΛΙΔΙ', department: 'ΑΙΘΟΥΣΑ ΤΟΚΕΤΩΝ', uses: 3, wearCheck: true},
          {id: 't2', barcode: 'T2', name: 'ΛΑΒΙΔΑ', department: 'ΑΙΘΟΥΣΑ ΤΟΚΕΤΩΝ', uses: 0},
        ],
        retiredTools: [],
        issues: [],
        processLoads: [],
        sterilizationReleases: [],
        receipts: [],
        deliveries: [],
        warningThreshold: 3,
      } as unknown as ReportInput,
      filters,
    ).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({barcode: 'T1', uses: 3, maxUses: 'Με έλεγχο φθοράς', remaining: '—'});
  });
});
