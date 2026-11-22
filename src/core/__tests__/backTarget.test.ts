import {describe, expect, it} from 'vitest';
import {backLabelFor} from '../backTarget';

describe('backLabelFor', () => {
  it('names the page «Πίσω» returns to', () => {
    expect(backLabelFor('/traceability?q=S000341')).toBe('Πίσω στην Ιχνηλάτηση');
    expect(backLabelFor('/sets')).toBe('Πίσω στα Σετ');
    expect(backLabelFor('/sets/abc')).toBe('Πίσω στο Σετ');
    expect(backLabelFor('/tools/abc')).toBe('Πίσω στο εργαλείο');
    expect(backLabelFor('/issues')).toBe('Πίσω στις Εκκρεμότητες');
  });

  it('says only «Πίσω» for a page it cannot name', () => {
    expect(backLabelFor(undefined)).toBe('Πίσω');
    expect(backLabelFor('/somewhere/else')).toBe('Πίσω');
  });
});
