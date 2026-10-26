import {describe, expect, it} from 'vitest';
import {legacySnapshot, type LegacyContext} from '../legacyUndo';
import {defaultSterilizationWorkflow} from '../workflow';
import type {Movement, SetAsset, SterilizationReleaseRecord, Tool} from '../../types/domain';

const set = (state: SetAsset['state']) =>
  ({id: 's1', barcode: 'S1', name: 'Σετ', department: 'Χειρουργείο', state}) as SetAsset;
const member = (state: Tool['state']) => ({id: 't1', setId: 's1', mode: 'SET_MEMBER', state}) as Tool;
const ctx = (over: Partial<LegacyContext>): LegacyContext => ({
  sets: [],
  tools: [],
  stages: defaultSterilizationWorkflow.stages,
  receipts: [],
  deliveries: [],
  preparations: [],
  checkpoints: [],
  releases: [],
  ...over,
});
const move = (status: string, from = 'Χειρουργείο'): Movement => ({
  id: 'm1',
  asset: 'S1 · Σετ',
  assetKind: 'SET',
  from,
  to: 'Κεντρική Αποστείρωση',
  status,
  at: '01/10/2026 09:00',
  by: 'Άννα',
});

describe('undoing an older movement', () => {
  it('puts a dispatched Set back in the department, with the sterile dates of its latest release', () => {
    const release = {
      assetId: 's1',
      assetKind: 'SET',
      decision: 'RELEASED',
      sterileUntil: '2027-01-01',
      sterilizedOn: '2026-07-01',
    } as SterilizationReleaseRecord;
    const snap = legacySnapshot(
      move('Αποστολή προς αποστείρωση'),
      'SET',
      's1',
      ctx({sets: [set('PENDING_STERILIZATION')], tools: [member('PENDING_STERILIZATION')], releases: [release]}),
    )!;
    expect(snap.legacy).toBe(true);
    expect(snap.action).toBe('DISPATCH');
    expect(snap.assets[0].before).toMatchObject({state: 'IN_DEPARTMENT', sterileUntil: '2027-01-01'});
    expect(snap.assets[1].before).toMatchObject({state: 'IN_DEPARTMENT'});
  });

  it('reads the older wordings, and works out nothing when the Set has moved on or the movement is another kind', () => {
    const delivered = ctx({sets: [set('IN_DEPARTMENT')]});
    expect(legacySnapshot(move('Παράδοση στο τμήμα · υπογραφή'), 'SET', 's1', delivered)?.assets[0].before.state).toBe(
      'READY_FOR_PICKUP',
    );
    expect(legacySnapshot(move('Παραλαβή στην Αποστείρωση'), 'SET', 's1', delivered)).toBeUndefined();
    expect(legacySnapshot(move('Διόρθωση χρήσεων · 1 → 2'), 'SET', 's1', delivered)).toBeUndefined();
  });
});
