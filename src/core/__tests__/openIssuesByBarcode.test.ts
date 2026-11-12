import {describe, expect, it} from 'vitest';
import {openIssuesByBarcode} from '../openIssuesByBarcode';

const issue = (id: string, asset: string, status = 'OPEN') => ({id, asset, status});

describe('open issues by barcode', () => {
  it('finds the open issues of an asset, as a scan of the whole list would', () => {
    const issues = [
      issue('a', 'S000001 · Laparoscopy'),
      issue('b', 'S000001 · Laparoscopy', 'RESOLVED'),
      issue('c', 'T000010 · Scissors'),
      issue('d', 'S000001 · Laparoscopy'),
      issue('e', 'S0000011 · Another Set'),
    ];
    const of = openIssuesByBarcode(issues);
    for (const barcode of ['S000001', 'T000010', 'S0000011', 'X999999'])
      expect(of(barcode)).toEqual(
        issues.filter(i => i.status === 'OPEN' && i.asset.split(' ')[0] === barcode && i.asset.startsWith(barcode)),
      );
    expect(of('S000001').map(i => i.id)).toEqual(['a', 'd']);
  });
});
