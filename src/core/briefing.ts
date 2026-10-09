import type {UserRole} from '../store/types';
import type {Issue, ProcessLoadRecord, SetAsset, Tool} from '../types/domain';
import type {ExpiryEntry} from './sterileExpiry';

/** One line of the briefing at sign-in: how many, what, and the screen where it is dealt with. */
export type BriefingItem = {
  key: string;
  count: number;
  el: string;
  en: string;
  to: string;
  tone: 'act' | 'warn' | 'info';
};

export type BriefingInput = {
  role: UserRole;
  department: string;
  sets: readonly SetAsset[];
  tools: readonly Tool[];
  issues: readonly Issue[];
  processLoads: readonly ProcessLoadRecord[];
  /** Sterile Sets and instruments expiring soon or expired (expiryAlerts). */
  expiry: readonly ExpiryEntry[];
  /** Instruments out of lives that Sterilization has not yet confirmed set aside. */
  outOfUse: number;
  accessRequests: number;
  belowMinimum: number;
  /** The screens this person can open; an item whose screen is not among them is left out. */
  screens: readonly string[];
};

const item = (key: string, count: number, el: string, en: string, to: string, tone: BriefingItem['tone']) => ({
  key,
  count,
  el,
  en,
  to,
  tone,
});

/**
 * What waits for this person today, by role, most urgent first; empty lines are left out. The department sees
 * only its own Sets and instruments; Sterilization its work queue; the admin what needs a decision.
 */
export function briefingFor(input: BriefingInput): BriefingItem[] {
  const {role, department, sets, tools, issues, processLoads, expiry, screens} = input;
  const assets = [...sets, ...tools.filter(t => t.mode === 'STANDALONE')];
  const expired = (list: readonly ExpiryEntry[]) => list.filter(e => e.state === 'EXPIRED').length;
  const expiring = (list: readonly ExpiryEntry[]) => list.filter(e => e.state === 'EXPIRING').length;
  let items: BriefingItem[];

  if (role === 'DEPARTMENT') {
    const own = new Set(assets.filter(a => a.department === department).map(a => a.id));
    const ownExpiry = expiry.filter(e => own.has(e.id));
    items = [
      item(
        'ready',
        assets.filter(a => a.department === department && a.state === 'READY_FOR_PICKUP').length,
        'Σετ/εργαλεία έτοιμα για παραλαβή από την Αποστείρωση',
        'Sets/instruments ready to collect from Sterilization',
        '/department',
        'act',
      ),
      item(
        'expired',
        expired(ownExpiry),
        'Σετ/εργαλεία με ληγμένη αποστείρωση',
        'Sets/instruments past their sterile date',
        '/department',
        'act',
      ),
      item(
        'expiring',
        expiring(ownExpiry),
        'Σετ/εργαλεία που λήγουν σύντομα',
        'Sets/instruments expiring soon',
        '/department',
        'warn',
      ),
      item(
        'issues',
        issues.filter(i => i.status === 'OPEN' && i.department === department).length,
        'Ανοιχτά προβλήματα του τμήματος',
        'Open problems of the department',
        '/issues',
        'info',
      ),
    ];
  } else {
    const sterilization = role === 'STERILIZATION';
    const loads = processLoads.filter(l => l.kind === 'STERILIZATION');
    items = [
      ...(sterilization
        ? [
            item(
              'receive',
              assets.filter(a => a.state === 'PENDING_STERILIZATION').length,
              'Σετ/εργαλεία σταλμένα από τμήματα, προς παραλαβή',
              'Sets/instruments sent by departments, to receive',
              '/sterilization',
              'act',
            ),
            item(
              'release',
              loads.filter(l => l.status === 'AWAITING_RELEASE').length,
              'Φορτία για αποδέσμευση',
              'Loads to release',
              '/sterilization',
              'act',
            ),
            item(
              'biological',
              loads.filter(l => l.status === 'RELEASED' && l.biologicalIndicatorResult === 'PENDING').length,
              'Φορτία που περιμένουν αποτέλεσμα βιολογικού δείκτη',
              'Loads awaiting a biological indicator result',
              '/sterilization',
              'warn',
            ),
            item(
              'outOfUse',
              input.outOfUse,
              'Εργαλεία χωρίς άλλες χρήσεις, να αποσυρθούν',
              'Instruments out of uses, to set aside',
              '/tools',
              'act',
            ),
          ]
        : []),
      item(
        'access',
        input.accessRequests,
        'Αιτήματα πρόσβασης προς έγκριση',
        'Access requests to approve',
        '/hospital',
        'act',
      ),
      item(
        'expired',
        expired(expiry),
        'Σετ/εργαλεία με ληγμένη αποστείρωση',
        'Sets/instruments past their sterile date',
        '/expiry',
        'act',
      ),
      item(
        'expiring',
        expiring(expiry),
        'Σετ/εργαλεία που λήγουν σύντομα',
        'Sets/instruments expiring soon',
        '/expiry',
        'warn',
      ),
      item(
        'stock',
        input.belowMinimum,
        'Είδη αποθέματος κάτω από το ελάχιστο',
        'Stock items below minimum',
        '/stock',
        'warn',
      ),
      item(
        'issues',
        issues.filter(i => i.status === 'OPEN').length,
        'Ανοιχτές εκκρεμότητες',
        'Open issues',
        '/issues',
        'info',
      ),
    ];
  }
  return items.filter(i => i.count > 0 && screens.includes(i.to));
}

/** A Greek first name as addressed ("Νίκος" → "Νίκο", "Αριστείδης" → "Αριστείδη"); other names unchanged. */
export const greekVocative = (name: string) =>
  name
    .replace(/(ης|ής)$/u, m => (m === 'ής' ? 'ή' : 'η'))
    .replace(/(ας|άς)$/u, m => (m === 'άς' ? 'ά' : 'α'))
    .replace(/(ος|ός)$/u, m => (m === 'ός' ? 'ό' : 'ο'));
