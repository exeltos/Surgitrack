import type {ProcessLoadRecord} from '../../types/domain';
import {tr, trData} from '../../i18n';
import {DEFAULT_LABEL_SETTINGS, type LabelSettings} from '../../core/libraryTypes';
import {MIN_HOLD_PRESSURE, planFor, type CycleData, type CycleProblem} from '../../core/cycleSimulator';
import {code128Svg, openPrintWindow} from './printUtils';
import {escapeHtml} from '../../core/escapeHtml';
import {formatDateTime} from '../../core/displayDate';

export type CycleReportData = {
  load: ProcessLoadRecord & {cycleData: CycleData};
  hospital?: string;
  /** The release, when the load has been released (who and when). */
  release?: {at: string; by: string; decision: 'RELEASED' | 'REPROCESS'};
  label?: Partial<LabelSettings>;
};

export const problemTexts = (): Record<CycleProblem, string> => ({
  ABORTED: tr('Ο κύκλος διακόπηκε από συναγερμό του κλιβάνου.'),
  LOW_PRESSURE: tr('Η πίεση έπεσε κάτω από το όριο κατά τη διάρκεια της αποστείρωσης.'),
  SHORT_HOLD: tr('Η θερμοκρασία δεν κρατήθηκε για όσο χρόνο απαιτεί το πρόγραμμα.'),
});

const W = 640;
const H = 230;
const PAD = {left: 40, right: 40, top: 14, bottom: 26};

/** The cycle's temperature and pressure over time as a static SVG (hold band, pressure limit, axes). */
export function cycleChartSvg(data: CycleData) {
  const plan = planFor(data.program);
  const last = data.curve[data.curve.length - 1]?.[0] || 1;
  const x = (minute: number) => PAD.left + (minute / last) * (W - PAD.left - PAD.right);
  const tMax = data.setpoint + 10;
  const tY = (t: number) => PAD.top + (1 - (t - 20) / (tMax - 20)) * (H - PAD.top - PAD.bottom);
  const pMax = 2.6;
  const pY = (p: number) => PAD.top + (1 - p / pMax) * (H - PAD.top - PAD.bottom);
  const path = (pick: (row: [number, number, number]) => number) =>
    data.curve.map((row, index) => `${index ? 'L' : 'M'}${x(row[0]).toFixed(1)},${pick(row).toFixed(1)}`).join(' ');
  const holdFrom = x(plan.heatMinutes);
  const holdTo = x(Math.min(plan.heatMinutes + data.requiredHoldMinutes, last));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * last));
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">
    <rect x="${holdFrom}" y="${PAD.top}" width="${Math.max(holdTo - holdFrom, 0)}" height="${H - PAD.top - PAD.bottom}" fill="#eaf1f4"/>
    <line x1="${PAD.left}" x2="${W - PAD.right}" y1="${H - PAD.bottom}" y2="${H - PAD.bottom}" stroke="#9fb3bd"/>
    <line x1="${PAD.left}" x2="${W - PAD.right}" y1="${pY(MIN_HOLD_PRESSURE)}" y2="${pY(MIN_HOLD_PRESSURE)}" stroke="#b44747" stroke-dasharray="4 3" stroke-width=".8"/>
    <path d="${path(row => tY(row[1]))}" fill="none" stroke="#d97706" stroke-width="2"/>
    <path d="${path(row => pY(row[2]))}" fill="none" stroke="#167187" stroke-width="2"/>
    ${ticks.map(m => `<text x="${x(m)}" y="${H - 8}" font-size="9" text-anchor="middle" fill="#5f707b">${m}′</text>`).join('')}
    <text x="${PAD.left - 6}" y="${tY(data.setpoint) + 3}" font-size="9" text-anchor="end" fill="#a6620c">${data.setpoint}°</text>
    <text x="${W - PAD.right + 6}" y="${pY(MIN_HOLD_PRESSURE) + 3}" font-size="9" fill="#b44747">${MIN_HOLD_PRESSURE.toFixed(1)} bar</text>
  </svg>`;
}

/**
 * The printable report of a sterilizer cycle (A4): the load and cycle, the temperature and pressure curve, what
 * was measured against what the program requires, the verdict, the items and the release. A simulated cycle is
 * marked as such everywhere on it.
 */
export function cycleReportBody({load, hospital, release, label: labelSettings}: CycleReportData) {
  const data = load.cycleData;
  const simulated = data.source === 'SIMULATION';
  const passed = data.result === 'PASS';
  const label = {...DEFAULT_LABEL_SETTINGS, ...(labelSettings || {})};
  const header =
    label.header === 'LOGO' && label.logo && /^data:image\/(png|jpeg|webp);/.test(label.logo)
      ? `<img class="logo" src="${escapeHtml(label.logo)}" alt="">`
      : label.header === 'TEXT' && label.text?.trim()
        ? `<div class="brand">${escapeHtml(label.text.trim())}</div>`
        : '<div class="brand">SurgiTrack</div>';
  const meta = [
    [tr('Κλίβανος'), trData(load.equipment)],
    [tr('Κύκλος'), load.cycleNumber],
    [tr('Πρόγραμμα'), data.program],
    [tr('Έναρξη'), data.startedAt],
    [tr('Λήξη'), data.endedAt],
    [tr('Πηγή δεδομένων'), simulated ? tr('Προσομοίωση') : tr('Συσκευή')],
    [tr('Μονάδα'), hospital || '—'],
    [tr('Φορτίο'), load.id],
    [tr('Αντικείμενα'), String(load.items.length)],
  ]
    .map(([k, v]) => `<div><b>${escapeHtml(k)}</b><span>${escapeHtml(v)}</span></div>`)
    .join('');
  const measured = [
    [
      tr('Θερμοκρασία αποστείρωσης'),
      `${data.setpoint} °C`,
      `${data.maxTemperature.toFixed(1)} °C`,
      data.maxTemperature >= data.setpoint,
    ],
    [
      tr('Πίεση αποστείρωσης'),
      `≥ ${MIN_HOLD_PRESSURE.toFixed(1)} bar`,
      `${(data.minHoldPressure ?? data.maxPressure).toFixed(2)} bar (${tr('ελάχιστη')})`,
      !data.problems.includes('LOW_PRESSURE') && !data.problems.includes('ABORTED'),
    ],
    [
      tr('Χρόνος αποστείρωσης'),
      `${data.requiredHoldMinutes} ${tr('λεπτά')}`,
      `${data.holdMinutes} ${tr('λεπτά')}`,
      data.holdMinutes >= data.requiredHoldMinutes,
    ],
  ]
    .map(
      ([name, required, got, ok]) =>
        `<tr><td>${escapeHtml(String(name))}</td><td>${escapeHtml(String(required))}</td><td class="v">${escapeHtml(String(got))}</td><td class="${ok ? 'ok' : 'bad'}">${escapeHtml(ok ? tr('Τηρήθηκε') : tr('Δεν τηρήθηκε'))}</td></tr>`,
    )
    .join('');
  const problems = problemTexts();
  const items = load.items
    .map(
      (item, index) =>
        `<tr><td class="num">${index + 1}</td><td class="mono">${escapeHtml(item.barcode)}</td><td class="name">${escapeHtml(item.assetName)}</td><td>${escapeHtml(item.assetKind === 'SET' ? tr('Σετ') : tr('Εργαλείο'))}</td><td>${escapeHtml(trData(item.department) || '—')}</td></tr>`,
    )
    .join('');
  return `<style>
  @page{size:A4 portrait;margin:11mm 11mm 13mm;@bottom-right{content:counter(page) " / " counter(pages);font:7pt Arial,sans-serif;color:#667}}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#15232b;font-size:9pt}
  .top{display:grid;grid-template-columns:1fr auto;gap:6mm;align-items:start;padding-bottom:3mm;border-bottom:.6mm solid #1d6b7a}
  .brand{font-size:13pt;font-weight:800;letter-spacing:.03em;color:#1d6b7a}.logo{max-height:11mm;max-width:55mm;object-fit:contain}
  .doc{font-size:7pt;font-weight:700;letter-spacing:.12em;color:#5f707b;text-transform:uppercase;margin-top:2.5mm}
  h1{margin:1mm 0 0;font-size:15pt;line-height:1.15}
  .barcode{text-align:center;padding:2mm 3mm;border:.25mm solid #cfd9df;border-radius:2mm}.barcode svg{width:52mm;height:12mm;display:block}.barcode-code{font-size:8pt;font-weight:700;letter-spacing:.06em;margin-top:1mm}
  .sim{margin-top:3mm;padding:2mm 3mm;border:.3mm dashed #d97706;border-radius:2mm;background:#fff7e8;color:#8a4b00;font-size:8pt;font-weight:700}
  .meta{display:grid;grid-template-columns:repeat(3,1fr);margin:4mm 0;border:.25mm solid #d7e0e5;border-radius:2mm;overflow:hidden}.meta div{padding:1.8mm 3mm;border-right:.25mm solid #e3e9ec;border-bottom:.25mm solid #e3e9ec}.meta div:nth-child(3n){border-right:0}.meta div:nth-last-child(-n+3){border-bottom:0}.meta b{display:block;font-size:6.5pt;letter-spacing:.06em;color:#6a7a84;text-transform:uppercase;margin-bottom:.5mm}.meta span{font-size:9pt;font-weight:700}
  h2{font-size:8pt;letter-spacing:.08em;text-transform:uppercase;color:#4b5d68;margin:4mm 0 2mm}
  .chart{width:100%;height:auto;border:.25mm solid #d7e0e5;border-radius:2mm;display:block}
  .legend{display:flex;gap:6mm;margin-top:1.5mm;font-size:7.5pt;color:#5f707b}.legend i{display:inline-block;width:6mm;border-top:.7mm solid;vertical-align:middle;margin-right:1.5mm}
  table{width:100%;border-collapse:collapse;table-layout:auto}thead{display:table-header-group}
  th{font-size:7pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4b5d68;text-align:left;padding:1.8mm 1.6mm;background:#eef4f6;border-bottom:.35mm solid #9fb3bd}
  td{padding:1.6mm;border-bottom:.2mm solid #dde4e8;vertical-align:top}tbody tr:nth-child(even) td{background:#f8fafb}
  td.v{font-weight:700}td.ok{color:#1d7a4d;font-weight:700}td.bad{color:#b44747;font-weight:700}td.mono{font-family:monospace;font-weight:700}td.name{font-weight:700}.num{width:6%;color:#6a7a84;text-align:right}
  .verdict{margin-top:3mm;padding:2.5mm 3mm;border-radius:2mm;font-weight:700;border:.3mm solid}.verdict.ok{background:#e7f4ec;border-color:#7fbf9b;color:#1d7a4d}.verdict.bad{background:#fbeaea;border-color:#e0a3a3;color:#b44747}.verdict small{display:block;margin-top:1mm;font-weight:400;color:#333}
  .sign{margin-top:4mm;border:.3mm solid #b9c8cf;border-radius:2mm;padding:3mm;display:grid;gap:1.2mm;font-size:8.5pt;break-inside:avoid}.sign b{font-size:7pt;letter-spacing:.06em;text-transform:uppercase;color:#4b5d68}.sign .line{margin-top:9mm;border-top:.3mm solid #8a9aa3;padding-top:1mm;font-size:7pt;color:#6a7a84}
  .footer{margin-top:4mm;padding-top:2mm;border-top:.2mm solid #d7e0e5;display:flex;justify-content:space-between;font-size:7pt;color:#6a7a84}
  @media screen{html{background:#e9eef1}body{max-width:210mm;margin:0 auto;padding:11mm;background:#fff;min-height:297mm}}
  @media print{tr{break-inside:avoid}}
  </style></head><body><div class="sheet">
  <div class="top"><div>${header}<div class="doc">${escapeHtml(tr('Report κύκλου αποστείρωσης'))}</div><h1>${escapeHtml(trData(load.equipment))} · ${escapeHtml(tr('Κύκλος'))} ${escapeHtml(load.cycleNumber)}</h1></div><div class="barcode">${code128Svg(load.cycleNumber, 40)}<div class="barcode-code">${escapeHtml(load.cycleNumber)}</div></div></div>
  ${simulated ? `<div class="sim">${escapeHtml(tr('Προσομοίωση: οι τιμές είναι δοκιμαστικές και δεν προέρχονται από πραγματικό κλίβανο.'))}</div>` : ''}
  <div class="meta">${meta}</div>
  <h2>${escapeHtml(tr('Καμπύλη κύκλου'))}</h2>
  ${cycleChartSvg(data)}
  <div class="legend"><span><i style="border-color:#d97706"></i>${escapeHtml(tr('Θερμοκρασία'))}</span><span><i style="border-color:#167187"></i>${escapeHtml(tr('Πίεση'))}</span><span><i style="border-color:#b44747;border-top-style:dashed"></i>${escapeHtml(tr('Ελάχιστη πίεση {0} bar', MIN_HOLD_PRESSURE.toFixed(1)))}</span></div>
  <h2>${escapeHtml(tr('Παράμετροι'))}</h2>
  <table><thead><tr><th>${escapeHtml(tr('Παράμετρος'))}</th><th>${escapeHtml(tr('Απαιτείται'))}</th><th>${escapeHtml(tr('Μετρήθηκε'))}</th><th>${escapeHtml(tr('Αποτέλεσμα'))}</th></tr></thead><tbody>${measured}</tbody></table>
  <div class="verdict ${passed ? 'ok' : 'bad'}">${escapeHtml(passed ? tr('Οι παράμετροι του κύκλου τηρήθηκαν.') : tr('Οι παράμετροι του κύκλου δεν τηρήθηκαν.'))}${passed ? '' : `<small>${escapeHtml(data.problems.map(problem => problems[problem]).join(' '))}</small>`}</div>
  <h2>${escapeHtml(tr('Περιεχόμενο φορτίου'))} · ${load.items.length}</h2>
  <table><thead><tr><th class="num">#</th><th>Barcode</th><th>${escapeHtml(tr('Ονομασία'))}</th><th>${escapeHtml(tr('Τύπος'))}</th><th>${escapeHtml(tr('Τμήμα'))}</th></tr></thead><tbody>${items}</tbody></table>
  <div class="sign"><b>${escapeHtml(tr('Αποδέσμευση'))}</b><span>${escapeHtml(release ? `${release.decision === 'RELEASED' ? tr('Αποδεσμεύτηκε') : tr('Μη αποδέσμευση')} · ${release.at} · ${trData(release.by)}` : tr('Δεν έχει αποδεσμευτεί ακόμα'))}</span><div class="line">${escapeHtml(tr('Υπογραφή υπευθύνου'))}</div></div>
  <div class="footer"><span>SurgiTrack · ${escapeHtml(load.id)}</span><span>${escapeHtml(tr('Εκτυπώθηκε {0}', formatDateTime()))}</span></div>
  </div>`;
}

export function printCycleReport(data: CycleReportData) {
  return openPrintWindow(tr('Report κύκλου {0}', data.load.cycleNumber), cycleReportBody(data));
}
