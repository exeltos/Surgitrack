// @vitest-environment node
import {describe, expect, it} from 'vitest';
import {xlsxBlob} from '../exportTable';
import {parseCsv, readXlsx} from '../sheetImport';

const deflate = async (text: string) =>
  new Uint8Array(
    await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer(),
  );
const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

/** A minimal deflated workbook as Excel writes it: shared strings, a sheet that is not sheet1. */
const deflatedWorkbook = async () => {
  const files: Array<[string, string]> = [
    [
      'xl/workbook.xml',
      '<workbook xmlns:r="r"><sheets><sheet name="Λίστα" sheetId="3" r:id="rId7"/></sheets></workbook>',
    ],
    [
      'xl/_rels/workbook.xml.rels',
      '<Relationships><Relationship Id="rId7" Type="x" Target="worksheets/sheet3.xml"/></Relationships>',
    ],
    [
      'xl/sharedStrings.xml',
      '<sst><si><t>Όνομα</t></si><si><r><t>Ψαλίδι </t></r><r><t>Mayo &amp; co</t></r></si><si><t>Ποσότητα</t></si></sst>',
    ],
    [
      'xl/worksheets/sheet3.xml',
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>2</v></c></row>' +
        '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"/><c r="C2"><v>3</v></c></row></sheetData></worksheet>',
    ],
  ];
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBytes = new TextEncoder().encode(name);
    const data = await deflate(content);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(8, 8, true);
    local.setUint32(18, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, data);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(10, 8, true);
    entry.setUint32(20, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const directory = concat(central);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, directory.length, true);
  end.setUint32(16, offset, true);
  return concat([...parts, directory, new Uint8Array(end.buffer)]);
};

describe('parseCsv', () => {
  it('reads semicolons, quotes, doubled quotes and line breaks inside quotes', () => {
    const rows = parseCsv('\uFEFFΌνομα;Σημειώσεις\r\n"Λαβίδα; 14cm";"Είπε ""ναι""\nκαι μετά"\r\n\r\nΨαλίδι;\n');
    expect(rows).toEqual([['Όνομα', 'Σημειώσεις'], ['Λαβίδα; 14cm', 'Είπε "ναι"\nκαι μετά'], [''], ['Ψαλίδι', '']]);
  });
  it('picks commas when the header has them', () => {
    expect(parseCsv('name,code\nKocher,BH110')).toEqual([
      ['name', 'code'],
      ['Kocher', 'BH110'],
    ]);
  });
});

describe('readXlsx', () => {
  it('reads back the workbook the app exports (the import template)', async () => {
    const blob = xlsxBlob({
      title: 'Πρότυπο',
      subtitle: 'Μία γραμμή ανά εργαλείο',
      headers: ['Σετ', 'Ποσότητα'],
      rows: [['Βασικό <1>', 4]],
    });
    const rows = await readXlsx(new Uint8Array(await blob.arrayBuffer()));
    expect(rows).toEqual([['Πρότυπο'], ['Μία γραμμή ανά εργαλείο'], [], ['Σετ', 'Ποσότητα'], ['Βασικό <1>', '4']]);
  });
  it('reads a deflated workbook with shared and rich strings and gaps between cells', async () => {
    expect(await readXlsx(await deflatedWorkbook())).toEqual([
      ['Όνομα', '', 'Ποσότητα'],
      ['Ψαλίδι Mayo & co', '', '3'],
    ]);
  });
});
