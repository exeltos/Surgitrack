import {describe, expect, it} from 'vitest';
import {demoSurgiRepository} from '../repositories/demoRepository';

const key = (value: string) => {
  const [date = '', time = ''] = value.split(' ');
  const [day, month, year] = date.split('/');
  return `${year}${month}${day}${time}`;
};
const isNewestFirst = (values: string[]) => values.every((v, i) => i === 0 || key(values[i - 1]) >= key(v));

describe('demo hospital', () => {
  const data = demoSurgiRepository.getInitialData();
  it('keeps histories newest first', () => {
    expect(isNewestFirst(data.movements.map(m => m.at))).toBe(true);
    expect(isNewestFirst(data.issues.map(i => i.created))).toBe(true);
    expect(isNewestFirst((data.receipts || []).map(r => r.at))).toBe(true);
    expect(isNewestFirst((data.deliveries || []).map(d => d.at))).toBe(true);
  });
  it('fills every Sterilization stage', () => {
    const states = new Set(data.sets.map(s => s.state));
    for (const state of [
      'PENDING_STERILIZATION',
      'IN_WASHING',
      'IN_PREPARATION',
      'IN_PACKAGING',
      'IN_STERILIZATION',
      'AWAITING_RELEASE',
      'READY_FOR_PICKUP',
    ])
      expect(states.has(state as never)).toBe(true);
  });
});
