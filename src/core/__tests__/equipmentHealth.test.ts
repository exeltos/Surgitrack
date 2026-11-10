import {describe, expect, it} from 'vitest';
import {equipmentBriefing, equipmentTrouble, outOfServiceOf} from '../equipmentHealth';
import type {EquipmentTest, LibraryItem} from '../libraries';
import type {ProcessLoadRecord} from '../../types/domain';

const load = (over: Partial<ProcessLoadRecord>): ProcessLoadRecord =>
  ({
    id: 'L1',
    kind: 'STERILIZATION',
    equipment: 'Κλίβανος Α',
    cycleNumber: '1',
    program: '134°C',
    status: 'RELEASED',
    createdAt: '09/11/2026 08:00',
    completedAt: '09/11/2026 09:00',
    ...over,
  }) as ProcessLoadRecord;
const now = new Date(2026, 10, 10).getTime();

describe('what the equipment screen says about trouble', () => {
  it('counts only the failed and not-released loads of that sterilizer', () => {
    const t = equipmentTrouble(
      'Κλίβανος Α',
      [
        load({id: 'a'}),
        load({id: 'b', status: 'FAILED'}),
        load({id: 'c', status: 'REPROCESS'}),
        load({id: 'd', status: 'FAILED', equipment: 'Κλίβανος Β'}),
        load({id: 'e', status: 'FAILED', kind: 'WASHING'}),
      ],
      now,
    );
    expect(t.items.map(i => [i.loadId, i.kind])).toEqual([
      ['b', 'CYCLE_FAILED'],
      ['c', 'NOT_RELEASED'],
    ]);
    expect(t.recent).toBe(2);
    expect(t.attention).toBe(false);
  });

  it('asks for a check at three failures in thirty days, not for old ones', () => {
    const failed = (id: string, at: string) => load({id, status: 'FAILED', completedAt: at});
    const recent = equipmentTrouble(
      'Κλίβανος Α',
      [failed('1', '01/11/2026 10:00'), failed('2', '05/11/2026 10:00'), failed('3', '09/11/2026 10:00')],
      now,
    );
    expect(recent.attention).toBe(true);
    const old = equipmentTrouble(
      'Κλίβανος Α',
      [failed('1', '01/08/2026 10:00'), failed('2', '05/08/2026 10:00'), failed('3', '09/11/2026 10:00')],
      now,
    );
    expect(old).toMatchObject({recent: 1, attention: false});
    expect(old.items).toHaveLength(3);
  });

  it('finds whether a sterilizer is out of service by its name', () => {
    const list = [
      {id: '1', el: 'Κλίβανος Α', en: 'A'},
      {id: '2', el: 'Κλίβανος Β', en: 'B', outOfService: {reason: 'BREAKDOWN' as const, since: 'x', by: 'y'}},
    ];
    expect(outOfServiceOf(list, 'Κλίβανος Α')).toBeUndefined();
    expect(outOfServiceOf(list, 'Κλίβανος Β')?.reason).toBe('BREAKDOWN');
  });
});

describe('what the briefing of the day says about the equipment', () => {
  const item = (el: string, over: Partial<LibraryItem> = {}) => ({id: el, el, en: el, ...over}) as LibraryItem;
  const test = (kind: EquipmentTest['kind'], result: EquipmentTest['result']) =>
    ({id: `${kind}${result}`, kind, result, at: '10/11/2026 07:00', by: 'Τ'}) as EquipmentTest;
  const washer = (id: number) => load({id: `w${id}`, kind: 'WASHING', equipment: 'Πλυντήριο 1', status: 'FAILED'});

  it('counts failed tests, out of service, repeated failures and due tests once each', () => {
    const sterilizers = [
      item('Α', {tests: [test('BOWIE_DICK', 'FAIL')]}),
      item('Β', {outOfService: {reason: 'BREAKDOWN', since: '10/11/2026 08:00', by: 'Τ'}}),
      item('Γ', {tests: [test('BOWIE_DICK', 'PASS')]}),
      item('Δ'),
    ];
    const washers = [item('Πλυντήριο 1')];
    const loads = [washer(1), washer(2), washer(3)].map(l => ({...l, completedAt: '09/11/2026 09:00'}));
    expect(equipmentBriefing(sterilizers, washers, loads, now)).toEqual({
      failedTests: 1,
      outOfService: 1,
      troubled: 1,
      testsDue: 2,
    });
  });

  it('does not point out missing tests in a hospital that records none', () => {
    expect(equipmentBriefing([item('Α'), item('Β')], [item('Π')], [], now).testsDue).toBe(0);
  });
});
