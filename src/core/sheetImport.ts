/**
 * Reads the first sheet of an Excel workbook (.xlsx) or a CSV file into rows of text cells.
 * No library: an .xlsx is a zip of XML files, unpacked with the browser's DecompressionStream.
 */

/** Rows in sheet order; a blank row stays (empty) so row numbers match what Excel shows. */
export type SheetRows = string[][];

const withoutTrailingBlanks = (rows: SheetRows) => {
  let end = rows.length;
  while (end && !rows[end - 1].some(Boolean)) end--;
  return rows.slice(0, end);
};

/** CSV with comma, semicolon or tab (Greek Excel saves with semicolons), quoted cells allowed. */
export function parseCsv(text: string): SheetRows {
  const source = text.replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] || '';
  const delimiter = [';', '\t', ','].reduce((best, candidate) =>
    firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best,
  );
  const rows: SheetRows = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return withoutTrailingBlanks(rows.map(r => r.map(c => c.trim())));
}

type ZipEntry = {method: number; size: number; offset: number};

const zipEntries = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new Error('not a zip');
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntry>();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error('bad zip directory');
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const offset = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    entries.set(name, {method, size, offset});
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
};

const readEntry = async (bytes: Uint8Array, entry: ZipEntry | undefined) => {
  if (!entry) return '';
  const data = bytes.slice(entry.offset, entry.offset + entry.size);
  if (entry.method === 0) return new TextDecoder().decode(data);
  if (entry.method !== 8) throw new Error('unsupported compression');
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
};

const unescapeXml = (value: string) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, '&');

/** The text of a string item: plain <t>, or the runs of rich text (phonetic hints left out). */
const itemText = (xml: string) =>
  unescapeXml(
    [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => m[1]).join(''),
  );

const columnIndex = (ref: string) =>
  [...ref.replace(/\d+$/, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

/** The first sheet of an .xlsx workbook, as text cells (numbers as Excel stored them). */
export async function readXlsx(bytes: Uint8Array): Promise<SheetRows> {
  const entries = zipEntries(bytes);
  const workbook = await readEntry(bytes, entries.get('xl/workbook.xml'));
  const rels = await readEntry(bytes, entries.get('xl/_rels/workbook.xml.rels'));
  const firstId = workbook.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  const target = firstId
    ? rels.match(new RegExp(`<Relationship\\b[^>]*Id="${firstId}"[^>]*Target="([^"]+)"`))?.[1] ||
      rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${firstId}"`))?.[1]
    : undefined;
  const sheetPath = target
    ? target.startsWith('/')
      ? target.slice(1)
      : `xl/${target.replace(/^\.\//, '')}`
    : 'xl/worksheets/sheet1.xml';
  const shared = [
    ...(await readEntry(bytes, entries.get('xl/sharedStrings.xml'))).matchAll(/<si>([\s\S]*?)<\/si>/g),
  ].map(m => itemText(m[1]));
  const sheet = await readEntry(bytes, entries.get(sheetPath));
  const rows: SheetRows = [];
  for (const rowMatch of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    const number = Number(rowMatch[1].match(/\br="(\d+)"/)?.[1]) || rows.length + 1;
    while (rows.length < number - 1) rows.push([]);
    for (const cell of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1];
      const body = cell[2] || '';
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      const value =
        type === 's'
          ? shared[Number(raw)] || ''
          : type === 'inlineStr'
            ? itemText(body)
            : type === 'b'
              ? raw === '1'
                ? 'TRUE'
                : 'FALSE'
              : unescapeXml(raw || '');
      const index = ref ? columnIndex(ref) : row.length;
      while (row.length < index) row.push('');
      row[index] = value.trim();
    }
    rows.push(row);
  }
  return withoutTrailingBlanks(rows);
}

/** Reads an uploaded file: .xlsx as a workbook, anything else as CSV text. */
export async function readSheetFile(file: File): Promise<SheetRows> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isZip) return readXlsx(bytes);
  if (/\.xls$/i.test(file.name)) throw new Error('xls');
  return parseCsv(decodeText(bytes));
}

/** UTF-8, or the Greek Windows code page older Excel versions save CSV in. */
const decodeText = (bytes: Uint8Array) => {
  try {
    return new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  } catch {
    return new TextDecoder('windows-1253').decode(bytes);
  }
};
