import {afterEach, describe, expect, it} from 'vitest';
import {setI18nLang, tr, trc, trData} from '../index';

describe('i18n', () => {
  afterEach(() => setI18nLang('el'));

  it('shows the Greek text in Greek and its English in English, with arguments in place', () => {
    setI18nLang('el');
    expect(tr('Εκκρεμότητες')).toBe('Εκκρεμότητες');
    expect(tr('Έλλειψη {0}', 2)).toBe('Έλλειψη 2');
    setI18nLang('en');
    expect(tr('Εκκρεμότητες')).toBe('Issues');
    expect(tr('Το φορτίο {0} ολοκληρώθηκε για {1} αντικείμενα.', 'L-7', 3)).toBe('Load L-7 completed for 3 items.');
    expect(tr('Κείμενο χωρίς μετάφραση')).toBe('Κείμενο χωρίς μετάφραση');
  });

  it('picks the context-specific meaning of an ambiguous word', () => {
    setI18nLang('en');
    expect(tr('Καθαρισμός')).toBe('Clear');
    expect(trc('stage', 'Καθαρισμός')).toBe('Cleaning');
  });

  it('translates stored record text part by part, keeping names and numbers', () => {
    setI18nLang('en');
    expect(trData('Κύκλος ολοκληρώθηκε · Κλίβανος 1 · 042 · 134°C')).toBe(
      'Cycle completed · Sterilizer 1 · 042 · 134°C',
    );
    expect(trData('Φορτίο πλυντηρίου W-12')).toBe('Washer load W-12');
    expect(trData('Αίθουσα Τοκετών')).toBe('Delivery Suite');
    expect(trData('Μαρία Παπαδοπούλου · παρέδωσε Νίκος Δημητρίου')).toBe(
      'Μαρία Παπαδοπούλου · handed over by Νίκος Δημητρίου',
    );
    setI18nLang('el');
    expect(trData('Κύκλος ολοκληρώθηκε · Κλίβανος 1')).toBe('Κύκλος ολοκληρώθηκε · Κλίβανος 1');
  });
});
