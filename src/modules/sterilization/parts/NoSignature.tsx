import {Send} from 'lucide-react';
import {tr, trData} from '../../../i18n';

/**
 * In place of the signature, for a department the hospital set without the check at this stage: nothing to sign;
 * at receipt, who sent it electronically (when one item), at delivery, the department it goes to.
 */
export default function NoSignature({
  at,
  department,
  sender,
}: {
  at: 'RECEIPT' | 'DELIVERY';
  department: string;
  sender?: {by: string; at: string};
}) {
  return (
    <div className="no-signature">
      <Send size={16} aria-hidden="true" />
      <div>
        <strong>
          {at === 'RECEIPT'
            ? sender
              ? tr('Ηλεκτρονική αποστολή: {0}', trData(sender.by))
              : tr('Ηλεκτρονική αποστολή από {0}', trData(department))
            : tr('Παράδοση στο {0}', trData(department))}
        </strong>
        <span>
          {[
            at === 'RECEIPT' && sender ? `${trData(department)} · ${sender.at}` : '',
            tr('Χωρίς υπογραφή · τμήμα χωρίς έλεγχο'),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
    </div>
  );
}
