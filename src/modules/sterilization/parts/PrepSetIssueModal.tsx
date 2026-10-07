import {CheckCircle2, ArrowRight, X} from 'lucide-react';
import {tr, trData} from '../../../i18n';
import type {SterilizationPageState} from '../useSterilizationPage';

/** Handling an issue about the Set itself during Preparation: it was fixed, or the Set goes on as it is. */
export default function PrepSetIssueModal({s}: {s: SterilizationPageState}) {
  const {prepManageIssue, prepDraft, resolveIssues, setPrepKeptIssueIds, setPrepManageIssueId} = s;
  if (!prepManageIssue || prepDraft?.kind !== 'SET') return null;
  const close = () => setPrepManageIssueId(null);
  const resolve = () => {
    const note = window.prompt(tr('Τι διορθώθηκε; (καταγράφεται στο ιστορικό)'), '');
    if (!note?.trim()) return;
    resolveIssues([prepManageIssue.id], note.trim());
    close();
  };
  const keep = () => {
    setPrepKeptIssueIds(current => new Set(current).add(prepManageIssue.id));
    close();
  };
  return (
    <div className="nested-modal-backdrop" onMouseDown={close}>
      <div className="tool-issue-card prep-manage-card" onMouseDown={e => e.stopPropagation()}>
        <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={close}>
          <X size={17} />
        </button>
        <span className="eyebrow">{tr('ΕΚΚΡΕΜΟΤΗΤΑ ΣΕΤ')}</span>
        <h3>{trData(prepManageIssue.type)}</h3>
        <div className="prep-manage-summary">
          <span>
            {prepDraft.asset.barcode}
            {prepManageIssue.note ? ` · ${trData(prepManageIssue.note)}` : ''}
          </span>
        </div>
        <div className="prep-manage-grid">
          <button type="button" onClick={resolve}>
            <ArrowRight size={16} />
            <span>
              <b>{tr('Διορθώθηκε')}</b>
              <small>{tr('Κλείνει την εκκρεμότητα με σημείωση για το τι έγινε')}</small>
            </span>
          </button>
          <button type="button" className="prep-no-action-option" onClick={keep}>
            <CheckCircle2 size={16} />
            <span>
              <b>{tr('Παραμονή ως έχει')}</b>
              <small>{tr('Η εκκρεμότητα μένει ανοιχτή και η διαδικασία συνεχίζει')}</small>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
