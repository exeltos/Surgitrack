/**
 * What a use limit says about an instrument or a Set, one definition for every list, report and card.
 *
 *  - limited: it has a maximum number of uses;
 *  - exhausted: limited and no use left (not yet taken out of use);
 *  - low: some uses left, but no more than the warning threshold;
 *  - new: limited, no use made, AND declared new (the hospital says no use was made before it came to the system).
 *    A use count of zero alone is not enough: everything starts at zero when it is imported, and an instrument
 *    that was in use before the system would then pass for new, with uses it no longer has.
 */
export type Lives = {maxUses?: number; uses?: number; fresh?: boolean};

export const isLimited = (x: Lives) => !!x.maxUses;
export const remainingUses = (x: Lives) => (x.maxUses ? Math.max(0, x.maxUses - (x.uses || 0)) : Infinity);
export const isExhausted = (x: Lives) => isLimited(x) && remainingUses(x) === 0;
export const isLow = (x: Lives, warningThreshold: number) =>
  isLimited(x) && remainingUses(x) > 0 && remainingUses(x) <= warningThreshold;
export const isNew = (x: Lives) => isLimited(x) && !(x.uses || 0) && !!x.fresh;
