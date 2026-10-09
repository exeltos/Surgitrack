import type {RefusalReason, SyncNotice} from '../../data/cloud/useAppRecordSync';
import {tr} from '../../i18n';

const refusalReason = (reason: RefusalReason) =>
  reason === 'permission'
    ? tr('δεν έχετε δικαίωμα για αυτή την αλλαγή')
    : reason === 'invalid'
      ? tr('η βάση δεδομένων δεν δέχτηκε τα στοιχεία')
      : tr('ο διακομιστής την απέρριψε');

/** What the sync did by itself, in words (see onSyncNotice). */
export function syncNoticeMessage(notice: SyncNotice): {title: string; text: string} {
  if (notice.kind === 'barcode') {
    const title = tr('Barcode σε χρήση από άλλον σταθμό');
    const set = notice.collection === 'sets';
    if (notice.changes.length === 1) {
      const [{from, to}] = notice.changes;
      const text = set
        ? tr(
            'Το barcode {0} είχε ήδη δοθεί από άλλον σταθμό. Το νέο Σετ πήρε το {1} — τυπώστε ξανά την ετικέτα.',
            from,
            to,
          )
        : tr(
            'Το barcode {0} είχε ήδη δοθεί από άλλον σταθμό. Το νέο εργαλείο πήρε το {1} — τυπώστε ξανά την ετικέτα.',
            from,
            to,
          );
      return {title, text};
    }
    const from = notice.changes.map(change => change.from).join(', ');
    const to = notice.changes.map(change => change.to).join(', ');
    const text = set
      ? tr(
          'Τα barcodes {0} είχαν ήδη δοθεί από άλλον σταθμό. Τα νέα Σετ πήραν τα {1} — τυπώστε ξανά τις ετικέτες.',
          from,
          to,
        )
      : tr(
          'Τα barcodes {0} είχαν ήδη δοθεί από άλλον σταθμό. Τα νέα εργαλεία πήραν τα {1} — τυπώστε ξανά τις ετικέτες.',
          from,
          to,
        );
    return {title, text};
  }
  const lines = notice.records.map(record =>
    record.reverted
      ? tr(
          '{0}: η αλλαγή δεν αποθηκεύτηκε ({1}) και επανήλθε η αποθηκευμένη μορφή.',
          record.label,
          refusalReason(record.reason),
        )
      : tr(
          '{0}: δεν αποθηκεύτηκε ({1}) και αφαιρέθηκε από αυτή τη συσκευή.',
          record.label,
          refusalReason(record.reason),
        ),
  );
  const shown = lines.slice(0, 3);
  if (lines.length > shown.length) shown.push(tr('Και {0} ακόμη.', lines.length - shown.length));
  return {title: tr('Αλλαγή που δεν έγινε δεκτή'), text: shown.join(' ')};
}
