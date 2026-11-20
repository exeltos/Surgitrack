import {tr, trData} from '../../i18n';
import type {Issue} from '../../types/domain';

export type Ask = (ask: {
  title: string;
  message: string;
  confirmLabel?: string;
  note?: {label: string; placeholder?: string; initial?: string; required?: boolean};
  onConfirm: (note: string) => void;
}) => void;

/** Asks why a report goes (a duplicate, a mistake); it goes to the recycle bin. The hospital admin only. */
export const askDeleteIssue = (issue: Issue, ask: Ask, onDelete: (id: string, reason: string) => void) =>
  ask({
    title: tr('Διαγραφή αναφοράς;'),
    message: tr(
      'Η αναφορά «{0}» για {1} θα πάει στον Κάδο, απ’ όπου μπορεί να επανέλθει.',
      trData(issue.type),
      issue.asset,
    ),
    confirmLabel: tr('Διαγραφή'),
    note: {label: tr('Αιτία διαγραφής'), placeholder: tr('π.χ. Διπλή αναφορά'), required: true},
    onConfirm: reason => onDelete(issue.id, reason),
  });

/** Corrects the text of a report (a typo in it or in how it was closed). The hospital admin only. */
export const askEditIssueNote = (issue: Issue, ask: Ask, onEdit: (id: string, note: string) => void) =>
  ask({
    title: tr('Διόρθωση σημείωσης'),
    message: tr('«{0}» για {1}. Η διόρθωση καταγράφεται με το όνομά σας.', trData(issue.type), issue.asset),
    confirmLabel: tr('Αποθήκευση'),
    note: {label: tr('Σημείωση'), initial: issue.note, required: true},
    onConfirm: note => onEdit(issue.id, note),
  });
