import {describe, expect, it} from 'vitest';
import {tableReportHtml} from '../exportTable';

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
