import {getRuntimeDataMode} from '../../config/dataMode';
import {isoDate} from '../../core/sterileExpiry';
import {getRealIdentity} from '../../data/cloud/identity';

const seenKey = (userId: string) => `surgitrack-briefing-seen:${userId}`;

/** Whether today's briefing is still to be shown to the signed-in person (once a day, per person). */
export function briefingDue() {
  const userId = getRuntimeDataMode() === 'PRODUCTION' ? getRealIdentity()?.id : undefined;
  if (!userId) return false;
  try {
    return localStorage.getItem(seenKey(userId)) !== isoDate(new Date());
  } catch {
    return false;
  }
}

export const markBriefingSeen = () => {
  const userId = getRealIdentity()?.id;
  try {
    if (userId) localStorage.setItem(seenKey(userId), isoDate(new Date()));
  } catch {
    // Private mode: shown again next time.
  }
};
