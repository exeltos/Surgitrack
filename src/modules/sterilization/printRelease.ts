import type {ProcessLoadRecord} from '../../types/domain';
import {tr, trData} from '../../i18n';
import {DEFAULT_LABEL_SETTINGS, type LabelSettings} from '../../core/libraryTypes';
import {formatExpiry} from '../../core/sterileExpiry';
import {code128Svg, escapeHtml, openPrintWindow} from './printUtils';

/** One item of the load as the form lists it; `sterileUntil` once released. */
export type ReleaseFormItem = {
  barcode: string;
  name: string;
  kind: 'SET' | 'TOOL';
  department?: string;
  shelfLifeMonths?: number;
  sterileUntil?: string;
};

export type ReleaseFormData = {
  load: ProcessLoadRecord;
  items: ReleaseFormItem[];
  hospital?: string;
  /** Who approves (the release user once released, otherwise the one printing). */
  approver: {name: string; department?: string};
  /** The release, when it happened. */
  released?: {at: string; decision: 'RELEASED' | 'REPROCESS'};
  label?: Partial<LabelSettings>;
};

const box = (checked: boolean) => `<span class="box${checked ? ' on' : ''}">${checked ? '✓' : ''}</span>`;
const choice = (label: string, checked: boolean) => `<span class="choice">${box(checked)}${escapeHtml(label)}</span>`;

/**
 * The printable release form of a sterilizer load (A4): the load and its cycle, the indicators with a place
 * to stick each strip, the checks, the items with their expiry, and the approval with the user's details.
 * Printed blank while the load is in the sterilizer; filled in once it is released.
 */
export function releaseFormBody({load, items, hospital, approver, released, label: labelSettings}: ReleaseFormData) {
  const sets = items.filter(item => item.kind === 'SET').length;
  const tools = items.length - sets;
  const loadType = [
    sets ? (sets === 1 ? tr('1 Σετ') : tr('{0} Σετ', sets)) : '',
    tools ? (tools === 1 ? tr('1 εργαλείο') : tr('{0} εργαλεία', tools)) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const months = [...new Set(items.map(item => item.shelfLifeMonths).filter(Boolean))];
  const shelfLife = months.length
    ? months.map(m => tr('{0} μήνες', m as number)).join(' / ')
    : tr('Ορίζεται στην αποδέσμευση');
  const chemicalUsed = load.chemicalIndicatorResult !== undefined;
  const biologicalUsed =
    load.biologicalIndicatorResult !== undefined && load.biologicalIndicatorResult !== 'NOT_REQUIRED';
  const chem = released ? load.chemicalIndicatorResult : undefined;
  const bio = released ? load.biologicalIndicatorResult : undefined;
  const label = {...DEFAULT_LABEL_SETTINGS, ...(labelSettings || {})};
  const header =
    label.header === 'LOGO' && label.logo && /^data:image\/(png|jpeg|webp);/.test(label.logo)
      ? `<img class="logo" src="${escapeHtml(label.logo)}" alt="">`
      : label.header === 'TEXT' && label.text?.trim()
        ? `<div class="brand">${escapeHtml(label.text.trim())}</div>`
        : '<div class="brand">SurgiTrack</div>';
  const meta = [
    [tr('Τύπος φορτίου'), loadType || '—'],
    [tr('Κλίβανος'), trData(load.equipment)],
    [tr('Κύκλος'), load.cycleNumber],
    [tr('Πρόγραμμα'), load.program],
    [tr('Φόρτωση'), `${load.createdAt} · ${trData(load.createdByName)}`],
    [tr('Τέλος κύκλου'), load.completedAt || '—'],
    [tr('Διάρκεια αποστείρωσης'), shelfLife],
    [tr('Μονάδα'), hospital || '—'],
    [tr('Φορτίο'), load.id],
  ]
    .map(([k, v]) => `<div><b>${escapeHtml(k)}</b><span>${escapeHtml(v)}</span></div>`)
    .join('');
  const indicator = (title: string, used: boolean, result: string | undefined, extra: string) => `
    <section class="ind${used ? '' : ' unused'}">
      <header><b>${escapeHtml(title)}</b>${used ? '' : `<small>${escapeHtml(tr('Δεν μπήκε στο φορτίο'))}</small>`}</header>
      <div class="results">${choice(tr('Επιτυχής'), result === 'PASS')}${choice(tr('Ανεπιτυχής'), result === 'FAIL')}${extra}</div>
      <div class="strip">${escapeHtml(tr('Επικολλήστε εδώ την ταινία του δείκτη'))}</div>
    </section>`;
  const rows = items
    .map(
      (item, index) =>
        `<tr><td class="num">${index + 1}</td><td class="mono">${escapeHtml(item.barcode)}</td><td class="name">${escapeHtml(item.name)}</td><td>${escapeHtml(item.kind === 'SET' ? tr('Σετ') : tr('Εργαλείο'))}</td><td>${escapeHtml(trData(item.department) || '—')}</td><td>${escapeHtml(item.sterileUntil ? formatExpiry(item.sterileUntil) : item.shelfLifeMonths ? tr('{0} μήνες', item.shelfLifeMonths) : '')}</td><td class="chk">${box(false)}</td></tr>`,
    )
    .join('');
  const decided = released?.decision;
  return `<style>
  @page{size:A4 portrait;margin:11mm 11mm 13mm;@bottom-right{content:counter(page) " / " counter(pages);font:7pt Arial,sans-serif;color:#667}}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#15232b;font-size:9pt}
  .top{display:grid;grid-template-columns:1fr auto;gap:6mm;align-items:start;padding-bottom:3mm;border-bottom:.6mm solid #1d6b7a}
  .brand{font-size:13pt;font-weight:800;letter-spacing:.03em;color:#1d6b7a}.logo{max-height:11mm;max-width:55mm;object-fit:contain}
  .doc{font-size:7pt;font-weight:700;letter-spacing:.12em;color:#5f707b;text-transform:uppercase;margin-top:2.5mm}
  h1{margin:1mm 0 0;font-size:15pt;line-height:1.15}
  .barcode{text-align:center;padding:2mm 3mm;border:.25mm solid #cfd9df;border-radius:2mm}.barcode svg{width:52mm;height:12mm;display:block}.barcode-code{font-size:8pt;font-weight:700;letter-spacing:.06em;margin-top:1mm}
  .meta{display:grid;grid-template-columns:repeat(3,1fr);margin:4mm 0;border:.25mm solid #d7e0e5;border-radius:2mm;overflow:hidden}.meta div{padding:1.8mm 3mm;border-right:.25mm solid #e3e9ec;border-bottom:.25mm solid #e3e9ec}.meta div:nth-child(3n){border-right:0}.meta div:nth-last-child(-n+3){border-bottom:0}.meta b{display:block;font-size:6.5pt;letter-spacing:.06em;color:#6a7a84;text-transform:uppercase;margin-bottom:.5mm}.meta span{font-size:9pt;font-weight:700}
  h2{font-size:8pt;letter-spacing:.08em;text-transform:uppercase;color:#4b5d68;margin:4mm 0 2mm}
  .inds{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
  .ind{border:.3mm solid #b9c8cf;border-radius:2mm;padding:2.5mm 3mm;break-inside:avoid}.ind.unused{opacity:.55}
  .ind header{display:flex;justify-content:space-between;align-items:baseline}.ind header small{font-size:7pt;color:#6a7a84}
  .results{display:flex;flex-wrap:wrap;gap:4mm;margin:2mm 0}
  .choice{display:inline-flex;align-items:center;gap:1.5mm;font-size:8.5pt}
  .box{display:inline-grid;place-items:center;width:4mm;height:4mm;border:.3mm solid #4b5d68;border-radius:.6mm;font-size:8pt;font-weight:800;line-height:1}.box.on{background:#1d6b7a;border-color:#1d6b7a;color:#fff}
  .strip{display:grid;place-items:center;height:24mm;border:.4mm dashed #8a9aa3;border-radius:1.5mm;color:#8a9aa3;font-size:7.5pt;text-align:center}
  .checks{display:flex;flex-wrap:wrap;gap:6mm;padding:2.5mm 3mm;border:.25mm solid #d7e0e5;border-radius:2mm}
  table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}
  th{font-size:7pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4b5d68;text-align:left;padding:1.8mm 1.6mm;background:#eef4f6;border-bottom:.35mm solid #9fb3bd}
  td{padding:1.6mm;border-bottom:.2mm solid #dde4e8;vertical-align:top}tbody tr:nth-child(even) td{background:#f8fafb}
  .num{width:6%;color:#6a7a84;text-align:right}th:nth-child(2),td.mono{width:15%}td.mono{font-family:monospace;font-weight:700}td.name{font-weight:700}th:nth-child(4),td:nth-child(4){width:11%}th:nth-child(5),td:nth-child(5){width:18%}th:nth-child(6),td:nth-child(6){width:14%}.chk{width:8%;text-align:center}
  .approve{display:grid;grid-template-columns:1.1fr 1fr;gap:5mm;margin-top:4mm;break-inside:avoid}
  .decision{border:.3mm solid #b9c8cf;border-radius:2mm;padding:3mm;display:grid;gap:2.5mm}
  .sign{border:.3mm solid #b9c8cf;border-radius:2mm;padding:3mm;display:grid;gap:1.2mm;font-size:8.5pt}.sign b{font-size:7pt;letter-spacing:.06em;text-transform:uppercase;color:#4b5d68}.sign .line{margin-top:9mm;border-top:.3mm solid #8a9aa3;padding-top:1mm;font-size:7pt;color:#6a7a84}
  .footer{margin-top:4mm;padding-top:2mm;border-top:.2mm solid #d7e0e5;display:flex;justify-content:space-between;font-size:7pt;color:#6a7a84}
  @media screen{html{background:#e9eef1}body{max-width:210mm;margin:0 auto;padding:11mm;background:#fff;min-height:297mm}}
  @media print{tr{break-inside:avoid}}
  </style></head><body><div class="sheet">
  <div class="top"><div>${header}<div class="doc">${escapeHtml(tr('Έντυπο αποδέσμευσης φορτίου'))}</div><h1>${escapeHtml(trData(load.equipment))} · ${escapeHtml(tr('Κύκλος'))} ${escapeHtml(load.cycleNumber)}</h1></div><div class="barcode">${code128Svg(load.cycleNumber, 40)}<div class="barcode-code">${escapeHtml(load.cycleNumber)}</div></div></div>
  <div class="meta">${meta}</div>
  <h2>${escapeHtml(tr('Δείκτες'))}</h2>
  <div class="inds">${indicator(tr('Χημικός δείκτης'), chemicalUsed, chem, '')}${indicator(
    tr('Βιολογικός δείκτης'),
    biologicalUsed,
    bio,
    choice(tr('Σε αναμονή'), bio === 'PENDING'),
  )}</div>
  <h2>${escapeHtml(tr('Έλεγχοι φορτίου'))}</h2>
  <div class="checks">${choice(tr('Φυσικές παράμετροι κύκλου αποδεκτές'), !!released && !!load.physicalParametersOk)}${choice(tr('Συσκευασίες στεγνές και ακέραιες'), !!released && !!load.packagingIntegrityOk)}</div>
  <h2>${escapeHtml(tr('Περιεχόμενο φορτίου'))} · ${items.length}</h2>
  <table><thead><tr><th class="num">#</th><th>Barcode</th><th>${escapeHtml(tr('Ονομασία'))}</th><th>${escapeHtml(tr('Τύπος'))}</th><th>${escapeHtml(tr('Τμήμα'))}</th><th>${escapeHtml(tr('Λήξη'))}</th><th class="chk">${escapeHtml(tr('Έλεγχος'))}</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="approve">
    <div class="decision"><b>${escapeHtml(tr('Απόφαση'))}</b>${choice(tr('Αποδεσμεύεται'), decided === 'RELEASED')}${choice(tr('Μη αποδέσμευση · επανεπεξεργασία όλου του φορτίου'), decided === 'REPROCESS')}${load.note ? `<small>${escapeHtml(load.note)}</small>` : ''}</div>
    <div class="sign"><b>${escapeHtml(tr('Έγκριση'))}</b><span>${escapeHtml(trData(approver.name))}</span><span>${escapeHtml(trData(approver.department || ''))}</span><span>${escapeHtml(released ? released.at : tr('Ημερομηνία / ώρα: ………………'))}</span><div class="line">${escapeHtml(tr('Υπογραφή'))}</div></div>
  </div>
  <div class="footer"><span>SurgiTrack · ${escapeHtml(load.id)}</span><span>${escapeHtml(tr('Εκτυπώθηκε {0}', new Date().toLocaleString('el-GR', {dateStyle: 'short', timeStyle: 'short'})))}</span></div>
  </div>`;
}

export function printReleaseForm(data: ReleaseFormData) {
  return openPrintWindow(tr('Αποδέσμευση {0}', data.load.cycleNumber), releaseFormBody(data));
}
