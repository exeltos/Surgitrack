import {useState, type ReactNode} from 'react';
import {CheckCircle2, ShoppingCart, Wrench} from 'lucide-react';
import AppButton from '../ui/AppButton';
import {useSurgi} from '../../store/SurgiStore';
import {useHasModule} from '../../data/cloud/modulesContext';
import {tr, trData} from '../../i18n';
import type {Issue, Tool} from '../../types/domain';
import ReplaceToolModal from './ReplaceToolModal';

type Ask = (ask: {
  title: string;
  message: string;
  confirmLabel?: string;
  note?: {label: string; placeholder?: string};
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
  const {resolveIssues, can} = useSurgi();
  const withReplacements = useHasModule('REPLACEMENTS');
  const [replacing, setReplacing] = useState(false);
  if (issue.status !== 'OPEN' || !can('asset.composition.manage')) return null;
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
          disabled={locked}
          title={locked ? tr('Η αντικατάσταση περιμένει το τέλος της ενεργής διαδικασίας αποστείρωσης.') : undefined}
        >
          {tr('Αντικατάσταση')}
        </AppButton>
      )}
      {replacing && replaceable && <ReplaceToolModal tool={replaceable} onClose={() => setReplacing(false)} />}
    </div>
  );
}
