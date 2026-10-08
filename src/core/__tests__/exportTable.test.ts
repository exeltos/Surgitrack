import {describe, expect, it} from 'vitest';
import {tableCsv, tableReportHtml} from '../exportTable';

describe('tableReportHtml', () => {
  it('writes title, headers and escaped rows in the chosen language', () => {
    const html = tableReportHtml(
      {
        title: 'Ιστορικό κινήσεων',
        subtitle: '1 εγγραφή',
        headers: ['Barcode', 'Ενέργεια'],
        rows: [['S000321', '<Παραλαβή>']],
      },
      'el',
    );
    expect(html).toContain('<html lang="el">');
    expect(html).toContain('<h1>Ιστορικό κινήσεων</h1>');
    expect(html).toContain('<th>Ενέργεια</th>');
    expect(html).toContain('&lt;Παραλαβή&gt;');
    expect(html).toContain('<footer>1 εγγραφή</footer>');
  });
});

describe('tableCsv', () => {
  it('writes headers and rows separated by ";", quoting cells that need it', () => {
    const csv = tableCsv({
      title: 'Κύκλοι',
      headers: ['Barcode', 'Σημείωση'],
      rows: [
        ['S000321', 'απλό'],
        ['T001202', 'με ; και "εισαγωγικά"'],
      ],
    });
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Barcode;Σημείωση',
      'S000321;απλό',
      'T001202;"με ; και ""εισαγωγικά"""',
      '',
    ]);
  });
});
