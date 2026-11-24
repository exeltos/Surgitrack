import {describe, expect, it} from 'vitest';
import {buildReport, type ReportFilters, type ReportInput} from '../buildReport';
import type {Issue, Movement} from '../../../types/domain';

const filters = (issueStatus = 'ALL'): ReportFilters => ({
  group: 'ALL' as ReportFilters['group'],
  department: 'ALL',
  specialty: 'ALL',
  assetKind: 'ALL',
  status: 'ALL',
  issueStatus,
  issueType: 'ALL',
  usageFilter: 'ALL',
  loadStatus: 'ALL',
  sterilizerName: 'ALL',
  expiryState: 'ALL',
  signature: 'ALL',
});
const issue = (over: Partial<Issue>): Issue => ({
  id: 'i',
  asset: 'T014039 · ΨΑΛΙΔΙ',
  type: 'Βλάβη',
  status: 'RESOLVED',
  created: '24/11/2026 11:27',
  department: 'ΑΙΘΟΥΣΑ ΤΟΚΕΤΩΝ',
  note: 'Δεν κόβει',
  reportedBy: 'ΖΑΧΑΡΗ ΓΕΩΡΓΙΑ',
  ...over,
});
const input = (issues: Issue[], movements: Movement[] = []) =>
  ({
    sets: [],
    tools: [],
    retiredTools: [],
    issues,
    processLoads: [],
    sterilizationReleases: [],
    receipts: [],
    deliveries: [],
    warningThreshold: 3,
    movements,
  }) as unknown as ReportInput;

describe('the damage & loss report', () => {
  it('says «Αποσύρθηκε» for a report closed by withdrawing the instrument, and who assessed it', () => {
    const issues = [
      issue({id: 'a', outcome: 'RETIRED', resolvedBy: 'ΠΑΠΑΧΑΡΑΛΑΜΠΟΥ ΠΑΝΑΓΙΩΤΑ', note: 'x · Επίλυση: Αποσύρθηκε (…)'}),
      issue({id: 'b', resolvedBy: 'ΠΑΤΣΙΚΑΣ ΓΕΩΡΓΙΟΣ', note: 'x · Επίλυση: Ελέγχθηκε'}),
      issue({id: 'c', status: 'OPEN', reportedBy: undefined}),
    ];
    const {columns, rows} = buildReport('issues', input(issues), filters());
    expect(columns.map(c => c.key)).toContain('resolvedBy');
    expect(rows.map(r => [r.status, r.reportedBy, r.resolvedBy])).toEqual([
      ['Αποσύρθηκε', 'ΖΑΧΑΡΗ ΓΕΩΡΓΙΑ', 'ΠΑΠΑΧΑΡΑΛΑΜΠΟΥ ΠΑΝΑΓΙΩΤΑ'],
      ['Επιλυμένη', 'ΖΑΧΑΡΗ ΓΕΩΡΓΙΑ', 'ΠΑΤΣΙΚΑΣ ΓΕΩΡΓΙΟΣ'],
      ['Ανοικτή', '—', '—'],
    ]);
    expect(buildReport('issues', input(issues), filters('RETIRED')).rows).toHaveLength(1);
    expect(buildReport('issues', input(issues), filters('RESOLVED')).rows).toHaveLength(1);
  });

  it('reads an older withdrawal from its text, and who withdrew it from the history', () => {
    const old = issue({note: 'ΑΠΟΣΥΡΕΤΑΙ · Επίλυση: Αποσύρθηκε (Μετά από έλεγχο στις 4 χρήσεις)'});
    const moves = [
      {asset: 'T014039 · ΨΑΛΙΔΙ', status: 'Απόσυρση · Μετά από έλεγχο', by: 'ΠΑΠΑΧΑΡΑΛΑΜΠΟΥ ΠΑΝΑΓΙΩΤΑ'},
    ] as unknown as Movement[];
    const [row] = buildReport('issues', input([old], moves), filters()).rows;
    expect([row.status, row.resolvedBy]).toEqual(['Αποσύρθηκε', 'ΠΑΠΑΧΑΡΑΛΑΜΠΟΥ ΠΑΝΑΓΙΩΤΑ']);
  });
});
