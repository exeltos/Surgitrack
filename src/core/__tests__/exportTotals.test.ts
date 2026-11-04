import {describe, expect, it} from 'vitest';
import {tableCsv, tableReportHtml, xlsxBlob} from '../exportTable';

const table = {
  title: 'Εργαλεία',
  headers: ['Ονομασία', 'Χρήσεις'],
  rows: [
    ['Α', 2],
    ['Β', 3],
  ],
  totals: ['Σύνολο: 2', 5],
};

describe('the totals line of an export', () => {
  it('ends the CSV', () => {
    const lines = tableCsv(table).trim().split('\r\n');
    expect(lines.at(-1)).toBe('Σύνολο: 2;5');
  });

  it('is the last row of the print page, in the table foot', () => {
    const html = tableReportHtml(table, 'el');
    expect(html).toContain('<tfoot>');
    expect(html).toContain('<th class="total">5</th>');
  });

  it('sits two rows under the data in the workbook, outside the filter, in the bold style', async () => {
    const blob = xlsxBlob(table);
    const text = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()));
    // Data on rows 5 and 6, a blank row 7, the totals on row 8; the filter covers the data only.
    expect(text).toContain('r="A8"');
    expect(text).toContain('<c r="B8" s="4"><v>5</v></c>');
    expect(text).toContain('<autoFilter ref="A4:B6"/>');
  });

  it('is optional', () => {
    const plain = {...table, totals: undefined};
    expect(tableCsv(plain).trim().split('\r\n')).toHaveLength(3);
    expect(tableReportHtml(plain, 'el')).not.toContain('<tfoot>');
  });
});
