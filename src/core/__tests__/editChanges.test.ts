import {describe, expect, it} from 'vitest';
import {describeChanges} from '../editChanges';

describe('what an edit of details changed', () => {
  it('lists each field that changed, from what to what, and nothing that stayed the same', () => {
    expect(
      describeChanges(
        {name: 'ΒΑΛΒΑ ΝΟ1', code: '70.305.01', manufacturer: 'DEWIMED', notes: ''},
        {name: 'ΒΑΛΒΑ NO 1', code: '70.305.01', manufacturer: 'DEWIMED', notes: 'Νέα'},
      ),
    ).toEqual(['Ονομασία: «ΒΑΛΒΑ ΝΟ1» → «ΒΑΛΒΑ NO 1»', 'Σημειώσεις: — → «Νέα»']);
  });

  it('says nothing when only spaces around a value changed', () => {
    expect(describeChanges({name: 'ΛΑΒΙΔΑ'}, {name: ' ΛΑΒΙΔΑ '})).toEqual([]);
  });
});
