import {describe, expect, it} from 'vitest';
import {enterChoice, matchAssets, type AssetSuggestion} from '../AssetSuggest';

const pool: AssetSuggestion[] = [
  {barcode: 'S000321', name: 'ΟΡΘΟΠΕΔΙΚΟ ΒΑΣΙΚΟ', code: 'ORTHO-BASIC', department: 'Ορθοπεδική'},
  {barcode: 'T001280', name: 'KOCHER ΕΥΘΕΙΑ 20 CM', code: '12.320.20', legacyBarcodes: ['OLD-77']},
  {barcode: 'T001281', name: 'KOCHER ΚΥΡΤΗ 20 CM', code: '12.321.20'},
];

describe('barcode field suggestions', () => {
  it('finds by name without accents or case, by code and by part of the barcode', () => {
    expect(matchAssets(pool, 'ορθοπεδικο').map(a => a.barcode)).toEqual(['S000321']);
    expect(matchAssets(pool, 'kocher').map(a => a.barcode)).toEqual(['T001280', 'T001281']);
    expect(matchAssets(pool, '12.321').map(a => a.barcode)).toEqual(['T001281']);
    expect(matchAssets(pool, '00128').map(a => a.barcode)).toEqual(['T001280', 'T001281']);
  });

  it('offers nothing for a known barcode (a scan) or a single letter', () => {
    expect(matchAssets(pool, 't001280')).toEqual([]);
    expect(matchAssets(pool, 'OLD-77')).toEqual([]);
    expect(matchAssets(pool, 'K')).toEqual([]);
  });

  it('Enter takes the highlighted one, or the first for a name, but leaves a barcode-like text to the scanner', () => {
    const kochers = matchAssets(pool, 'kocher');
    expect(enterChoice('kocher', kochers, 1)?.barcode).toBe('T001281');
    expect(enterChoice('kocher', kochers, -1)?.barcode).toBe('T001280');
    expect(enterChoice('kocher 20', kochers, -1)?.barcode).toBe('T001280');
    expect(enterChoice('00128', matchAssets(pool, '00128'), -1)).toBeUndefined();
    expect(enterChoice('12.321', matchAssets(pool, '12.321'), -1)?.barcode).toBe('T001281');
    expect(enterChoice('X999', [], -1)).toBeUndefined();
  });
});
