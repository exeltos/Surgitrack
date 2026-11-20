import {useState} from 'react';
import {CheckCircle2} from 'lucide-react';
import AppButton from '../ui/AppButton';
import {useSurgi} from '../../store/SurgiStore';
import {tr, trData} from '../../i18n';
import type {Issue, Tool} from '../../types/domain';

type Outcome = 'IN_USE' | 'RETIRE';

/**
 * Closing a report means a decision: the instrument was checked and stays in use, or it is taken out of use
 * (retired, out of its Set). A Set's report, or an instrument in washing or a sterilizer, has only the first.
 */
export default function ResolveIssueDialog({
  issue,
  tool,
  onClose,
}: {
  issue: Issue;
  /** The instrument the report is about, when it is one. */
  tool?: Tool;
  onClose: () => void;
}) {
  const {resolveIssues, retireForWear} = useSurgi();
  const retirable = !!tool && tool.state !== 'IN_WASHING' && tool.state !== 'IN_STERILIZATION';
  const [outcome, setOutcome] = useState<Outcome>('IN_USE');
  const [note, setNote] = useState('');
  const confirm = () => {
    if (outcome === 'RETIRE' && tool && retirable) retireForWear(tool.id, note.trim());
    else
      resolveIssues(
        [issue.id],
        [
          tool?.wearCheck ? tr('Έλεγχος στις {0} χρήσεις', tool.uses || 0) : '',
          note.trim() || tr('Ελέγχθηκε · παραμένει σε χρήση'),
        ]
          .filter(Boolean)
          .join(' · '),
      );
    onClose();
  };
  return (
    <div
      className="modal-backdrop confirm-dialog-backdrop"
      onMouseDown={e => e.currentTarget === e.target && onClose()}
    >
      <div className="confirm-dialog resolve-issue-dialog" role="dialog" aria-modal="true">
        <header>
          <div className="confirm-icon">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h3>{tr('Επίλυση εκκρεμότητας;')}</h3>
            <p>
              {trData(issue.type)} · {issue.asset}
            </p>
          </div>
        </header>
        {tool && (
          <fieldset className="resolve-issue-outcomes">
            <legend>{tr('Τι αποφασίστηκε μετά τον έλεγχο;')}</legend>
            <label>
              <input type="radio" name="outcome" checked={outcome === 'IN_USE'} onChange={() => setOutcome('IN_USE')} />
              <span>
                <b>{tr('Ελέγχθηκε · σε χρήση')}</b>
                <small>{tr('Το εργαλείο συνεχίζει να χρησιμοποιείται.')}</small>
              </span>
            </label>
            <label className={retirable ? '' : 'disabled'}>
              <input
                type="radio"
                name="outcome"
                checked={outcome === 'RETIRE'}
                disabled={!retirable}
                onChange={() => setOutcome('RETIRE')}
              />
              <span>
                <b>{tr('Απόσυρση')}</b>
                <small>
                  {retirable
                    ? tr(
                        'Βγαίνει από τη χρήση{0}, με τις χρήσεις του ({1}). Μένει στο ιστορικό.',
                        tool.setId ? tr(' και από το Σετ του') : '',
                        tool.uses || 0,
                      )
                    : tr('Όχι όσο είναι σε πλύσιμο ή στον κλίβανο.')}
                </small>
              </span>
            </label>
          </fieldset>
        )}
        <label className="confirm-dialog-type">
          {outcome === 'RETIRE' ? tr('Τι βρέθηκε στον έλεγχο') : tr('Πώς επιλύθηκε (προαιρετικό)')}
          <textarea
            rows={2}
            value={note}
            placeholder={
              outcome === 'RETIRE' ? tr('π.χ. Δεν κόβει, φθαρμένη μόνωση') : tr('π.χ. Ακονίστηκε, κόβει κανονικά')
            }
            onChange={e => setNote(e.target.value)}
          />
        </label>
        <footer>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton variant={outcome === 'RETIRE' ? 'danger' : 'primary'} onClick={confirm}>
            {outcome === 'RETIRE' ? tr('Απόσυρση') : tr('Επίλυση')}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
