import type {AssetKind, SetAsset, Tool} from '../../types/domain';
import {getI18nLang, tr, trData} from '../../i18n';
import {compositionLines} from '../../core/compositionCheck';
import {expirySymbolSvg, sterileDatesHtml, sterileSymbolSvg} from '../../core/sterileSymbols';
import {formatExpiry, sterilizedOnOf} from '../../core/sterileExpiry';
import {DEFAULT_LABEL_SETTINGS, type LabelSettings, type LabelSize} from '../../core/libraryTypes';

export const escapeHtml = (value: string) =>
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

export function code128Svg(raw: string, height = 48) {
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

export function openPrintWindow(title: string, html: string) {
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
    `<!doctype html><html lang="${getI18nLang()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>${html}</body></html>`,
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

type PrintAsset = (
  | Pick<SetAsset, 'barcode' | 'name' | 'department' | 'uses' | 'maxUses'>
  | Pick<Tool, 'barcode' | 'name' | 'department' | 'uses' | 'maxUses'>
) & {code?: string; sterileUntil?: string; sterilizedOn?: string; shelfLifeMonths?: number};

/** The label's paper size: the chosen size, or the printer roll's own when set (20–150 mm). */
export const labelPaper = (settings: LabelSettings) => {
  const preset = LABEL_MM[settings.size] || LABEL_MM.SMALL;
  const fit = (value: number | undefined, fallback: number) =>
    value && Number.isFinite(value) ? Math.min(150, Math.max(20, value)) : fallback;
  return {w: fit(settings.width, preset.w), h: fit(settings.height, preset.h)};
};

const LABEL_MM: Record<LabelSize, {w: number; h: number}> = {
  SMALL: {w: 50, h: 25},
  MEDIUM: {w: 70, h: 35},
  SHEET: {w: 100, h: 50},
};

const labelHeaderHtml = (settings: LabelSettings) => {
  if (settings.header === 'NONE') return '';
  if (settings.header === 'LOGO' && settings.logo && /^data:image\/(png|jpeg|webp|svg\+xml);/.test(settings.logo))
    return `<img class="logo" src="${escapeHtml(settings.logo)}" alt="">`;
  if (settings.header === 'TEXT' && settings.text?.trim())
    return `<div class="brand">${escapeHtml(settings.text.trim())}</div>`;
  return '<div class="brand">SurgiTrack</div>';
};

/** One label cell: name + header on top, barcode, code and (optionally) the details line. */
const labelCell = (asset: PrintAsset, details: string, settings: LabelSettings, className: string) =>
  labelCellHtml(asset, escapeHtml(details), settings, className);
const labelCellHtml = (asset: PrintAsset, details: string, settings: LabelSettings, className: string) =>
  `<section class="label ${className}">${settings.showCode && asset.code && className !== 'mini' ? `<div class="cod">cod. ${escapeHtml(asset.code)}</div>` : ''}<div class="head"><div class="name">${escapeHtml(asset.name)}</div>${labelHeaderHtml(settings)}</div><div class="bc">${code128Svg(asset.barcode, 48)}</div><div class="foot${details.includes('sym-date') ? ' dated' : ''}"><span class="code">${escapeHtml(asset.barcode)}</span>${settings.showDetails ? `<span class="detail">${details}</span>` : ''}</div></section>`;

/**
 * The barcode label's print CSS and body (the part after <title>). `screenZoom` enlarges it on
 * screen only (the preview); the printed size stays in millimetres.
 */
function barcodeLabelBody(
  asset: PrintAsset,
  kind: AssetKind,
  toolCount?: number,
  settings: LabelSettings = DEFAULT_LABEL_SETTINGS,
  screenZoom = 1,
) {
  // Once released, the label carries the sterilization and expiry dates with their symbols instead of the count.
  // Bottom line: the remaining uses on the left (limited-use Sets and instruments), the two dates side by side on the right.
  const maxUses = 'maxUses' in asset ? asset.maxUses : undefined;
  const usesLeft = maxUses ? Math.max(0, maxUses - (('uses' in asset ? asset.uses : 0) || 0)) : undefined;
  const datesHtml = asset.sterileUntil
    ? `${usesLeft !== undefined ? `<span class="left">${escapeHtml(tr('Υπόλ. χρήσεων: {0}', usesLeft))}</span>` : ''}<span class="dates">${sterileDatesHtml(sterilizedOnOf(asset), asset.sterileUntil, '0.95em', true)}</span>`
    : '';
  const details =
    kind === 'SET'
      ? tr('{0} εργαλεία', toolCount ?? 0)
      : `${tr('Χρήσεις')}: ${'uses' in asset ? asset.uses : 0}${'maxUses' in asset && asset.maxUses ? ` / ${asset.maxUses}` : ''}`;
  const {w, h} = labelPaper(settings);
  // 1 + 2: the large label on top, two small ones side by side below.
  const share = Math.min(70, Math.max(35, settings.mainShare || 50)) / 100;
  const mainH = +(h * share).toFixed(2);
  const miniH = +(h - mainH).toFixed(2);
  // Type scales with the label height so every size keeps the same proportions.
  const k = settings.size === 'SHEET' ? Math.min(1.25, Math.max(0.8, miniH / 25)) : h / 25;
  const right = Math.min(15, Math.max(0, settings.reserveRight || 0));
  const cell = (className: string) =>
    datesHtml ? labelCellHtml(asset, datesHtml, settings, className) : labelCell(asset, details, settings, className);
  const cells =
    settings.size === 'SHEET'
      ? `<div class="sheet-grid">${cell('main')}<div class="pair">${cell('mini')}${cell('mini')}</div></div>`
      : cell('single');
  const pt = (value: number) => `${(value * k).toFixed(2)}pt`;
  return `<style>
  @page{size:${w}mm ${h}mm;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}html,body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#111}body{width:${w}mm;height:${h}mm;overflow:hidden}
  .label{position:relative;width:100%;height:100%;display:flex;flex-direction:column;padding:1.4mm ${(2 + right).toFixed(1)}mm 1.1mm 2mm;overflow:hidden}
  .cod{font-size:${pt(5)};color:#444;line-height:1.1}
  .head{display:flex;justify-content:space-between;align-items:center;gap:1.5mm;min-height:0}
  .name{font-size:${pt(6.6)};font-weight:700;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
  .brand{font-size:${pt(6.2)};font-weight:800;letter-spacing:.02em;white-space:nowrap;flex:none;max-width:45%;overflow:hidden;text-overflow:ellipsis}
  .logo{height:${(3.6 * k).toFixed(2)}mm;max-width:40%;object-fit:contain;flex:none}
  .head,.foot,.cod{flex:none}.bc{flex:1 1 0;display:flex;align-items:stretch;justify-content:center;min-height:0;overflow:hidden;padding:.7mm 0 .3mm}.bc svg{width:88%;height:100%;display:block}
  .foot{display:grid;grid-template-columns:1fr auto 1fr;align-items:baseline;gap:1.5mm}.foot .code{grid-column:2;text-align:center}.foot .detail{grid-column:3;justify-self:end}
  .code{font-size:${pt(6.4)};font-weight:700;letter-spacing:.04em}.detail{font-size:${pt(5.2)};color:#222;white-space:nowrap}.sym-date{display:inline-flex;align-items:center;gap:.6mm}.foot.dated{display:flex;flex-wrap:wrap;row-gap:.2mm;justify-content:center}.foot.dated .code{flex:1 1 100%;text-align:center}.foot.dated .detail{flex:1 1 100%;display:flex;justify-content:space-between;align-items:center;gap:1.5mm}.foot.dated .dates{display:inline-flex;align-items:center;gap:1.6mm;margin-left:auto}
  .sheet-grid{width:${w}mm;height:${h}mm;display:grid;grid-template-rows:${mainH}mm ${miniH}mm}.sheet-grid .main{border-bottom:.2mm solid #bbb}
  .pair{display:grid;grid-template-columns:${(w / 2).toFixed(2)}mm ${(w / 2).toFixed(2)}mm}.pair .mini:first-child{border-right:.2mm solid #bbb}
  .sheet-grid .main .name{font-size:8.4pt}.sheet-grid .main .brand{font-size:8.6pt}.sheet-grid .main .code{font-size:7.6pt}.sheet-grid .main .detail{font-size:6.4pt}.sheet-grid .main .logo{height:4.6mm}
  @media screen{html{background:#eef2f5;zoom:${screenZoom}}body{margin:4mm;background:#fff;box-shadow:0 0 0 .2mm #c8d2d9,0 1mm 3mm rgba(0,0,0,.08)}}
  </style></head><body>${cells}`;
}

export function barcodeLabelHtml(
  asset: PrintAsset,
  kind: AssetKind,
  toolCount?: number,
  settings?: LabelSettings,
  screenZoom = 1,
) {
  return `<!doctype html><html lang="${getI18nLang()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Barcode ${escapeHtml(asset.barcode)}</title>${barcodeLabelBody(asset, kind, toolCount, settings, screenZoom)}</body></html>`;
}

export function printBarcodeLabel(asset: PrintAsset, kind: AssetKind, toolCount?: number, settings?: LabelSettings) {
  return openPrintWindow(`Barcode ${asset.barcode}`, barcodeLabelBody(asset, kind, toolCount, settings));
}

/** Extra look for the composition sheet: the label header (logo / text) and the Set's color marker. */
export type CompositionOptions = {
  label?: LabelSettings;
  marker?: Array<{name: string; colors: string[]; label?: string}>;
};

const markerChips = (marker: CompositionOptions['marker'] = []) =>
  marker
    .map(tape => {
      const stops = tape.colors.length ? tape.colors : ['#ccc'];
      const band = stops.map(
        (c, i) => `${escapeHtml(c)} ${(i * 100) / stops.length}% ${((i + 1) * 100) / stops.length}%`,
      );
      return `<span class="tape"><i style="background:linear-gradient(90deg,${band.join(',')})">${tape.label ? escapeHtml(tape.label) : ''}</i>${escapeHtml(tape.name)}</span>`;
    })
    .join('');

/** Sterilization (date and time), expiry and remaining uses, with their symbols, for the composition sheet. */
const sterileMetaHtml = (set: SetAsset) => {
  const on = set.sterileUntil ? sterilizedOnOf(set) : undefined;
  const cell = (label: string, value: string) => `<div><b>${label}</b><span class="symv">${value}</span></div>`;
  const usesLeft = set.maxUses ? Math.max(0, set.maxUses - (set.uses || 0)) : undefined;
  return [
    cell(
      `${sterileSymbolSvg('1em')} ${escapeHtml(tr('Αποστείρωση'))}`,
      on ? escapeHtml(`${formatExpiry(on)}${set.sterilizedTime ? `, ${set.sterilizedTime}` : ''}`) : '—',
    ),
    cell(
      `${expirySymbolSvg('1em')} ${escapeHtml(tr('Λήξη'))}`,
      set.sterileUntil ? escapeHtml(formatExpiry(set.sterileUntil)) : '—',
    ),
    cell(
      escapeHtml(tr('Υπόλοιπο χρήσεων')),
      escapeHtml(usesLeft !== undefined ? `${usesLeft} / ${set.maxUses}` : tr('Χωρίς όριο')),
    ),
  ].join('');
};

/** An open issue on the Set or one of its instruments, by barcode, for the composition sheet. */
export type CompositionProblem = {barcode: string; type: string};

/** The composition sheet's print CSS and body (the part after <title>), shared by the preview and the print window. */
function compositionBody(
  set: SetAsset,
  tools: Tool[],
  preparedBy: string,
  preparedAt: string,
  problems: CompositionProblem[] = [],
  options: CompositionOptions = {},
) {
  const byBarcode = new Map<string, string[]>();
  for (const p of problems) byBarcode.set(p.barcode, [...(byBarcode.get(p.barcode) || []), trData(p.type)]);
  const lines = compositionLines(set.compositionTemplate, tools, byBarcode);
  const templated = !!set.compositionTemplate?.length;
  const missingTotal = templated
    ? lines.reduce((sum, line) => sum + line.missing, 0)
    : Math.max(0, (set.expected || 0) - tools.length);
  const problemLines = lines.filter(line => line.problems.length).length;
  const setProblems = byBarcode.get(set.barcode) || [];
  const rows = lines
    .map((row, index) => {
      const flags = [
        row.missing
          ? `<em class="miss">${escapeHtml(row.missing === 1 ? tr('Λείπει 1') : tr('Λείπουν {0}', row.missing))}</em>`
          : '',
        row.problems.length ? `<em class="prob">${escapeHtml(row.problems.join(' · '))}</em>` : '',
        row.expected === undefined && templated
          ? `<em class="extra">${escapeHtml(tr('Εκτός πρότυπης σύνθεσης'))}</em>`
          : '',
      ].join('');
      const cls = [row.missing ? 'missing' : '', row.problems.length ? 'issue' : ''].join(' ').trim();
      return `<tr class="${cls}"><td class="num">${index + 1}</td><td class="name">${escapeHtml(row.name)}${flags}</td><td>${escapeHtml(row.code)}</td><td>${escapeHtml(row.manufacturer)}</td><td class="qty exp">${row.expected ?? '—'}</td><td class="qty">${row.present}</td><td class="chk"><span></span></td></tr>`;
    })
    .join('');
  const alert =
    missingTotal || problemLines || setProblems.length
      ? `<div class="alert">${[
          missingTotal
            ? `<b>${escapeHtml(missingTotal === 1 ? tr('Λείπει 1 εργαλείο') : tr('Λείπουν {0} εργαλεία', missingTotal))}</b>`
            : '',
          problemLines ? `<b>${escapeHtml(tr('{0} γραμμές με πρόβλημα', problemLines))}</b>` : '',
          setProblems.length ? `<b>${escapeHtml(tr('Εκκρεμότητα Σετ: {0}', setProblems.join(' · ')))}</b>` : '',
        ]
          .filter(Boolean)
          .join('<span>·</span>')}</div>`
      : '';
  const label = {...DEFAULT_LABEL_SETTINGS, ...(options.label || {})};
  const header =
    label.header === 'LOGO' && label.logo && /^data:image\/(png|jpeg|webp);/.test(label.logo)
      ? `<img class="logo" src="${escapeHtml(label.logo)}" alt="">`
      : label.header === 'TEXT' && label.text?.trim()
        ? `<div class="brand">${escapeHtml(label.text.trim())}</div>`
        : '<div class="brand">SurgiTrack</div>';
  const marker = markerChips(options.marker);
  const meta =
    [
      [tr('Τμήμα'), trData(set.department) || '—'],
      [tr('Ειδικότητα'), trData(set.specialty) || '—'],
      [
        tr('Σύνολο εργαλείων'),
        templated || set.expected
          ? `${tools.length} / ${templated ? lines.reduce((sum, line) => sum + (line.expected || 0), 0) : set.expected}`
          : String(tools.length),
      ],
      [tr('Είδη εργαλείων'), String(lines.length)],
      [tr('Προετοίμασε'), preparedBy],
      [tr('Ημερομηνία / ώρα'), preparedAt],
    ]
      .map(([k, v]) => `<div><b>${escapeHtml(k)}</b><span>${escapeHtml(v)}</span></div>`)
      .join('') + sterileMetaHtml(set);
  const barcode = code128Svg(set.barcode, 48);
  return `<style>
  @page{size:A4 portrait;margin:12mm 11mm 14mm;@bottom-right{content:counter(page) " / " counter(pages);font:7pt Arial,sans-serif;color:#667}}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#15232b;font-size:9pt}
  .sheet{width:100%}
  .top{display:grid;grid-template-columns:1fr auto;gap:6mm;align-items:start;padding-bottom:3.5mm;border-bottom:.6mm solid #1d6b7a}
  .brand-row{display:flex;align-items:center;gap:3mm;min-height:9mm}.brand{font-size:13pt;font-weight:800;letter-spacing:.03em;color:#1d6b7a}.logo{max-height:11mm;max-width:55mm;object-fit:contain}
  .doc{font-size:7pt;font-weight:700;letter-spacing:.12em;color:#5f707b;text-transform:uppercase;margin-top:2.5mm}
  h1{margin:1mm 0 0;font-size:15pt;line-height:1.15}
  .marker{display:flex;flex-wrap:wrap;gap:2mm;margin-top:2mm}.tape{display:inline-flex;align-items:center;gap:1.2mm;font-size:7.5pt;color:#3d4f5a}.tape i{display:inline-grid;place-items:center;min-width:7mm;height:3.6mm;border-radius:.8mm;border:.2mm solid rgba(0,0,0,.25);font-style:normal;font-size:6pt;font-weight:800;color:#fff;text-shadow:0 0 1px #000}
  .barcode{text-align:center;padding:2mm 3mm;border:.25mm solid #cfd9df;border-radius:2mm}.barcode svg{width:48mm;height:13mm;display:block}.barcode-code{font-size:9pt;font-weight:700;letter-spacing:.08em;margin-top:1mm}
  .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin:4mm 0 5mm;border:.25mm solid #d7e0e5;border-radius:2mm;overflow:hidden}.meta div{padding:2mm 3mm;border-right:.25mm solid #e3e9ec;border-bottom:.25mm solid #e3e9ec}.meta div:nth-child(3n){border-right:0}.meta div:nth-last-child(-n+3){border-bottom:0}.meta b{display:block;font-size:6.5pt;font-weight:700;letter-spacing:.06em;color:#6a7a84;text-transform:uppercase;margin-bottom:.6mm}.meta span{font-size:9pt;font-weight:700}.meta b svg{vertical-align:-.18em}
  table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}
  th{font-size:7pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4b5d68;text-align:left;padding:2mm 1.6mm;background:#eef4f6;border-bottom:.35mm solid #9fb3bd}
  td{padding:1.8mm 1.6mm;border-bottom:.2mm solid #dde4e8;vertical-align:top}tbody tr:nth-child(even) td{background:#f8fafb}
  .num{width:7%;color:#6a7a84;text-align:right;padding-right:2.5mm}th:nth-child(2),td.name{width:35%}td.name{font-weight:700}th:nth-child(3),td:nth-child(3){width:17%}th:nth-child(4),td:nth-child(4){width:18%}.qty{width:7%;text-align:center}td.qty{font-weight:800;font-size:10pt}.chk{width:9%;text-align:center}.chk span{display:inline-block;width:3.6mm;height:3.6mm;border:.3mm solid #6d808b;border-radius:.6mm}
  td.name em{display:inline-block;margin:.8mm 1.5mm 0 0;padding:.2mm 1.4mm;border-radius:.8mm;font-size:6.5pt;font-style:normal;font-weight:800;letter-spacing:.03em}
  em.miss{background:#fde8e6;color:#b3261e;border:.2mm solid #e8a59e}em.prob{background:#fff3df;color:#8a4b00;border:.2mm solid #e9c27f}em.extra{background:#eef2f4;color:#4b5d68}
  tr.missing td{background:#fdf3f2!important}tr.missing td.qty:not(.exp){color:#b3261e}tr.issue td{background:#fff9ef!important}td.exp{color:#6a7a84}
  .alert{display:flex;flex-wrap:wrap;gap:2mm;align-items:center;margin:-2mm 0 4mm;padding:2.2mm 3mm;border:.3mm solid #e8a59e;border-left:1.2mm solid #b3261e;border-radius:1.5mm;background:#fdf3f2;color:#8f1f17;font-size:8.5pt}.alert span{color:#c98a84}
  tfoot td{border-bottom:0;border-top:.35mm solid #9fb3bd;font-weight:800;background:#fff!important}
  .notes{margin-top:4mm;font-size:7.5pt;color:#5f707b}
  .signs{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;margin-top:8mm;break-inside:avoid}.signs div{border-top:.3mm solid #8a9aa3;padding-top:1.5mm;font-size:7pt;color:#4b5d68}.signs b{display:block;font-size:7.5pt;color:#15232b;margin-bottom:5mm}
  .footer{margin-top:5mm;padding-top:2mm;border-top:.2mm solid #d7e0e5;display:flex;justify-content:space-between;font-size:7pt;color:#6a7a84}
  @media screen{html{background:#e9eef1}body{max-width:210mm;margin:0 auto;padding:12mm 11mm;background:#fff;min-height:297mm}}
  @media print{tr{break-inside:avoid}}
  </style></head><body><div class="sheet">
  <div class="top"><div><div class="brand-row">${header}</div><div class="doc">${tr('Φύλλο σύνθεσης & προετοιμασίας')}</div><h1>${escapeHtml(set.name)}</h1>${marker ? `<div class="marker">${marker}</div>` : ''}</div><div class="barcode">${barcode}<div class="barcode-code">${escapeHtml(set.barcode)}</div></div></div>
  <div class="meta">${meta}</div>${alert}
  <table><thead><tr><th class="num">#</th><th>${tr('Ονομασία')}</th><th>${tr('Κωδικός')}</th><th>${tr('Εταιρεία')}</th><th class="qty">${tr('Αναμ.')}</th><th class="qty">${tr('Παρόντα')}</th><th class="chk">${tr('Έλεγχος')}</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td></td><td>${tr('Σύνολο')}</td><td></td><td></td><td class="qty exp">${templated ? lines.reduce((sum, line) => sum + (line.expected || 0), 0) : '—'}</td><td class="qty">${tools.length}</td><td></td></tr></tfoot></table>
  ${alert ? `<div class="notes">${escapeHtml(tr('Με κόκκινο: γραμμές με ελλείψεις. Με πορτοκαλί: εργαλεία με ανοιχτή εκκρεμότητα (βλάβη, φθορά κ.ά.).'))}</div>` : ''}
  <div class="signs"><div><b>${tr('Προετοιμασία / σύνθεση')}</b>${tr('Ονοματεπώνυμο & υπογραφή')}</div><div><b>${tr('Έλεγχος σύνθεσης')}</b>${tr('Ονοματεπώνυμο & υπογραφή')}</div><div><b>${tr('Κλίβανος / κύκλος')}</b>${tr('Αριθμός κύκλου & ημερομηνία')}</div></div>
  <div class="footer"><span>SurgiTrack · ${escapeHtml(set.barcode)}</span><span>${escapeHtml(tr('{0} φυσικές εγγραφές', tools.length))}</span></div>
  </div>`;
}

export function compositionHtml(
  set: SetAsset,
  tools: Tool[],
  preparedBy: string,
  preparedAt: string,
  problems: CompositionProblem[] = [],
  options?: CompositionOptions,
) {
  return `<!doctype html><html lang="${getI18nLang()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(tr('Σύνθεση {0}', set.barcode))}</title>${compositionBody(set, tools, preparedBy, preparedAt, problems, options)}</body></html>`;
}

export function printCompositionA4(
  set: SetAsset,
  tools: Tool[],
  preparedBy: string,
  preparedAt: string,
  problems: CompositionProblem[] = [],
  options?: CompositionOptions,
) {
  return openPrintWindow(
    tr('Σύνθεση {0}', set.barcode),
    compositionBody(set, tools, preparedBy, preparedAt, problems, options),
  );
}
