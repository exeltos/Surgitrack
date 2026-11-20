import {trData} from '../i18n';

/** The id of the account some entries name in their text, for the audit trail: «… · Νίκος (5b39fe1b-5730-…) · …». */
const ACCOUNT_ID = /\s*\([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\)/gi;

/** A movement's text as the screens show it: translated, without the internal account id (kept in the record). */
export const movementText = (status: string) => trData(status.replace(ACCOUNT_ID, ''));

/** The few kinds a movement is filtered by, in the order of the cycle (its text names loads, cycles and people). */
export const MOVEMENT_KINDS = [
  {key: 'SEND', label: 'Αποστολή'},
  {key: 'RECEIVE', label: 'Παραλαβή'},
  {key: 'WASH', label: 'Καθαρισμός & απολύμανση'},
  {key: 'PREP', label: 'Σύνθεση'},
  {key: 'CYCLE', label: 'Φόρτωση & κύκλος'},
  {key: 'RELEASE', label: 'Αποδέσμευση & ανάκληση'},
  {key: 'DELIVERY', label: 'Παράδοση'},
  {key: 'LOSS', label: 'Απώλεια & Service'},
  {key: 'OTHER', label: 'Άλλες'},
] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number]['key'];

/** The text without accents, in small letters: «Αποδεσμεύτηκε» and «ΑΝΑΚΛΗΣΗ» read as «αποδεσμευτηκε», «ανακληση». */
const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** By how a movement's text begins: the texts the actions write (useLoadActions, useReceiptAndCycleActions, …). */
const START_RULES: Array<[MovementKind, RegExp]> = [
  ['WASH', /^(φορτιο πλυντηριου|washer load)\s/],
  ['CYCLE', /^(φορτιο|load)\s|^(βιολογικος δεικτης|αποτυχια κυκλου|επιστροφη στον κλιβανο)/],
  ['PREP', /^(ολοκληρωση ελεγχου|check completed)/],
  ['DELIVERY', /^επιστροφη στο τμημα/],
  ['OTHER', /^παραλαβη παραγγελιας/],
];

/** Otherwise by what the text's first part says. */
const KIND_RULES: Array<[MovementKind, RegExp]> = [
  ['RELEASE', /αποδεσμευ|ανακληση|releas|recall/],
  ['DELIVERY', /παραδοση|προωθημενο|deliver|forward/],
  ['CYCLE', /φορτωση|κυκλο|κλιβανισμ|load|cycle/],
  ['WASH', /καθαρισμ|πλυση|wash|clean/],
  ['PREP', /συνθεσ|συσκευασ|compos|packag|prep/],
  ['RECEIVE', /παραλαβη|receiv/],
  ['SEND', /αποστολη|send|sent/],
];

/** A loss, Service or retirement anywhere in the text. */
const LOSS = /απωλει|service|αποσυρ|εκτος χρησης|lost|retir/;

/**
 * The kind of a movement, from its text, whatever its accents: a loss or Service anywhere in it, otherwise how it
 * begins or what its first part says («Κύκλος … ολοκληρώθηκε · αναμονή αποδέσμευσης» is a cycle, not a release).
 */
export const movementKindOf = (status: string): MovementKind => {
  const text = plain(status.trim());
  if (LOSS.test(text)) return 'LOSS';
  const start = START_RULES.find(([, rule]) => rule.test(text));
  if (start) return start[0];
  const head = text.split(' · ')[0];
  return KIND_RULES.find(([, rule]) => rule.test(head))?.[0] || 'OTHER';
};
