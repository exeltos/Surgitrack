import {afterEach, describe, expect, it} from 'vitest';
import {markPrintHtml, markTable, setSampleDataMark} from '../sampleDataMark';
import {tableCsv, tableReportHtml, xlsxBlob} from '../exportTable';

const TABLE = {title: 'Ιστορικό κινήσεων', subtitle: 'Γ.Ν. Λάρισας', headers: ['Σετ'], rows: [['ΣΕΤ-1']]};

afterEach(() => setSampleDataMark(false));

describe('DEMO mark on exports and prints', () => {
  it('leaves real hospitals’ exports untouched', () => {
    expect(markTable(TABLE)).toBe(TABLE);
    expect(markPrintHtml('<html><body>x</body></html>')).toBe('<html><body>x</body></html>');
    expect(tableReportHtml(TABLE, 'el')).not.toContain('st-demo-mark');
  });

  it('marks the title, the report page and the workbook of sample data', async () => {
    setSampleDataMark(true);
    expect(markTable(TABLE)).toMatchObject({
      title: 'DEMO · Ιστορικό κινήσεων',
      subtitle: 'Γ.Ν. Λάρισας · Δοκιμαστικά δεδομένα',
    });
    const report = tableReportHtml(TABLE, 'el');
    expect(report).toContain('<h1>DEMO · Ιστορικό κινήσεων</h1>');
    expect(report.indexOf('st-demo-mark')).toBeLessThan(report.indexOf('</body>'));
    const bytes = new Uint8Array(await xlsxBlob(TABLE).arrayBuffer());
    expect(new TextDecoder().decode(bytes)).toContain('DEMO · Ιστορικό κινήσεων');
  });

  it('marks a print page once, before its end', () => {
    setSampleDataMark(true);
    const once = markPrintHtml('<style></style></head><body><main>x</main></body></html>');
    expect(once.match(/st-demo-mark"/g)).toHaveLength(1);
    expect(markPrintHtml(once)).toBe(once);
    expect(markPrintHtml('<main>x</main>')).toContain('DEMO');
  });

  it('keeps CSV as plain data', () => {
    setSampleDataMark(true);
    expect(tableCsv(TABLE)).not.toContain('DEMO');
  });
});
