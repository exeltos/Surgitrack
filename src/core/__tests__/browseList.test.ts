import {beforeEach, describe, expect, it} from 'vitest';
import {renderHook} from '@testing-library/react';
import {browsePosition, useBrowseList} from '../browseList';

describe('browsing a registry list', () => {
  beforeEach(() => sessionStorage.clear());

  it('gives the previous and next record in the order shown', () => {
    renderHook(() => useBrowseList('/sets', [{id: 'a'}, {id: 'b'}, {id: 'c'}]));
    expect(browsePosition('/sets', 'b')).toEqual({position: 2, total: 3, previous: '/sets/a', next: '/sets/c'});
    expect(browsePosition('/sets', 'a')).toMatchObject({previous: undefined, next: '/sets/b'});
  });

  it('stays off for a record outside the list, another kind or a single record', () => {
    renderHook(() => useBrowseList('/sets', [{id: 'a'}, {id: 'b'}]));
    expect(browsePosition('/sets', 'z')).toBeNull();
    expect(browsePosition('/tools', 'a')).toBeNull();
    renderHook(() => useBrowseList('/tools', [{id: 't'}]));
    expect(browsePosition('/tools', 't')).toBeNull();
  });
});
