import {describe, expect, it} from 'vitest';
import {isExhausted, isLimited, isLow, isNew, isUsed, remainingUses} from '../usageStatus';

describe('what a use limit says', () => {
  it('has no limit, then none of it applies', () => {
    const free = {uses: 40};
    expect([isLimited(free), isExhausted(free), isLow(free, 3), isNew(free), isUsed(free)]).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(remainingUses(free)).toBe(Infinity);
  });

  it('puts every instrument with a limit in exactly one of new, used and exhausted', () => {
    const cases = [
      [{maxUses: 18, uses: 0}, 'new'],
      [{maxUses: 18}, 'new'],
      [{maxUses: 18, uses: 5}, 'used'],
      [{maxUses: 18, uses: 17}, 'used'],
      [{maxUses: 18, uses: 18}, 'exhausted'],
      // No uses and none left: finished.
      [{maxUses: 0, uses: 0}, undefined],
    ] as const;
    for (const [x, kind] of cases) {
      const found = [isNew(x) && 'new', isUsed(x) && 'used', isExhausted(x) && 'exhausted'].filter(Boolean);
      if (kind) expect(found).toEqual([kind]);
      else expect(found).toEqual([]);
    }
  });

  it('counts the uses left, and keeps few left and none left apart', () => {
    expect(remainingUses({maxUses: 10, uses: 4})).toBe(6);
    expect(isLow({maxUses: 10, uses: 8}, 3)).toBe(true);
    expect(isLow({maxUses: 10, uses: 10}, 3)).toBe(false);
    expect(isExhausted({maxUses: 10, uses: 10})).toBe(true);
    expect(isExhausted({maxUses: 10, uses: 9})).toBe(false);
  });
});
