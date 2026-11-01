import {beforeEach, describe, expect, it} from 'vitest';
import {clearRecentSearches, readRecentSearches, rememberRecentSearch} from '../recentSearches';

describe('recent searches', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps the newest first, without repeats, up to six', () => {
    let list: string[] = [];
    for (const term of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'B']) list = rememberRecentSearch(list, term);
    expect(list).toEqual(['B', 'g', 'f', 'e', 'd', 'c']);
    expect(readRecentSearches()).toEqual(list);
  });

  it('never writes patient codes to localStorage', () => {
    rememberRecentSearch([], 'PT-1001');
    expect(localStorage.length).toBe(0);
  });

  it('removes what an older version left in localStorage', () => {
    localStorage.setItem('surgitrack.trace.recent', JSON.stringify(['PT-1001']));
    expect(readRecentSearches()).toEqual([]);
    expect(localStorage.getItem('surgitrack.trace.recent')).toBeNull();
  });

  it('is cleared with the sign-out', () => {
    rememberRecentSearch([], 'PT-1001');
    clearRecentSearches();
    expect(readRecentSearches()).toEqual([]);
  });
});
