import type {EquipmentTest, EquipmentTestKind, LibraryItem} from '../../core/libraries';
import {formatDate} from '../../core/displayDate';

/** A test done `days` ago (0: today) at `time`, as records store it. */
const done = (
  id: string,
  kind: EquipmentTestKind,
  days: number,
  time: string,
  by: string,
  result: EquipmentTest['result'] = 'PASS',
  note?: string,
): EquipmentTest => {
  const day = new Date();
  day.setDate(day.getDate() - days);
  return {id, kind, result, at: `${formatDate(day)} ${time}`, by, ...(note ? {note} : {})};
};
const ster = 'Μαρία Παπαδοπούλου';
const admin = 'Αριστείδης Φιλοκώστας';

/**
 * The Demo's sterilizers and washers, as a hospital runs them: two steam sterilizers tested this week (one has
 * today's Bowie-Dick, the other still needs it), a third in maintenance after a failed test, a plasma sterilizer
 * held to its spore test only, and two washers. Dated from today, so the tests always look current.
 */
export function demoSterilizers(): LibraryItem[] {
  return [
    {
      id: 'aut1',
      code: 'AUT-01',
      el: 'Κλίβανος Ατμού 01',
      en: 'Steam Sterilizer 01',
      tests: [
        done('t-aut1-bd0', 'BOWIE_DICK', 0, '06:40', ster),
        done('t-aut1-bi2', 'BIOLOGICAL', 2, '07:10', ster),
        done('t-aut1-lk3', 'LEAK', 3, '06:20', ster),
        done('t-aut1-bd1', 'BOWIE_DICK', 1, '06:35', ster),
      ],
    },
    {
      id: 'aut2',
      code: 'AUT-02',
      el: 'Κλίβανος Ατμού 02',
      en: 'Steam Sterilizer 02',
      programs: ['134°C · 5′', '121°C · 20′', '134°C · 18′ (Prion)'],
      tests: [
        done('t-aut2-bd1', 'BOWIE_DICK', 1, '06:50', ster),
        done('t-aut2-lk4', 'LEAK', 4, '06:30', ster),
        done('t-aut2-bi4', 'BIOLOGICAL', 4, '07:00', ster),
      ],
    },
    {
      id: 'aut3',
      code: 'AUT-03',
      el: 'Κλίβανος Ατμού 03',
      en: 'Steam Sterilizer 03',
      outOfService: {
        reason: 'MAINTENANCE',
        note: 'Αποτυχία Bowie-Dick· αναμονή τεχνικού για τη στεγανότητα της πόρτας.',
        since: `${formatDate(new Date(Date.now() - 2 * 864e5))} 07:05`,
        by: admin,
      },
      tests: [
        done('t-aut3-bd2', 'BOWIE_DICK', 2, '06:45', ster, 'FAIL', 'Ανομοιόμορφη αλλαγή χρώματος στο κέντρο.'),
        done('t-aut3-bd3', 'BOWIE_DICK', 3, '06:40', ster),
      ],
    },
    {
      id: 'plasma1',
      code: 'PLS-01',
      el: 'Πλάσμα STERRAD 100NX',
      en: 'STERRAD 100NX Plasma',
      tests: [done('t-pls1-bi1', 'BIOLOGICAL', 1, '08:15', ster)],
    },
  ];
}

export function demoWashers(): LibraryItem[] {
  return [
    {
      id: 'wd1',
      code: 'WD-01',
      el: 'Πλυντήριο 1',
      en: 'Washer 1',
      tests: [
        done('t-wd1-cl0', 'CLEANING', 0, '06:15', ster),
        done('t-wd1-pr3', 'PROTEIN', 3, '06:25', ster),
        done('t-wd1-sp3', 'SPRAY', 3, '06:30', ster),
      ],
    },
    {
      id: 'wd2',
      code: 'WD-02',
      el: 'Πλυντήριο 2',
      en: 'Washer 2',
      tests: [
        done('t-wd2-cl1', 'CLEANING', 1, '06:20', ster),
        done('t-wd2-pr5', 'PROTEIN', 5, '06:10', ster),
        done('t-wd2-sp9', 'SPRAY', 9, '06:00', ster),
      ],
    },
  ];
}
