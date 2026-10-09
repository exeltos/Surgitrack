import type {PreparationRecord, SterilizationReleaseRecord} from '../../types/domain';
import type {SurgicalCount} from '../../store/types';
import {tr, trData} from '../../i18n';
import {formatExpiry, sterilizedOnOf} from '../../core/sterileExpiry';
import {expirySymbolSvg, sterileSymbolSvg} from '../../core/sterileSymbols';
import {code128Svg, openPrintWindow} from '../../modules/sterilization/printUtils';
import {escapeHtml} from '../../core/escapeHtml';

export type CountFormItem = {id: string; barcode: string; name: string; code?: string};
export type CountFormData = {
  asset: {
    barcode: string;
    name: string;
    department?: string;
    sterileUntil?: string;
    sterilizedOn?: string;
    sterilizedTime?: string;
    shelfLifeMonths?: number;
  };
  items: CountFormItem[];
  hospital?: string;
  /** Part A, signed by Sterilization: who composed the Set and who released it. */
  preparation?: PreparationRecord;
  release?: SterilizationReleaseRecord;
  /** Part B, the operating theatre's count: blank until signed. */
  count?: SurgicalCount;
  /** What is ticked in the send dialog right now (printed before signing). */
  draft?: {checkedToolIds: string[]; patientCode?: string; by?: string};
};

const box = (on: boolean) => `<span class="box${on ? ' on' : ''}">${on ? '✓' : ''}</span>`;

/**
 * The instrument count form (A4). Part A is pre-signed by Sterilization (composition and release, with
 * the sterile dates); part B is the operating theatre's count after the procedure: blank to fill in by
 * hand, or filled in once it is signed in the app.
 */
export function countFormBody({asset, items, hospital, preparation, release, count, draft}: CountFormData) {
  // The dates the Set carried when counted; before the count, its current ones.
  const dated = count?.sterileUntil
    ? {sterileUntil: count.sterileUntil, sterilizedOn: count.sterilizedOn, sterilizedTime: count.sterilizedTime}
    : asset;
  const on = dated.sterileUntil ? sterilizedOnOf({...dated, shelfLifeMonths: asset.shelfLifeMonths}) : undefined;
  const checked = new Set(count?.checkedToolIds || draft?.checkedToolIds || []);
  const signed = !!count;
  const meta = (label: string, value: string) => `<div><b>${label}</b><span>${value}</span></div>`;
  const partA = [
    meta(escapeHtml(tr('Τμήμα')), escapeHtml(trData(asset.department) || '—')),
    meta(
      escapeHtml(tr('Σύνθεση')),
      preparation ? `${escapeHtml(preparation.preparedByName)}<small>${escapeHtml(preparation.at)}</small>` : '—',
    ),
    meta(
      escapeHtml(tr('Αποδέσμευση')),
      release ? `${escapeHtml(release.releasedByName)}<small>${escapeHtml(release.releasedAt)}</small>` : '—',
    ),
    meta(
      `${sterileSymbolSvg('1em')} ${escapeHtml(tr('Αποστείρωση'))}`,
      on ? escapeHtml(`${formatExpiry(on)}${dated.sterilizedTime ? `, ${dated.sterilizedTime}` : ''}`) : '—',
    ),
    meta(
      `${expirySymbolSvg('1em')} ${escapeHtml(tr('Λήξη'))}`,
      dated.sterileUntil ? escapeHtml(formatExpiry(dated.sterileUntil)) : '—',
    ),
    meta(
      escapeHtml(tr('Κύκλος / κλίβανος')),
      release ? escapeHtml(`${release.cycleNumber} · ${trData(release.sterilizer)}`) : '—',
    ),
  ].join('');
  const rows = items
    .map(
      (item, index) =>
        `<tr><td class="num">${index + 1}</td><td class="mono">${escapeHtml(item.barcode)}</td><td class="name">${escapeHtml(item.name)}</td><td>${escapeHtml(item.code || '')}</td><td class="chk">${box(true)}</td><td class="chk">${box(checked.has(item.id))}</td></tr>`,
    )
    .join('');
  const counted = items.filter(item => checked.has(item.id)).length;
  const patient = count?.patientCode || draft?.patientCode || '';
  const by = count?.by || '';
  const mode = count?.mode === 'BULK' ? tr('μαζική («Όλα παρόντα»)') : count ? tr('ανά εργαλείο') : '';
  return `<style>
  @page{size:A4 portrait;margin:11mm 11mm 13mm}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#15232b;font-size:9pt}
  .top{display:grid;grid-template-columns:1fr auto;gap:6mm;align-items:start;padding-bottom:3mm;border-bottom:.6mm solid #1d6b7a}
  .brand{font-size:13pt;font-weight:800;letter-spacing:.03em;color:#1d6b7a}
  .doc{font-size:7pt;font-weight:700;letter-spacing:.12em;color:#5f707b;text-transform:uppercase;margin-top:2.5mm}
  h1{margin:1mm 0 0;font-size:15pt;line-height:1.15}
  .barcode{text-align:center;padding:2mm 3mm;border:.25mm solid #cfd9df;border-radius:2mm}.barcode svg{width:52mm;height:12mm;display:block}.barcode-code{font-size:8pt;font-weight:700;letter-spacing:.06em;margin-top:1mm}
  h2{display:flex;justify-content:space-between;align-items:baseline;font-size:8pt;letter-spacing:.08em;text-transform:uppercase;color:#4b5d68;margin:5mm 0 2mm}h2 small{letter-spacing:0;text-transform:none;font-weight:700}
  .meta{display:grid;grid-template-columns:repeat(3,1fr);border:.25mm solid #d7e0e5;border-radius:2mm;overflow:hidden}.meta div{padding:1.8mm 3mm;border-right:.25mm solid #e3e9ec;border-bottom:.25mm solid #e3e9ec}.meta div:nth-child(3n){border-right:0}.meta div:nth-last-child(-n+3){border-bottom:0}.meta b{display:block;font-size:6.5pt;letter-spacing:.06em;color:#6a7a84;text-transform:uppercase;margin-bottom:.5mm}.meta b svg{vertical-align:-.18em}.meta span{font-size:9pt;font-weight:700}.meta small{display:block;font-size:7.5pt;font-weight:400;color:#4b5d68}
  .signed{color:#1a6b3c}.pending{color:#a66b16}
  table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}
  th{font-size:7pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4b5d68;text-align:left;padding:1.8mm 1.6mm;background:#eef4f6;border-bottom:.35mm solid #9fb3bd}
  td{padding:1.6mm;border-bottom:.2mm solid #dde4e8;vertical-align:middle}tbody tr:nth-child(even) td{background:#f8fafb}
  .num{width:7%;color:#6a7a84;text-align:right;padding-right:2.5mm}.mono{width:16%;font-family:monospace;font-weight:700}td.name{font-weight:700}th:nth-child(4){width:16%}.chk{width:14%;text-align:center}th.chk{font-size:6pt;letter-spacing:0}
  .box{display:inline-grid;place-items:center;width:4mm;height:4mm;border:.3mm solid #4b5d68;border-radius:.6mm;font-size:8pt;font-weight:800;line-height:1}.box.on{background:#e8f4ee;color:#1a6b3c;border-color:#1a6b3c}
  .sum{margin-top:2mm;font-weight:700}
  .signs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5mm;margin-top:8mm;break-inside:avoid}.signs div{border-top:.3mm solid #8a9aa3;padding-top:1.5mm;font-size:7pt;color:#4b5d68}.signs b{display:block;font-size:7.5pt;color:#15232b;margin-bottom:.6mm}.signs strong{display:block;font-size:9pt;color:#15232b}
  .footer{margin-top:5mm;padding-top:2mm;border-top:.2mm solid #d7e0e5;display:flex;justify-content:space-between;font-size:7pt;color:#6a7a84}
  @media screen{html{background:#e9eef1}body{max-width:210mm;margin:0 auto;padding:12mm 11mm;background:#fff;min-height:297mm}}
  @media print{tr{break-inside:avoid}}
  </style></head><body>
  <div class="top"><div><div class="brand">${escapeHtml(hospital || 'SurgiTrack')}</div><div class="doc">${escapeHtml(tr('Έντυπο καταμέτρησης εργαλείων'))}</div><h1>${escapeHtml(asset.name)}</h1></div><div class="barcode">${code128Svg(asset.barcode, 48)}<div class="barcode-code">${escapeHtml(asset.barcode)}</div></div></div>
  <h2>${escapeHtml(tr('Α. Αποστείρωση · ελεγμένο και αποστειρωμένο'))}<small class="${release ? 'signed' : 'pending'}">${escapeHtml(release ? tr('Υπογεγραμμένο ηλεκτρονικά') : tr('Χωρίς αποδέσμευση'))}</small></h2>
  <div class="meta">${partA}</div>
  <h2>${escapeHtml(tr('Β. Χειρουργείο · καταμέτρηση μετά την επέμβαση'))}<small class="${signed ? 'signed' : 'pending'}">${escapeHtml(signed ? tr('Υπογεγραμμένη {0}', count?.at || '') : tr('Εκκρεμεί υπογραφή'))}</small></h2>
  <table><thead><tr><th class="num">#</th><th>Barcode</th><th>${escapeHtml(tr('Εργαλείο'))}</th><th>${escapeHtml(tr('Κωδικός'))}</th><th class="chk">${escapeHtml(tr('Εστάλη'))}</th><th class="chk">${escapeHtml(tr('Καταμετρήθηκε'))}</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="sum">${escapeHtml(tr('Καταμετρήθηκαν {0} από {1}', signed || draft ? counted : '___', items.length))}${count?.missing?.length ? ` · ${escapeHtml(tr('Λείπουν: {0}', count.missing.join(', ')))}` : ''}</div>
  <div class="signs"><div><b>${escapeHtml(tr('Κωδικός ασθενούς'))}</b><strong>${escapeHtml(patient) || '&nbsp;'}</strong></div><div><b>${escapeHtml(tr('Καταμέτρηση από'))}</b><strong>${escapeHtml(by) || '&nbsp;'}</strong>${escapeHtml(mode)}</div><div><b>${escapeHtml(tr('Ημερομηνία / ώρα · υπογραφή'))}</b><strong>${escapeHtml(count?.at || '') || '&nbsp;'}</strong></div></div>
  <div class="footer"><span>SurgiTrack · ${escapeHtml(asset.barcode)}</span><span>${escapeHtml(tr('{0} εργαλεία', items.length))}</span></div>`;
}

export function printCountForm(data: CountFormData) {
  return openPrintWindow(tr('Καταμέτρηση {0}', data.asset.barcode), countFormBody(data));
}
