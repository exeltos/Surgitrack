import type {PurchaseOrder} from '../../types/domain';
import type {ReplacementItem} from '../../core/replacements';
import {REASON_LABEL} from '../../core/replacements';
import {getI18nLang, tr, trData} from '../../i18n';
import {formatDateTime} from '../../core/displayDate';
import {escapeHtml as esc} from '../../core/escapeHtml';

const STYLE = `
@page{size:A4 landscape;margin:11mm 10mm 13mm;@bottom-right{content:counter(page) " / " counter(pages);font:7pt Arial,sans-serif;color:#667}}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#15232b;font-size:8.5pt}
.top{display:flex;justify-content:space-between;align-items:flex-end;gap:6mm;padding-bottom:3mm;border-bottom:.6mm solid #1d6b7a;margin-bottom:4mm}
.brand{font-size:12pt;font-weight:800;color:#1d6b7a;letter-spacing:.03em}.doc{font-size:7pt;font-weight:700;letter-spacing:.12em;color:#5f707b;text-transform:uppercase;margin-top:1.5mm}
h1{margin:1mm 0 0;font-size:15pt}.top p{margin:1mm 0 0;color:#5f707b}.when{text-align:right;color:#5f707b;font-size:7.5pt}
.sum{display:flex;flex-wrap:wrap;gap:3mm;margin:0 0 4mm}.sum div{padding:1.6mm 3mm;border:.25mm solid #d7e0e5;border-radius:1.5mm}.sum b{display:block;font-size:6.5pt;letter-spacing:.06em;color:#6a7a84;text-transform:uppercase}.sum span{font-size:11pt;font-weight:800}
table{width:100%;border-collapse:collapse}thead{display:table-header-group}
th{font-size:6.8pt;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#4b5d68;text-align:left;padding:1.8mm 1.6mm;background:#eef4f6;border-bottom:.35mm solid #9fb3bd}
td{padding:1.6mm;border-bottom:.2mm solid #dde4e8;vertical-align:top}tbody tr:nth-child(even) td{background:#f8fafb}tr{break-inside:avoid}
.mono{font-family:Consolas,monospace;font-weight:700}.name{font-weight:700}.small{display:block;color:#6a7a84;font-size:7pt;font-weight:400}
.chip{display:inline-block;padding:.2mm 1.4mm;border-radius:.8mm;font-size:6.8pt;font-weight:800}
.r-SERVICE{background:#e7f0fb;color:#1f4f8a}.r-DAMAGED{background:#fff3df;color:#8a4b00}.r-LOST{background:#fde8e6;color:#b3261e}.r-RETIRED{background:#eef2f4;color:#4b5d68}
.yes{color:#1d7a4d;font-weight:800}.no{color:#b3261e;font-weight:800}
.num{text-align:right}.qty{text-align:center;font-weight:800;font-size:10pt}
.meta{display:grid;grid-template-columns:repeat(4,1fr);border:.25mm solid #d7e0e5;border-radius:2mm;margin-bottom:5mm}.meta div{padding:2mm 3mm;border-right:.25mm solid #e3e9ec}.meta div:last-child{border-right:0}.meta b{display:block;font-size:6.5pt;letter-spacing:.06em;color:#6a7a84;text-transform:uppercase;margin-bottom:.6mm}.meta span{font-weight:700;font-size:9pt}
.note{margin:4mm 0;padding:2.5mm 3mm;border:.25mm solid #d7e0e5;border-radius:1.5mm;font-size:8.5pt}
.signs{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm;margin-top:12mm;break-inside:avoid}.signs div{border-top:.3mm solid #8a9aa3;padding-top:1.5mm;font-size:7pt;color:#4b5d68}.signs b{display:block;font-size:7.5pt;color:#15232b;margin-bottom:5mm}
.footer{margin-top:5mm;padding-top:2mm;border-top:.2mm solid #d7e0e5;display:flex;justify-content:space-between;font-size:7pt;color:#6a7a84}
@media screen{html{background:#e9eef1}body{max-width:297mm;margin:0 auto;padding:11mm 10mm;background:#fff;min-height:210mm}}
`;

const page = (title: string, body: string) =>
  `<!doctype html><html lang="${getI18nLang()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${STYLE}</style></head><body>${body}</body></html>`;

const now = () => formatDateTime();

/** The list of instruments to replace, as filtered or selected on screen, for print or PDF. */
export function replacementListHtml(items: readonly ReplacementItem[], subtitle: string, hospital?: string) {
  const count = (reason: string) => items.filter(i => i.reason === reason).length;
  const status = (item: ReplacementItem) =>
    item.status === 'REPLACED'
      ? item.tool.replacedBy
        ? tr('Αντικαταστάθηκε από {0}', item.tool.replacedBy)
        : tr('Παραλήφθηκε με {0}', item.order?.number || '')
      : item.status === 'IN_ORDER'
        ? tr('Σε παραγγελία {0}', item.order?.number || '')
        : tr('Χρειάζεται αντικατάσταση');
  const rows = items
    .map(
      (item, index) => `<tr>
<td class="num">${index + 1}</td>
<td class="mono">${esc(item.tool.barcode)}</td>
<td class="name">${esc(item.tool.name)}<span class="small">${esc(item.tool.code || '—')}${item.tool.serialNumber ? ` · S/N ${esc(item.tool.serialNumber)}` : ''}</span></td>
<td>${esc(item.tool.manufacturer || '—')}</td>
<td>${item.set ? `<span class="mono">${esc(item.set.barcode)}</span><span class="small">${esc(item.set.name)}</span>` : '—'}</td>
<td>${esc(trData(item.department || '—'))}</td>
<td><span class="chip r-${item.reason}">${esc(tr(REASON_LABEL[item.reason]))}</span>${item.issueTypes.length ? `<span class="small">${esc(item.issueTypes.map(trData).join(' · '))}</span>` : ''}${item.issueNote ? `<span class="small">${esc(item.issueNote)}</span>` : ''}</td>
<td>${esc(item.since || '—')}</td>
<td>${item.stock.length ? `<span class="yes">${esc(tr('Ναι · {0}', item.stock.length))}</span>` : `<span class="no">${esc(tr('Όχι'))}</span>`}</td>
<td>${esc(status(item))}</td>
</tr>`,
    )
    .join('');
  return page(
    tr('Βλάβες & Αντικαταστάσεις'),
    `<div class="top"><div><div class="brand">SurgiTrack${hospital ? ` · ${esc(hospital)}` : ''}</div><div class="doc">${esc(tr('Λίστα εργαλείων προς αντικατάσταση'))}</div><h1>${esc(tr('Βλάβες & Αντικαταστάσεις'))}</h1><p>${esc(subtitle)}</p></div><div class="when">${esc(now())}</div></div>
<div class="sum">
<div><b>${esc(tr('Σύνολο'))}</b><span>${items.length}</span></div>
<div><b>Service</b><span>${count('SERVICE')}</span></div>
<div><b>${esc(tr('Βλάβη / φθορά'))}</b><span>${count('DAMAGED')}</span></div>
<div><b>${esc(tr('Απώλεια'))}</b><span>${count('LOST')}</span></div>
<div><b>${esc(tr('Εκτός χρήσης'))}</b><span>${count('RETIRED')}</span></div>
<div><b>${esc(tr('Υπάρχει στο απόθεμα'))}</b><span>${items.filter(i => i.stock.length).length}</span></div>
</div>
<table><thead><tr><th class="num">#</th><th>Barcode</th><th>${esc(tr('Εργαλείο / κωδικός'))}</th><th>${esc(tr('Κατασκευαστής'))}</th><th>${esc(tr('Σετ'))}</th><th>${esc(tr('Τμήμα'))}</th><th>${esc(tr('Αιτία'))}</th><th>${esc(tr('Από'))}</th><th>${esc(tr('Στο απόθεμα'))}</th><th>${esc(tr('Κατάσταση'))}</th></tr></thead>
<tbody>${rows || `<tr><td colspan="10">${esc(tr('Δεν υπάρχουν εγγραφές για τα επιλεγμένα φίλτρα.'))}</td></tr>`}</tbody></table>
<div class="footer"><span>SurgiTrack</span><span>${esc(tr('{0} εγγραφές', items.length))}</span></div>`,
  );
}

const ORDER_STATUS: Record<PurchaseOrder['status'], string> = {
  OPEN: 'Ανοιχτή',
  ORDERED: 'Παραγγέλθηκε',
  PARTIAL: 'Παραλήφθηκε μερικώς',
  RECEIVED: 'Παραλήφθηκε',
  CANCELLED: 'Ακυρώθηκε',
};
export const orderStatusLabel = (status: PurchaseOrder['status']) => tr(ORDER_STATUS[status]);

/** A purchase order form: what to buy, how many, and which instruments each line replaces. */
export function purchaseOrderHtml(order: PurchaseOrder, hospital?: string) {
  const total = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const rows = order.lines
    .map(
      (line, index) => `<tr>
<td class="num">${index + 1}</td>
<td class="mono">${esc(line.code || '—')}</td>
<td class="name">${esc(line.name)}</td>
<td>${esc(line.manufacturer || '—')}</td>
<td class="qty">${line.received ? `${line.received}/${line.quantity}` : line.quantity}</td>
<td>${esc(line.reason ? tr(line.reason) : '—')}</td>
<td class="mono" style="font-weight:400">${esc(line.barcodes.join(', ') || '—')}</td>
</tr>`,
    )
    .join('');
  return page(
    tr('Παραγγελία {0}', order.number),
    `<div class="top"><div><div class="brand">SurgiTrack${hospital ? ` · ${esc(hospital)}` : ''}</div><div class="doc">${esc(tr('Παραγγελία αγοράς εργαλείων'))}</div><h1>${esc(order.number)}</h1></div><div class="when">${esc(now())}</div></div>
<div class="meta">
<div><b>${esc(tr('Ημερομηνία'))}</b><span>${esc(order.createdAt)}</span></div>
<div><b>${esc(tr('Καταχώρησε'))}</b><span>${esc(order.createdByName)}</span></div>
<div><b>${esc(tr('Προμηθευτής'))}</b><span>${esc(order.supplier || '—')}</span></div>
<div><b>${esc(tr('Κατάσταση'))}</b><span>${esc(orderStatusLabel(order.status))}</span></div>
</div>
<table><thead><tr><th class="num">#</th><th>${esc(tr('Κωδικός'))}</th><th>${esc(tr('Εργαλείο'))}</th><th>${esc(tr('Κατασκευαστής'))}</th><th>${esc(tr('Ποσ.'))}</th><th>${esc(tr('Αιτία'))}</th><th>${esc(tr('Αντικαθιστά'))}</th></tr></thead>
<tbody>${rows}</tbody><tfoot><tr><td></td><td></td><td class="name">${esc(tr('Σύνολο'))}</td><td></td><td class="qty">${total}</td><td></td><td></td></tr></tfoot></table>
${order.note ? `<div class="note"><b>${esc(tr('Σημείωση'))}:</b> ${esc(order.note)}</div>` : ''}
<div class="signs"><div><b>${esc(tr('Συντάχθηκε'))}</b>${esc(tr('Ονοματεπώνυμο & υπογραφή'))}</div><div><b>${esc(tr('Έγκριση'))}</b>${esc(tr('Ονοματεπώνυμο & υπογραφή'))}</div><div><b>${esc(tr('Παραλαβή'))}</b>${esc(tr('Ημερομηνία & υπογραφή'))}</div></div>
<div class="footer"><span>SurgiTrack · ${esc(order.number)}</span><span>${esc(total === 1 ? tr('1 τεμάχιο') : tr('{0} τεμάχια', total))}</span></div>`,
  );
}
