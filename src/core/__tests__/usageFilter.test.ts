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
  it('finds new instruments: a limit and no use made yet, all the uses left', () => {
    expect(matchesUsage('NEW', [{maxUses: 18, uses: 0}], 3)).toBe(true);
    expect(matchesUsage('NEW', [{maxUses: 18}], 3)).toBe(true);
    expect(matchesUsage('NEW', [{maxUses: 18, uses: 1}], 3)).toBe(false);
    expect(matchesUsage('NEW', [free], 3)).toBe(false);
    // A Set is new when every instrument with a limit is.
    expect(matchesUsage('NEW', [{maxUses: 18}, {maxUses: 10, uses: 1}], 3)).toBe(false);
    expect(matchesUsage('NEW', [{maxUses: 18}, free], 3)).toBe(true);
  });
  it('finds used instruments: some use made and some left; none left is exhausted, not used', () => {
    expect(matchesUsage('USED', [{maxUses: 18, uses: 4}], 3)).toBe(true);
    expect(matchesUsage('USED', [{maxUses: 18, uses: 0}], 3)).toBe(false);
    expect(matchesUsage('USED', [{maxUses: 18, uses: 18}], 3)).toBe(false);
    expect(matchesUsage('EXHAUSTED', [{maxUses: 18, uses: 18}], 3)).toBe(true);
  });
  it('keeps few lives left and none left apart', () => {
    const none = {maxUses: 3, uses: 3};
    expect(matchesUsage('LOW', [low], 3)).toBe(true);
    expect(matchesUsage('LOW', [none], 3)).toBe(false);
    expect(matchesUsage('EXHAUSTED', [none], 3)).toBe(true);
    expect(matchesUsage('EXHAUSTED', [low], 3)).toBe(false);
    expect(matchesUsage('EXHAUSTED', [free], 3)).toBe(false);
  });
  it('finds unlimited, and a Set counts its members', () => {
    expect(matchesUsage('UNLIMITED', [free], 3)).toBe(true);
    expect(matchesUsage('UNLIMITED', [free, limited], 3)).toBe(false);
    expect(matchesUsage('LIMITED', [free, limited], 3)).toBe(true);
  });
});
