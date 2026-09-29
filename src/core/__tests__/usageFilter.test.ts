import {describe, expect, it} from 'vitest';
import {matchesUsage} from '../usageFilter';

describe('usage filter', () => {
  const limited = {maxUses: 10, uses: 2};
  const low = {maxUses: 10, uses: 8};
  const free = {uses: 40};
  it('keeps everything without a filter', () => expect(matchesUsage('', [free], 3)).toBe(true));
  it('finds multi-use instruments with lives', () => {
    expect(matchesUsage('LIMITED', [limited], 3)).toBe(true);
    expect(matchesUsage('LIMITED', [free], 3)).toBe(false);
  });
  it('finds few lives left', () => {
    expect(matchesUsage('LOW', [low], 3)).toBe(true);
    expect(matchesUsage('LOW', [limited], 3)).toBe(false);
  });
  it('finds unlimited, and a Set counts its members', () => {
    expect(matchesUsage('UNLIMITED', [free], 3)).toBe(true);
    expect(matchesUsage('UNLIMITED', [free, limited], 3)).toBe(false);
    expect(matchesUsage('LIMITED', [free, limited], 3)).toBe(true);
  });
});
