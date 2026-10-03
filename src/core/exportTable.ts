/**
 * Exports of on-screen lists as real documents: an Excel workbook (.xlsx) with the data, and a
 * formatted report page for printing or saving as PDF. Both are built from the rows, never from
 * a picture of the screen.
 */

export type ExportTable = {
  /** Document title, e.g. "Ιστορικό κινήσεων". */
  title: string;
  /** One line under the title: hospital, filters in use, record count. */
  subtitle?: string;
  headers: string[];
  rows: Array<Array<string | number>>;
};

const xml = (value: string | number) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Characters Excel refuses inside XML.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

const column = (index: number) => {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

/** A zip archive without compression: enough for an .xlsx and needs no library. */
const zip = (files: Array<{name: string; content: string}>) => {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, data);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

const sheetXml = (table: ExportTable) => {
  const width = table.headers.length;
  const lengths = table.headers.map((header, i) =>
    Math.min(60, Math.max(header.length, ...table.rows.map(row => String(row[i] ?? '').length)) + 2),
  );
  const cell = (value: string | number, ref: string, style: number) =>
    typeof value === 'number'
      ? `<c r="${ref}" s="${style}"><v>${value}</v></c>`
      : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  const titleRow = `<row r="1">${cell(table.title, 'A1', 1)}</row>`;
  const subtitleRow = `<row r="2">${cell(table.subtitle || '', 'A2', 2)}</row>`;
  const headerRow = `<row r="4">${table.headers.map((h, i) => cell(h, `${column(i)}4`, 3)).join('')}</row>`;
  const bodyRows = table.rows
    .map((row, r) => `<row r="${r + 5}">${row.map((v, i) => cell(v ?? '', `${column(i)}${r + 5}`, 0)).join('')}</row>`)
    .join('');
  const last = `${column(width - 1)}${Math.max(4, table.rows.length + 4)}`;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${lengths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` +
    `<sheetData>${titleRow}${subtitleRow}${headerRow}${bodyRows}</sheetData>` +
    `<autoFilter ref="A4:${last}"/>` +
    '</worksheet>'
  );
};

const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="15"/><name val="Calibri"/></font>' +
  '<font><i/><sz val="10"/><color rgb="FF5B6B75"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF1D6B7A"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

// Greek letters in Latin, so the file name survives every browser and file system.
const LATIN: Record<string, string> = {
  α: 'a',
  β: 'v',
  γ: 'g',
  δ: 'd',
  ε: 'e',
  ζ: 'z',
  η: 'i',
  θ: 'th',
  ι: 'i',
  κ: 'k',
  λ: 'l',
  μ: 'm',
  ν: 'n',
  ξ: 'x',
  ο: 'o',
  π: 'p',
  ρ: 'r',
  σ: 's',
  ς: 's',
  τ: 't',
  υ: 'y',
  φ: 'f',
  χ: 'ch',
  ψ: 'ps',
  ω: 'o',
};
const safeName = (title: string) =>
  title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split('')
    .map(ch => {
      const latin = LATIN[ch.toLowerCase()];
      if (!latin) return ch;
      return ch === ch.toLowerCase() ? latin : latin[0].toUpperCase() + latin.slice(1);
    })
    .join('')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'SurgiTrack';

const today = () => new Date().toISOString().slice(0, 10);

/** The table as an Excel workbook: title, subtitle, header row, frozen panes, filters. */
export function xlsxBlob(table: ExportTable) {
  const sheetName = xml(table.title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' ') || 'SurgiTrack');
  return zip([
    {
      name: '[Content_Types].xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    },
    {
      name: '_rels/.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets>` +
        `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${sheetName.replace(/'/g, "''")}'!$A$4:$${column(table.headers.length - 1)}$${Math.max(4, table.rows.length + 4)}</definedName></definedNames></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    },
    {name: 'xl/styles.xml', content: STYLES},
    {name: 'xl/worksheets/sheet1.xml', content: sheetXml(table)},
  ]);
}

/** Downloads the table as an Excel workbook. */
export function downloadXlsx(table: ExportTable) {
  const blob = xlsxBlob(table);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${safeName(table.title)}_${today()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const html = (value: string | number) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A printable report page (A4 landscape) of the table, for "Print / PDF". */
export function tableReportHtml(table: ExportTable, lang: string) {
  const printed = new Date().toLocaleString(lang === 'el' ? 'el-GR' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${html(table.title)}</title>
<style>
@page { size: A4 landscape; margin: 14mm 12mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", Arial, sans-serif; color: #1c2b33; margin: 0; padding: 18px; font-size: 11px; }
header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1d6b7a; padding-bottom: 8px; margin-bottom: 12px; }
h1 { margin: 0; font-size: 19px; }
header p { margin: 4px 0 0; color: #5b6b75; }
header small { color: #5b6b75; text-align: right; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
th { background: #1d6b7a; color: #fff; text-align: left; padding: 6px 7px; font-size: 10.5px; }
td { padding: 5px 7px; border-bottom: 1px solid #dde5ea; vertical-align: top; }
tr:nth-child(even) td { background: #f5f8fa; }
tr { page-break-inside: avoid; }
footer { margin-top: 10px; color: #5b6b75; font-size: 10px; }
</style></head><body>
<header><div><h1>${html(table.title)}</h1>${table.subtitle ? `<p>${html(table.subtitle)}</p>` : ''}</div>
<small>SurgiTrack<br>${html(printed)}</small></header>
<table><thead><tr>${table.headers.map(h => `<th>${html(h)}</th>`).join('')}</tr></thead>
<tbody>${table.rows.map(row => `<tr>${row.map(v => `<td>${html(v ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>
<footer>${table.rows.length} ${lang === 'el' ? (table.rows.length === 1 ? 'εγγραφή' : 'εγγραφές') : table.rows.length === 1 ? 'record' : 'records'}</footer>
</body></html>`;
}
