import {APP_VERSION} from '../../config/appMeta';
import {getRuntimeDataMode} from '../../config/dataMode';
import type {Permission} from '../../core/permissions';
import {notesFor, olderVersion, releases} from '../../core/whatsNew';
import {getRealIdentity} from '../../data/cloud/identity';

export const whatsNewSeenKey = (userId: string) => `surgitrack-seen-version:${userId}`;

/**
 * Whether this person should see "What's new": once after an update, per person (devices are shared on the
 * wards). Someone who never saw a version before (a new account or device) is told nothing and starts from this one.
 */
export function whatsNewDue(can: (p: Permission) => boolean) {
  const userId = getRuntimeDataMode() === 'PRODUCTION' ? getRealIdentity()?.id : undefined;
  const release = releases.find(r => r.version === APP_VERSION);
  if (!userId || !release || !notesFor(release, can).length) return false;
  try {
    const seen = localStorage.getItem(whatsNewSeenKey(userId));
    if (!seen) localStorage.setItem(whatsNewSeenKey(userId), APP_VERSION);
    return !!seen && olderVersion(seen, APP_VERSION);
  } catch {
    return false;
  }
}
