import {describe, expect, it} from 'vitest';
import {tableCsv, tableReportHtml, xlsxBlob, type ExportTable} from '../exportTable';

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

  it('escapes quotes and apostrophes in cells', () => {
    const html = tableReportHtml({title: 'T', headers: ['A'], rows: [[`O'Brien "x"`]]}, 'en');
    expect(html).toContain('<td>O&#39;Brien &quot;x&quot;</td>');
  });
});

describe('xlsxBlob', () => {
  // The archive is stored without compression, so the sheet XML can be read straight from the bytes.
  const sheetOf = async (rows: ExportTable['rows']) => {
    const bytes = new Uint8Array(await xlsxBlob({title: 'T', headers: ['A', 'B'], rows}).arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    return text.slice(text.indexOf('<worksheet'), text.indexOf('</worksheet>'));
  };

  // Excel shows inline strings as text and never evaluates them, so formula-like cells are harmless here.
  it('writes text as inline strings, never as formulas', async () => {
    const sheet = await sheetOf([
      ['=HYPERLINK("http://x","y")', '+1+1'],
      ['-2+3', '@SUM(A1)'],
    ]);
    expect(sheet).not.toContain('<f>');
    expect(sheet).toContain(
      '<c r="A5" s="0" t="inlineStr"><is><t xml:space="preserve">=HYPERLINK(&quot;http://x&quot;,&quot;y&quot;)</t></is></c>',
    );
    expect(sheet).toContain('<c r="B6" s="0" t="inlineStr"><is><t xml:space="preserve">@SUM(A1)</t></is></c>');
  });

  it('keeps numbers, negative ones too, as numbers', async () => {
    const sheet = await sheetOf([[-12.5, 3]]);
    expect(sheet).toContain('<c r="A5" s="0"><v>-12.5</v></c>');
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

  it('opens text that looks like a formula as text, with a leading apostrophe', () => {
    const csv = tableCsv({
      title: 'T',
      headers: ['A'],
      rows: [['=HYPERLINK("http://x","y")'], ['+1+1'], ['-2+3'], ['@SUM(A1)'], ['\tcmd'], ['\r=1'], ['a=b']],
    });
    expect(csv.slice(1).split('\r\n').slice(1, 6)).toEqual([
      `"'=HYPERLINK(""http://x"",""y"")"`,
      "'+1+1",
      "'-2+3",
      "'@SUM(A1)",
      "'\tcmd",
    ]);
    // A leading carriage return is quoted as well, so it stays inside its cell.
    expect(csv).toContain(`"'\r=1"`);
    expect(csv).toContain('\r\na=b\r\n');
  });

  it('keeps numbers, negative ones too, as numbers', () => {
    const csv = tableCsv({title: 'T', headers: ['A', 'B'], rows: [[-12.5, 0]]});
    expect(csv.slice(1).split('\r\n')[1]).toBe('-12.5;0');
  });
});
