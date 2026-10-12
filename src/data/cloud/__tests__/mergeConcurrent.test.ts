import {describe, expect, it} from 'vitest';
import {mergeConcurrent, recordLabel} from '../mergeConcurrent';

const base = {id: 's1', barcode: 'S000321', name: 'ΟΡΘΟΠΕΔΙΚΟ', state: 'IN_DEPARTMENT', notes: '', uses: 3};

describe('two devices changing the same record', () => {
  it('keeps both changes when they touch different fields', () => {
    const local = {...base, notes: 'σπασμένο κλιπ'};
    const server = {...base, state: 'PENDING_STERILIZATION', uses: 4};
    const {merged, conflicts, keepsLocal} = mergeConcurrent(base, local, server);
    expect(merged).toEqual({...base, notes: 'σπασμένο κλιπ', state: 'PENDING_STERILIZATION', uses: 4});
    expect(conflicts).toEqual([]);
    expect(keepsLocal).toBe(true);
  });

  it('keeps the saved value and reports the field changed on both', () => {
    const local = {...base, state: 'IN_STOCK', notes: 'εδώ'};
    const server = {...base, state: 'PENDING_STERILIZATION'};
    const {merged, conflicts} = mergeConcurrent(base, local, server);
    expect(merged).toEqual({...base, state: 'PENDING_STERILIZATION', notes: 'εδώ'});
    expect(conflicts).toEqual(['state']);
  });

  it('is no conflict when both made the same change', () => {
    const local = {...base, state: 'PENDING_STERILIZATION'};
    const {merged, conflicts, keepsLocal} = mergeConcurrent(base, local, {...local});
    expect(conflicts).toEqual([]);
    expect(keepsLocal).toBe(false);
    expect(merged).toEqual(local);
  });

  it('removes a field removed here and keeps fields added on the other device', () => {
    const local = {id: 's1', barcode: 'S000321', name: 'ΟΡΘΟΠΕΔΙΚΟ', state: 'IN_DEPARTMENT', uses: 3};
    const server = {...base, photos: [{id: 'p1'}]};
    const {merged} = mergeConcurrent(base, local, server);
    expect(merged).toEqual({...local, photos: [{id: 'p1'}]});
  });

  it('adds up the uses both devices counted, so a usage limit sees every one', () => {
    const counted = {...base, sterilizations: 10};
    const local = {...counted, uses: 4, sterilizations: 11};
    const server = {...counted, uses: 5, sterilizations: 11, state: 'PENDING_STERILIZATION'};
    const {merged, conflicts, keepsLocal} = mergeConcurrent(counted, local, server);
    expect(merged).toEqual({...server, uses: 6, sterilizations: 12});
    expect(conflicts).toEqual([]);
    expect(keepsLocal).toBe(true);
  });

  it('merges a count that is not a number like any other field', () => {
    const local = {...base, uses: 4};
    const unknownCount = {...base, uses: undefined};
    const server = {...base, uses: 6};
    const {merged, conflicts} = mergeConcurrent(unknownCount, local, server);
    expect(merged).toEqual(server);
    expect(conflicts).toEqual(['uses']);
  });

  it('names records the way users see them', () => {
    expect(recordLabel(base)).toBe('S000321 · ΟΡΘΟΠΕΔΙΚΟ');
    expect(recordLabel({id: 'i1', asset: 'T001202 · ΨΑΛΙΔΙ'} as {id: string})).toBe('T001202 · ΨΑΛΙΔΙ');
  });
});
