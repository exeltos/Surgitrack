import type {DeliveryRecord, ReceiptRecord} from '../../types/domain';
import {tr, trData} from '../../i18n';
import {escapeHtml as esc} from '../../core/escapeHtml';
import {printHospital} from '../../core/printStamp';
import {page} from '../replacements/replacementPrint';

export type HandoverKind = 'RECEIPT' | 'DELIVERY';

/** The records of one handover: the batch the record was part of (one signature for all), or the record alone. */
export const handoverKey = (record: {id: string; batchId?: string}) => record.batchId || record.id;

/**
 * A handover slip (A4): what passed between a department and Sterilization at once — the list, when, who handed
 * it over and who took it, with a line for each to sign. A receipt is a department's equipment received by
 * Sterilization; a delivery is the sterile equipment taken back by the department.
 */
export function handoverSlipHtml(kind: HandoverKind, records: ReadonlyArray<ReceiptRecord | DeliveryRecord>) {
  const first = records[0];
  const receipt = kind === 'RECEIPT';
  const title = receipt ? tr('Δελτίο παραλαβής') : tr('Δελτίο παράδοσης');
  const department = first
    ? trData('fromDepartment' in first ? first.fromDepartment : (first as DeliveryRecord).department)
    : '';
  const counted = (r: ReceiptRecord | DeliveryRecord) =>
    'expected' in r && r.expected ? `${r.actual ?? r.expected} / ${r.expected}` : '';
  const withCount = records.some(r => counted(r));
  const rows = records
    .map(
      (r, i) => `<tr>
<td class="num">${i + 1}</td>
<td class="mono">${esc(r.barcode)}</td>
<td class="name">${esc(r.assetName)}</td>
<td>${esc(r.assetKind === 'SET' ? tr('Σετ') : tr('Εργαλείο'))}</td>
${withCount ? `<td class="qty${'expected' in r && r.expected && (r.actual ?? r.expected) < r.expected ? ' no' : ''}">${esc(counted(r) || '—')}</td>` : ''}
<td>${esc(r.note || ('checkNote' in r && r.checkNote) || '')}</td>
</tr>`,
    )
    .join('');
  const verified = first?.counterpartyVerified;
  return page(
    title,
    `<div class="top"><div><div class="brand">${esc(printHospital())}</div><div class="doc">${esc(title)}</div><h1>${esc(
      receipt ? tr('{0} → Κεντρική Αποστείρωση', department) : tr('Κεντρική Αποστείρωση → {0}', department),
    )}</h1></div></div>
<div class="meta">
<div><b>${esc(tr('Ημερομηνία / ώρα'))}</b><span>${esc(first?.at || '')}</span></div>
<div><b>${esc(tr('Παρέδωσε'))}</b><span>${esc(first?.deliveredByName || '—')}</span></div>
<div><b>${esc(tr('Παρέλαβε'))}</b><span>${esc(first?.receivedByName || '—')}</span></div>
<div><b>${esc(tr('Αντικείμενα'))}</b><span>${records.length}</span></div>
</div>
<table><thead><tr><th class="num">#</th><th>Barcode</th><th>${esc(tr('Ονομασία'))}</th><th>${esc(tr('Τύπος'))}</th>${
      withCount ? `<th>${esc(tr('Εργαλεία'))}</th>` : ''
    }<th>${esc(tr('Παρατήρηση'))}</th></tr></thead><tbody>${rows}</tbody></table>
${
  verified === undefined
    ? ''
    : `<div class="note">${esc(
        verified
          ? tr('Το άλλο μέρος επιβεβαίωσε την παράδοση με τον δικό του κωδικό.')
          : tr('Η παράδοση δεν επιβεβαιώθηκε με κωδικό του άλλου μέρους.'),
      )}</div>`
}
<div class="signs"><div><b>${esc(tr('Παρέδωσε'))} · ${esc(first?.deliveredByName || '')}</b>${esc(
      tr('Υπογραφή'),
    )}</div><div><b>${esc(tr('Παρέλαβε'))} · ${esc(first?.receivedByName || '')}</b>${esc(tr('Υπογραφή'))}</div><div><b>${esc(
      tr('Ώρα'),
    )}</b>&nbsp;</div></div>`,
  );
}
