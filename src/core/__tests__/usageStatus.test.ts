import {describe, expect, it} from 'vitest';
import {isExhausted, isLimited, isLow, isNew, remainingUses} from '../usageStatus';

describe('what a use limit says', () => {
  it('has no limit, then everything is out of the question', () => {
    const free = {uses: 40, fresh: true};
    expect([isLimited(free), isExhausted(free), isLow(free, 3), isNew(free)]).toEqual([false, false, false, false]);
    expect(remainingUses(free)).toBe(Infinity);
  });

  it('counts the uses left, and keeps few left and none left apart', () => {
    expect(remainingUses({maxUses: 10, uses: 4})).toBe(6);
    expect(isLow({maxUses: 10, uses: 8}, 3)).toBe(true);
    expect(isLow({maxUses: 10, uses: 10}, 3)).toBe(false);
    expect(isExhausted({maxUses: 10, uses: 10})).toBe(true);
    expect(isExhausted({maxUses: 10, uses: 9})).toBe(false);
  });

  it('calls new only a limit with no use made that is declared new', () => {
    expect(isNew({maxUses: 18, uses: 0, fresh: true})).toBe(true);
    expect(isNew({maxUses: 18, fresh: true})).toBe(true);
    expect(isNew({maxUses: 18, uses: 0})).toBe(false);
    expect(isNew({maxUses: 18, uses: 2, fresh: true})).toBe(false);
  });
});
