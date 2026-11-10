import {describe, expect, it} from 'vitest';
import {equipmentTrouble, outOfServiceOf} from '../equipmentHealth';
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
