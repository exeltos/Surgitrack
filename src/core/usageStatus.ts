/**
 * What a use limit says about an instrument or a Set, one definition for every list, report and card. For an
 * instrument with a limit, the three cases that leave nothing out:
 *
 *  - new: no use made yet, so all the uses are left;
 *  - used: some use made and some left;
 *  - exhausted: none left (it has finished; 0 uses and 0 left is exhausted too).
 *
 * «Low» is the used ones (or new ones) with few uses left, at most the warning threshold.
 */
export type Lives = {maxUses?: number; uses?: number};

export const isLimited = (x: Lives) => !!x.maxUses;
export const remainingUses = (x: Lives) => (x.maxUses ? Math.max(0, x.maxUses - (x.uses || 0)) : Infinity);
export const isExhausted = (x: Lives) => isLimited(x) && remainingUses(x) === 0;
export const isNew = (x: Lives) => isLimited(x) && !(x.uses || 0) && remainingUses(x) > 0;
export const isUsed = (x: Lives) => isLimited(x) && (x.uses || 0) > 0 && remainingUses(x) > 0;
export const isLow = (x: Lives, warningThreshold: number) =>
  isLimited(x) && remainingUses(x) > 0 && remainingUses(x) <= warningThreshold;
