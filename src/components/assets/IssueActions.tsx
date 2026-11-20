import {useState, type ReactNode} from 'react';
import {CheckCircle2, ShoppingCart, Trash2, Wrench} from 'lucide-react';
import AppButton from '../ui/AppButton';
import {useSurgi} from '../../store/SurgiStore';
import {useHasModule} from '../../data/cloud/modulesContext';
import {tr, trData} from '../../i18n';
import type {Issue, Tool} from '../../types/domain';
import ReplaceToolModal from './ReplaceToolModal';
import {inActiveProcess} from '../../core/replacements';

type Ask = (ask: {
  title: string;
  message: string;
  confirmLabel?: string;
  note?: {label: string; placeholder?: string; required?: boolean};
  onConfirm: (note: string) => void;
}) => void;

/**
 * What can be done about an open report, right under it on the item's «Εκκρεμότητες»: checked and kept in use (it
 * closes, with how), sent to Service or Stock (the item's «Διαχείριση», which closes the reports it settles), or
 * replaced (the instruments to replace, where a purchase is ordered).
 */
export default function IssueActions({
  issue,
  ask,
  onManage,
  replaceable,
  locked,
}: {
  issue: Issue;
  ask: Ask;
  onManage: () => void;
  /** The instrument of the report: it can be replaced, from Stock, another Set or a loose one. */
  replaceable?: Tool;
  /** In an active reprocessing: Service, Stock and composition wait for it, as the item's «Διαχείριση» does. */
  locked?: boolean;
}): ReactNode {
  const {resolveIssues, deleteIssue, can, role} = useSurgi();
  const withReplacements = useHasModule('REPLACEMENTS');
  const [replacing, setReplacing] = useState(false);
  if (issue.status !== 'OPEN' || !can('asset.composition.manage')) return null;
  // The instrument itself in washing, sterilization or on its way waits too, whatever page the report is on.
  const replaceLocked = locked || (!!replaceable && inActiveProcess(replaceable));
  return (
    <div className="asset-issue-actions">
      <AppButton
        size="sm"
        icon={<CheckCircle2 size={14} />}
        onClick={() =>
          ask({
            title: tr('Επίλυση εκκρεμότητας;'),
            message: tr('Η εκκρεμότητα «{0}» για {1} θα σημειωθεί ως επιλυμένη.', trData(issue.type), issue.asset),
            confirmLabel: tr('Επίλυση'),
            note: {label: tr('Πώς επιλύθηκε (προαιρετικό)'), placeholder: tr('π.χ. Ακονίστηκε, κόβει κανονικά')},
            onConfirm: how => resolveIssues([issue.id], how || tr('Ελέγχθηκε · παραμένει σε χρήση')),
          })
        }
      >
        {tr('Ελέγχθηκε · σε χρήση')}
      </AppButton>
      <AppButton
        size="sm"
        icon={<Wrench size={14} />}
        onClick={onManage}
        disabled={locked}
        title={
          locked ? tr('Η διαχείριση είναι κλειδωμένη όσο βρίσκεται σε ενεργή διαδικασία αποστείρωσης.') : undefined
        }
      >
        {tr('Service, Απόθεμα…')}
      </AppButton>
      {replaceable && withReplacements && can('stock.manage') && (
        <AppButton
          size="sm"
          icon={<ShoppingCart size={14} />}
          onClick={() => setReplacing(true)}
          disabled={replaceLocked}
          title={
            replaceLocked ? tr('Η αντικατάσταση περιμένει το τέλος της ενεργής διαδικασίας αποστείρωσης.') : undefined
          }
        >
          {tr('Αντικατάσταση')}
        </AppButton>
      )}
      {/* A report written twice or by mistake: only the hospital admin (or the owner acting as one) deletes it. */}
      {role === 'ADMIN' && <DeleteIssueButton issue={issue} ask={ask} onDelete={deleteIssue} />}
      {replacing && replaceable && <ReplaceToolModal tool={replaceable} onClose={() => setReplacing(false)} />}
    </div>
  );
}

/** Deletes a report (a duplicate, a mistake) with a required reason; it goes to the recycle bin. */
export function DeleteIssueButton({
  issue,
  ask,
  onDelete,
  compact,
}: {
  issue: Issue;
  ask: Ask;
  onDelete: (id: string, reason: string) => void;
  /** An icon alone, as in the rows of a list. */
  compact?: boolean;
}) {
  const open = () =>
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
  return compact ? (
    <button
      type="button"
      className="issue-action slot-delete"
      title={tr('Διαγραφή αναφοράς')}
      aria-label={tr('Διαγραφή αναφοράς')}
      onClick={open}
    >
      <Trash2 size={14} />
    </button>
  ) : (
    <AppButton size="sm" icon={<Trash2 size={14} />} onClick={open}>
      {tr('Διαγραφή')}
    </AppButton>
  );
}
