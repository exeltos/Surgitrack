import {describe, expect, it} from 'vitest';
import {accountDiffers} from '../useAccountNames';

describe('account recorded by the database', () => {
  it('matches the written name regardless of accents and case, also when the role is added', () => {
    expect(accountDiffers('Μαρία Παπαδοπούλου', 'ΜΑΡΙΑ ΠΑΠΑΔΟΠΟΥΛΟΥ')).toBe(false);
    expect(accountDiffers('Αριστείδης Φιλοκώστας (ως Αποστείρωση)', 'Αριστείδης Φιλοκώστας')).toBe(false);
  });

  it('flags a name that is not the account’s', () => {
    expect(accountDiffers('Νίκος Δημητρίου', 'Ελένη Κωνσταντίνου')).toBe(true);
  });

  it('says nothing when the account is unknown', () => {
    expect(accountDiffers('Νίκος Δημητρίου', undefined)).toBe(false);
  });
});
