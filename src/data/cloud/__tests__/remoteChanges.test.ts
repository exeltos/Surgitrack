import {describe, expect, it} from 'vitest';
import {mergeRemote, recordKey} from '../remoteChanges';

describe('records from other devices', () => {
  it('compares records by content, not by key order or empty values', () => {
    expect(recordKey({id: 'a', b: 1, c: undefined, d: null, e: {y: 2, x: 1}})).toBe(
      recordKey({e: {x: 1, y: 2}, b: 1, id: 'a'}),
    );
    expect(recordKey({id: 'a', state: 'IN_WASHING'})).not.toBe(recordKey({id: 'a', state: 'READY_FOR_PICKUP'}));
  });

  it('replaces changed records in place, puts new ones first and drops deleted ones', () => {
    const list = [
      {id: 'a', v: 1},
      {id: 'b', v: 1},
      {id: 'c', v: 1},
    ];
    const merged = mergeRemote(
      list,
      [
        {id: 'b', v: 2},
        {id: 'n', v: 1},
      ],
      ['c'],
    );
    expect(merged).toEqual([
      {id: 'n', v: 1},
      {id: 'a', v: 1},
      {id: 'b', v: 2},
    ]);
    // Untouched records keep their identity (the save step compares objects).
    expect(merged[1]).toBe(list[0]);
  });

  it('puts older history after the list', () => {
    const merged = mergeRemote([{id: 'new', v: 1}], [{id: 'old', v: 1}], [], true);
    expect(merged.map(item => item.id)).toEqual(['new', 'old']);
  });
});
