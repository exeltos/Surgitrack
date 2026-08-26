import type {AssetKind, SetAsset, Tool} from '../../types/domain';

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'})[ch] || ch);

// Code 128 B: same symbology used by the legacy FileMaker Barcode_Code128 webview.
const CODE128_PATTERNS = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
  '2331112',
];

function code128Svg(raw: string, height = 48) {
  const value = raw.replace(/[^\x20-\x7E]/g, '');
  const data = [...value].map(ch => ch.charCodeAt(0) - 32);
  const start = 104;
  let checksum = start;
  data.forEach((code, index) => {
    checksum += code * (index + 1);
  });
  checksum %= 103;
  const symbols = [start, ...data, checksum, 106];
  const quiet = 10;
  let x = quiet;
  const bars: string[] = [];
  symbols.forEach(code => {
    const pattern = CODE128_PATTERNS[code];
    [...pattern].forEach((digit, index) => {
      const width = Number(digit);
      if (index % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${width}" height="${height}" fill="#000"/>`);
      x += width;
    });
  });
  const width = x + quiet;
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Code 128 ${escapeHtml(value)}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${bars.join('')}</svg>`;
}

function openPrintWindow(title: string, html: string) {
  const win = window.open('', '_blank', 'width=1000,height=800');
  if (!win) return false;
  try {
    win.opener = null;
  } catch {
    // Some browsers disallow setting `opener` on a popup they consider foreign;
    // this is a best-effort security hardening step, not a required one.
  }
  win.document.open();
  // `html` contains the print CSS, closes <head>, opens <body> and contains the print sheet.
  // Keep the outer document valid so browsers do not silently rearrange print CSS/body nodes.
  win.document.write(
    `<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>${html}</body></html>`,
  );
  win.document.close();
  const doPrint = () => {
    win.focus();
    window.setTimeout(() => win.print(), 120);
  };
  if (win.document.readyState === 'complete') doPrint();
  else win.addEventListener('load', doPrint, {once: true});
  return true;
}

type PrintAsset =
  | Pick<SetAsset, 'barcode' | 'name' | 'department'>
  | Pick<Tool, 'barcode' | 'name' | 'department' | 'uses' | 'maxUses'>;

export function barcodeLabelHtml(asset: PrintAsset, kind: AssetKind, toolCount?: number) {
  const details =
    kind === 'SET'
      ? `${toolCount ?? 0} εργαλεία`
      : `Χρήσεις: ${'uses' in asset ? asset.uses : 0}${'maxUses' in asset && asset.maxUses ? ` / ${asset.maxUses}` : ''}`;
  const mainBarcode = code128Svg(asset.barcode, 54);
  const smallBarcode = code128Svg(asset.barcode, 42);
  const body = `<style>
  @page{size:100mm 50mm;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}html,body{width:100mm;height:50mm;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#111;overflow:hidden}.sheet{width:100mm;height:50mm;display:grid;grid-template-rows:25mm 25mm}.main{position:relative;border-bottom:.2mm solid #bbb;padding:2.2mm 3mm 1.4mm}.main-head{display:flex;justify-content:space-between;align-items:flex-start;gap:3mm}.name{font-size:8.8pt;font-weight:700;line-height:1.05;max-width:72mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.brand{font-size:10pt;font-weight:800;letter-spacing:.02em}.main-barcode{width:62mm;height:12.8mm;margin:1.1mm auto 0;display:flex;flex-direction:column;align-items:center}.main-barcode svg{width:62mm;height:9.5mm;display:block}.code{font-size:8pt;line-height:1;margin-top:.6mm}.detail{position:absolute;left:3mm;bottom:1.6mm;font-size:6.6pt;color:#555}.bottom{display:grid;grid-template-columns:50mm 50mm}.small{padding:1.5mm 2.2mm 1mm;position:relative;overflow:hidden}.small:first-child{border-right:.2mm solid #bbb}.small .name{font-size:6.8pt;max-width:45mm}.small-barcode{width:39.5mm;height:13.5mm;margin:1.1mm auto 0;display:flex;flex-direction:column;align-items:center}.small-barcode svg{width:39.5mm;height:8.2mm;display:block}.small .code{font-size:6.7pt;margin-top:.5mm}.small .detail{left:2.2mm;bottom:1.2mm;font-size:5.8pt}@media print{html,body,.sheet{width:100mm;height:50mm}}</style></head><body><div class="sheet"><section class="main"><div class="main-head"><div class="name">${escapeHtml(asset.name)}</div><div class="brand">SurgiTrack</div></div><div class="main-barcode">${mainBarcode}<div class="code">${escapeHtml(asset.barcode)}</div></div><div class="detail">${escapeHtml(details)}</div></section><div class="bottom"><section class="small"><div class="name">${escapeHtml(asset.name)}</div><div class="small-barcode">${smallBarcode}<div class="code">${escapeHtml(asset.barcode)}</div></div><div class="detail">${escapeHtml(details)}</div></section><section class="small"><div class="name">${escapeHtml(asset.name)}</div><div class="small-barcode">${smallBarcode}<div class="code">${escapeHtml(asset.barcode)}</div></div><div class="detail">${escapeHtml(details)}</div></section></div></div>`;
  return `<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Barcode ${asset.barcode}</title>${body}</body></html>`;
}

export function printBarcodeLabel(asset: PrintAsset, kind: AssetKind, toolCount?: number) {
  return openPrintWindow(
    `Barcode ${asset.barcode}`,
    barcodeLabelHtml(asset, kind, toolCount).replace(
      /^<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>[^<]*<\/title>/,
      '',
    ),
  );
}

export function compositionHtml(
  set: SetAsset,
  tools: Tool[],
  preparedBy: string,
  preparedAt: string,
  issueBarcodes: string[] = [],
) {
  const groups = new Map<string, {name: string; code: string; manufacturer: string; count: number; issue: boolean}>();
  for (const tool of tools) {
    const key = `${tool.name}__${tool.code}__${tool.manufacturer}`;
    const current = groups.get(key);
    if (current) {
      current.count += 1;
      if (issueBarcodes.includes(tool.barcode)) current.issue = true;
    } else
      groups.set(key, {
        name: tool.name,
        code: tool.code,
        manufacturer: tool.manufacturer || '—',
        count: 1,
        issue: issueBarcodes.includes(tool.barcode),
      });
  }
  const rows = [...groups.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'el'))
    .map(
      row =>
        `<tr class="${row.issue ? 'issue' : ''}"><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.code)}</td><td>${escapeHtml(row.manufacturer)}</td><td class="qty">${row.count}</td></tr>`,
    )
    .join('');
  const barcode = code128Svg(set.barcode, 48);
  const body = `<style>
  @page{size:A4 portrait;margin:11mm 10mm 13mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;font-family:Arial,sans-serif;color:#111;font-size:9pt}.sheet{width:100%}.top{display:grid;grid-template-columns:1fr 1fr 1fr;align-items:start;margin-bottom:5mm}.brand{font-size:16pt;font-weight:800;letter-spacing:.03em}.barcode{text-align:center}.barcode svg{width:42mm;height:12mm}.barcode-code{font-size:8pt;margin-top:1mm}.meta-actions{text-align:right;font-size:7pt;color:#555}.title{font-size:12pt;font-weight:700;margin:1mm 0 2mm}.submeta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4mm;margin-bottom:4mm;font-size:8pt}.submeta b{display:block;font-size:7pt;color:#666;margin-bottom:.5mm}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}th{font-size:7.5pt;text-align:left;padding:2.1mm 1.5mm;border-bottom:.35mm solid #777}td{padding:1.75mm 1.5mm;border-bottom:.2mm solid #d4d4d4;vertical-align:top}th:nth-child(1),td:nth-child(1){width:43%}th:nth-child(2),td:nth-child(2){width:20%}th:nth-child(3),td:nth-child(3){width:27%}.qty{width:10%;text-align:center;font-weight:700}.issue{color:#c62828;font-style:italic}.footer{margin-top:5mm;border-top:.2mm solid #ccc;padding-top:2mm;display:flex;justify-content:space-between;font-size:7pt;color:#555}@media print{.sheet{break-inside:auto}tr{break-inside:avoid}}</style></head><body><div class="sheet"><div class="top"><div class="brand">SurgiTrack</div><div class="barcode">${barcode}<div class="barcode-code">${escapeHtml(set.barcode)}</div></div><div class="meta-actions">Φύλλο σύνθεσης & προετοιμασίας</div></div><div class="title">${escapeHtml(set.name)}</div><div class="submeta"><div><b>Σύνολο εργαλείων</b>${tools.length}</div><div><b>Προετοίμασε</b>${escapeHtml(preparedBy)}</div><div><b>Ημερομηνία / ώρα</b>${escapeHtml(preparedAt)}</div></div><table><thead><tr><th>Ονομασία</th><th>Κωδικός</th><th>Εταιρεία</th><th class="qty">Σύνολο</th></tr></thead><tbody>${rows}</tbody></table><div class="footer"><span>${escapeHtml(set.department)}</span><span>${escapeHtml(set.barcode)} · ${tools.length} φυσικές εγγραφές</span></div></div>`;
  return `<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Σύνθεση ${set.barcode}</title>${body}</body></html>`;
}

export function printCompositionA4(
  set: SetAsset,
  tools: Tool[],
  preparedBy: string,
  preparedAt: string,
  issueBarcodes: string[] = [],
) {
  return openPrintWindow(
    `Σύνθεση ${set.barcode}`,
    compositionHtml(set, tools, preparedBy, preparedAt, issueBarcodes).replace(
      /^<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>[^<]*<\/title>/,
      '',
    ),
  );
}
