import {useState, type ReactNode} from 'react';
import {CheckCircle2, ShoppingCart, Trash2, Wrench} from 'lucide-react';
import AppButton from '../ui/AppButton';
import {useSurgi} from '../../store/SurgiStore';
import {useHasModule} from '../../data/cloud/modulesContext';
import {tr} from '../../i18n';
import type {Issue, Tool} from '../../types/domain';
import ReplaceToolModal from './ReplaceToolModal';
import {askDeleteIssue, type Ask} from './issueDialogs';
import ResolveIssueDialog from './ResolveIssueDialog';
import {inActiveProcess} from '../../core/replacements';

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
  const {deleteIssue, can, role} = useSurgi();
  const withReplacements = useHasModule('REPLACEMENTS');
  const [replacing, setReplacing] = useState(false);
  const [resolving, setResolving] = useState(false);
  if (issue.status !== 'OPEN' || !can('asset.composition.manage')) return null;
  // The instrument itself in washing, sterilization or on its way waits too, whatever page the report is on.
  const replaceLocked = locked || (!!replaceable && inActiveProcess(replaceable));
  return (
    <div className="asset-issue-actions">
      {/* A decision: checked and kept in use, or retired (an instrument only). */}
      <AppButton size="sm" icon={<CheckCircle2 size={14} />} onClick={() => setResolving(true)}>
        {tr('Επίλυση')}
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
      {resolving && <ResolveIssueDialog issue={issue} tool={replaceable} onClose={() => setResolving(false)} />}
      {replacing && replaceable && <ReplaceToolModal tool={replaceable} onClose={() => setReplacing(false)} />}
    </div>
  );
}

/** Deletes a report (a duplicate, a mistake) with a required reason; it goes to the recycle bin. */
function DeleteIssueButton({
  issue,
  ask,
  onDelete,
}: {
  issue: Issue;
  ask: Ask;
  onDelete: (id: string, reason: string) => void;
}) {
  return (
    <AppButton size="sm" icon={<Trash2 size={14} />} onClick={() => askDeleteIssue(issue, ask, onDelete)}>
      {tr('Διαγραφή')}
    </AppButton>
  );
}
