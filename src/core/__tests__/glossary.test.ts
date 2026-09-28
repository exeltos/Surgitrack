import {describe, expect, it} from 'vitest';
import {localizedName, normalizeGreek, translateToEnglish} from '../glossary';

describe('built-in glossary', () => {
  it('matches whole names regardless of accents, case and spacing', () => {
    expect(translateToEnglish('ΑΙΘΟΥΣΑ ΤΟΚΕΤΩΝ')).toBe('Delivery Suite');
    expect(translateToEnglish('αίθουσα  τοκετών')).toBe('Delivery Suite');
    expect(translateToEnglish('ΧΕΙΡΟΥΡΓΕΙΟ')).toBe('Operating Theatre');
    expect(translateToEnglish('Κεντρική Αποστείρωση')).toBe('Central Sterile Services');
    expect(translateToEnglish('ΜΕΘ')).toBe('ICU');
  });

  it('translates word by word when every word is known, head noun last', () => {
    expect(translateToEnglish('ΟΥΡΟΛΟΓΙΚΗ ΚΛΙΝΙΚΗ')).toBe('Urology Ward');
    expect(translateToEnglish('Α΄ Χειρουργική Κλινική')).toBe('A Surgical Ward');
    expect(translateToEnglish('Κλινική Παίδων')).toBe('Paediatric Ward');
    expect(translateToEnglish('Μονάδα Βραχείας Νοσηλείας')).toBe('Short-Stay Care Unit');
  });

  it('keeps Latin parts and leaves unknown names untranslated', () => {
    expect(translateToEnglish('Μονάδα IVF')).toBe('IVF Unit');
    expect(translateToEnglish('KARL STORZ')).toBe('KARL STORZ');
    expect(translateToEnglish('ΜΟΝΑΔΑ ΑΓΝΩΣΤΟΥ ΟΡΟΥ')).toBeUndefined();
  });

  it('shows the Greek in Greek, and a real stored translation or the glossary in English', () => {
    expect(localizedName('ΧΕΙΡΟΥΡΓΕΙΟ', 'el')).toBe('ΧΕΙΡΟΥΡΓΕΙΟ');
    expect(localizedName('ΧΕΙΡΟΥΡΓΕΙΟ', 'en')).toBe('Operating Theatre');
    expect(localizedName('ΧΕΙΡΟΥΡΓΕΙΟ', 'en', 'Main OR')).toBe('Main OR');
    expect(localizedName('ΑΓΝΩΣΤΟ', 'en', 'ΑΓΝΩΣΤΟ')).toBe('ΑΓΝΩΣΤΟ');
    expect(normalizeGreek(' Αίθουσα/Τοκετών ')).toBe('ΑΙΘΟΥΣΑ / ΤΟΚΕΤΩΝ');
  });
});
