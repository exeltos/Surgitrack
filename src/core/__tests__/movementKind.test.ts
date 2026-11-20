import {describe, expect, it} from 'vitest';
import {movementKindOf} from '../movementText';

describe('movementKindOf', () => {
  it('puts every movement text in one of a few kinds', () => {
    const cases: Array<[string, string]> = [
      ['Αποστολή προς αποστείρωση', 'SEND'],
      ['Παραλαβή στην Αποστείρωση', 'RECEIVE'],
      ['Έναρξη καθαρισμού', 'WASH'],
      ['Σύνθεση πλήρης', 'PREP'],
      ['Φόρτωση στον Κλίβανο Ατμού 01', 'CYCLE'],
      ['Κύκλος 2026-0931 ολοκληρώθηκε · αναμονή αποδέσμευσης', 'CYCLE'],
      ['Αποδέσμευση φορτίου 2026-0928', 'RELEASE'],
      ['Ανάκληση φορτίου 2026-0911 · επιστροφή για επαναποστείρωση', 'RELEASE'],
      ['Ηλεκτρονικά προωθημένο · αναμονή φυσικής παράδοσης', 'DELIVERY'],
      ['Παράδοση στο τμήμα · υπογραφή παραλαμβάνοντα', 'DELIVERY'],
      ['Αφαίρεση από σύνθεση · προς Service', 'LOSS'],
      ['Δήλωση απώλειας', 'LOSS'],
      ['Συμπλήρωση ορίου χρήσεων', 'OTHER'],
    ];
    for (const [text, kind] of cases) expect([text, movementKindOf(text)]).toEqual([text, kind]);
  });
});
