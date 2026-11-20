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

const KIND_RULES: Array<[MovementKind, RegExp]> = [
  ['LOSS', /απώλει|service|απόσυρ|εκτός χρήσης|lost|retir/i],
  ['RELEASE', /αποδέσμευ|ανάκληση|releas|recall/i],
  ['DELIVERY', /παράδοση|προωθημένο|deliver|forward/i],
  ['CYCLE', /φόρτωση|κύκλο|κλιβανισμ|load|cycle/i],
  ['WASH', /καθαρισμ|πλύση|wash|clean/i],
  ['PREP', /σύνθεσ|συσκευασ|compos|packag|prep/i],
  ['RECEIVE', /παραλαβή|receiv/i],
  ['SEND', /αποστολή|send|sent/i],
];

/**
 * The kind of a movement, from its text: a loss or Service anywhere in it, otherwise what its first part says
 * («Κύκλος … ολοκληρώθηκε · αναμονή αποδέσμευσης» is a cycle, not a release).
 */
export const movementKindOf = (status: string): MovementKind => {
  if (KIND_RULES[0][1].test(status)) return 'LOSS';
  // A load's own entries name the load first: «Φορτίο πλυντηρίου L… · …» is washing, «Φορτίο L… · …» a cycle.
  if (/^(φορτίο πλυντηρίου|washer load)\s/i.test(status)) return 'WASH';
  if (/^(φορτίο|load)\s/i.test(status)) return 'CYCLE';
  // A stage's check done (packaging and labelling, …): the preparation of the item.
  if (/^(ολοκλήρωση ελέγχου|check completed)/i.test(status)) return 'PREP';
  const head = status.split(' · ')[0];
  return KIND_RULES.find(([, rule]) => rule.test(head))?.[0] || 'OTHER';
};
