import {describe, expect, it} from 'vitest';
import {distinctValues, groupTools, toolKind} from '../toolGroups';
import type {Tool} from '../../types/domain';

const tool = (id: string, name: string, extra: Partial<Tool> = {}) =>
  ({id, name, code: `K${id}`, ...extra}) as unknown as Tool;

describe('which instruments are the same kind', () => {
  it('ignores case, spaces and punctuation, but not the words', () => {
    expect(toolKind(tool('1', 'FENESTRAT.BIPOLAR FORCEP 8 MM'))).toBe(
      toolKind(tool('2', 'Fenestrat. bipolar forcep 8mm')),
    );
    expect(toolKind(tool('1', 'LARGE NEEDLE DRIVER'))).not.toBe(toolKind(tool('2', 'LARGE SUTURECUT NEEDLE DRIVER')));
  });

  it('puts pieces with different codes and companies together when the name is the same', () => {
    const groups = groupTools([
      tool('1', 'MONOPOLAR CURVED SCISSORS', {manufacturer: 'A'}),
      tool('2', 'MONOPOLAR CURVED SCISSORS', {manufacturer: 'B'}),
      tool('3', 'CADIERE FORCEPS'),
      tool('4', 'monopolar curved scissors'),
    ]);
    expect(groups.map(g => g.length)).toEqual([3, 1]);
    expect(distinctValues(groups[0], t => t.manufacturer)).toEqual(['A', 'B']);
    expect(distinctValues(groups[0], t => t.code)).toHaveLength(3);
  });
});
