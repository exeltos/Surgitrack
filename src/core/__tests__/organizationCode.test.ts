import {describe, expect, it} from 'vitest';
import {organizationCode} from '../organizationCode';

const fixed = (value: number) => () => value;

describe('a new hospital code', () => {
  it('takes the Latin initials of the name and four digits', () => {
    expect(organizationCode('ΙΑΣΩ Θεσσαλίας', fixed(0.4821))).toBe('IT-4821');
    expect(organizationCode('TEST Hospital', fixed(0.0007))).toBe('TH-0007');
  });

  it('uses up to three words and ignores dots and dashes', () => {
    expect(organizationCode('Γ.Ν. Λάρισας - Κέντρο Υγείας', fixed(0.5))).toBe('GNL-5000');
  });

  it('still makes a code from a name without letters', () => {
    expect(organizationCode('  ', fixed(0.1234))).toBe('HOSP-1234');
  });
});
