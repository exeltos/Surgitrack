import {describe, expect, it} from 'vitest';
import {barcodesWithHistory, isFresh} from '../freshAsset';
import type {Movement} from '../../types/domain';

const move = (asset: string, status: string, id = `${asset}-${status}`): Movement =>
  ({id, asset, assetKind: 'TOOL', from: 'Α', to: 'Β', status, by: 'Χ', at: '01/01/2026 09:00'}) as Movement;

describe('a new instrument', () => {
  it('has no use counted and no movement of use, registration and upkeep aside', () => {
    const history = barcodesWithHistory([
      move('T000001 · Λαβίδα', 'Δημιουργία φυσικού εργαλείου · αυτόματα στο Απόθεμα'),
      move('T000001 · Λαβίδα', 'Επεξεργασία στοιχείων εργαλείου'),
      move('T000001 · Λαβίδα', 'Μεταφορά εργαλείου σε Set'),
    ]);
    expect(isFresh({barcode: 'T000001', uses: 0}, history)).toBe(true);
  });

  it('is not new once sent, or with a use counted', () => {
    const history = barcodesWithHistory([move('T000002 · Ψαλίδι', 'Ηλεκτρονική αποστολή · αναμονή φυσικής παραλαβής')]);
    expect(isFresh({barcode: 'T000002', uses: 0}, history)).toBe(false);
    expect(isFresh({barcode: 'T000003', uses: 1}, history)).toBe(false);
  });

  it('counts the history under a previous barcode', () => {
    const history = barcodesWithHistory([move('T000004 · Λαβίδα', 'Ηλεκτρονική αποστολή')]);
    expect(isFresh({barcode: 'T000009', legacyBarcodes: ['T000004'], uses: 0}, history)).toBe(false);
  });

  it('counts the movements of the Set it travels in', () => {
    const history = barcodesWithHistory([move('S000001 · Σετ', 'Ηλεκτρονική αποστολή')]);
    expect(isFresh({barcode: 'T000005', uses: 0}, history, {barcode: 'S000001'})).toBe(false);
    expect(isFresh({barcode: 'T000005', uses: 0}, history, {barcode: 'S000002', legacyBarcodes: ['S000001']})).toBe(
      false,
    );
    expect(isFresh({barcode: 'T000005', uses: 0}, history, {barcode: 'S000002'})).toBe(true);
  });
});
