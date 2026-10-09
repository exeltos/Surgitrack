import {useState} from 'react';
import {CheckCircle2, X} from 'lucide-react';
import StarRating from './StarRating';
import type {FinalAnswers} from '../../core/demoFeedback';
import {saveFinalEvaluation, type FeedbackRow} from '../../data/cloud/demoFeedback';

/** The prospect's final evaluation of SurgiTrack (they can change it until the Demo ends). */
export default function FinalEvaluationDialog({
  organizationId,
  userId,
  current,
  L,
  onClose,
  onSaved,
}: {
  organizationId: string;
  userId: string;
  current?: FeedbackRow;
  L: (el: string, en: string) => string;
  onClose: () => void;
  onSaved: (row: FeedbackRow) => void;
}) {
  const [answers, setAnswers] = useState<FinalAnswers>(current?.answers || {});
  const [nps, setNps] = useState<number | null>(current?.nps ?? null);
  const [comment, setComment] = useState(current?.comment || '');
  const [state, setState] = useState<'form' | 'saving' | 'saved' | 'error'>('form');
  const set = (patch: Partial<FinalAnswers>) => setAnswers(a => ({...a, ...patch}));
  const ready = nps !== null && !!answers.ease && !!answers.fit;
  const save = async () => {
    if (nps === null) return;
    setState('saving');
    try {
      await saveFinalEvaluation(organizationId, userId, {nps, answers, comment: comment.trim()});
      onSaved({topic: 'final', rating: null, nps, answers, comment: comment.trim() || null});
      setState('saved');
    } catch {
      setState('error');
    }
  };
  const count = (value: string) =>
    value === '' ? undefined : Math.max(0, Math.min(100000, Math.round(Number(value))));
  return (
    <div className="modal-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <div className="demo-dialog wide" role="dialog" aria-modal="true" aria-label={L('Αξιολόγηση', 'Evaluation')}>
        <header>
          <h3>{L('Η αξιολόγησή σας', 'Your evaluation')}</h3>
          <button type="button" onClick={onClose} aria-label={L('Κλείσιμο', 'Close')}>
            <X size={18} />
          </button>
        </header>
        {state === 'saved' ? (
          <div className="demo-dialog-done">
            <CheckCircle2 size={28} />
            <p>{L('Ευχαριστούμε πολύ για την αξιολόγηση!', 'Thank you very much for your evaluation!')}</p>
            <button type="button" className="demo-dialog-primary" onClick={onClose}>
              {L('Κλείσιμο', 'Close')}
            </button>
          </div>
        ) : (
          <>
            <div className="demo-dialog-row">
              <span>{L('Πόσο εύκολο είναι στη χρήση;', 'How easy is it to use?')}</span>
              <StarRating
                label={L('Ευκολία χρήσης', 'Ease of use')}
                value={answers.ease}
                onChange={ease => set({ease})}
              />
            </div>
            <div className="demo-dialog-row">
              <span>{L('Πόσο ταιριάζει στο νοσοκομείο σας;', 'How well does it fit your hospital?')}</span>
              <StarRating label={L('Καταλληλότητα', 'Fit')} value={answers.fit} onChange={fit => set({fit})} />
            </div>
            <div className="demo-dialog-nps">
              <span>
                {L(
                  'Πόσο πιθανό είναι να προτείνατε το SurgiTrack σε συνάδελφο; (0–10)',
                  'How likely are you to recommend SurgiTrack to a colleague? (0–10)',
                )}
              </span>
              <div role="radiogroup" aria-label="NPS">
                {Array.from({length: 11}, (_, n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={nps === n}
                    className={nps === n ? 'on' : ''}
                    onClick={() => setNps(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <label>
              {L('Τι λείπει ή τι θα θέλατε διαφορετικό;', 'What is missing, or what would you change?')}
              <textarea
                rows={3}
                maxLength={2000}
                value={answers.missing || ''}
                onChange={e => set({missing: e.target.value})}
              />
            </label>
            <div className="demo-dialog-pair">
              <label>
                {L('Περίπου πόσα Σετ έχει το νοσοκομείο;', 'About how many Sets does the hospital have?')}
                <input
                  type="number"
                  min={0}
                  value={answers.sets ?? ''}
                  onChange={e => set({sets: count(e.target.value)})}
                />
              </label>
              <label>
                {L('Χειρουργικές αίθουσες', 'Operating theatres')}
                <input
                  type="number"
                  min={0}
                  value={answers.theatres ?? ''}
                  onChange={e => set({theatres: count(e.target.value)})}
                />
              </label>
            </div>
            <label>
              {L('Άλλα σχόλια', 'Other comments')}
              <textarea rows={2} maxLength={2000} value={comment} onChange={e => setComment(e.target.value)} />
            </label>
            {state === 'error' && (
              <p className="demo-dialog-error">
                {L('Δεν αποθηκεύτηκε. Δοκιμάστε ξανά.', 'It was not saved. Try again.')}
              </p>
            )}
            <footer>
              <button type="button" onClick={onClose}>
                {L('Ακύρωση', 'Cancel')}
              </button>
              <button
                type="button"
                className="demo-dialog-primary"
                disabled={!ready || state === 'saving'}
                onClick={() => void save()}
              >
                {state === 'saving' ? L('Αποθήκευση…', 'Saving…') : L('Αποστολή αξιολόγησης', 'Send evaluation')}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
