import StatusBadge from '../../../components/ui/StatusBadge';
import AssetTypeIcon from '../../../components/assets/AssetTypeIcon';
import {CheckCircle2, X, ShieldCheck, UserCheck} from 'lucide-react';
import {getI18nLang, tr, trData} from '../../../i18n';
import type {SterilizationPageState} from '../useSterilizationPage';
import ShelfLifePicker from './ShelfLifePicker';
import {formatDateTime} from '../../../core/displayDate';

export default function CheckpointModal({s}: {s: SterilizationPageState}) {
  const {
    checkpointChecks,
    checkpointDraft,
    checkpointNote,
    checkpointReady,
    checkpointStage,
    closeCheckpoint,
    currentUser,
    finishCheckpoint,
    setCheckpointChecks,
    setCheckpointNote,
  } = s;
  const en = getI18nLang() === 'en';
  return (
    <>
      {checkpointDraft && checkpointStage && (
        <div className="modal-backdrop" onMouseDown={closeCheckpoint}>
          <div
            className="receipt-card-modal workflow-modal workflow-checkpoint-modal"
            onMouseDown={e => e.stopPropagation()}
          >
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closeCheckpoint}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <AssetTypeIcon
                kind={checkpointDraft.draft.kind}
                maxUses={checkpointDraft.draft.kind === 'TOOL' ? checkpointDraft.draft.asset.maxUses : undefined}
                framed
                className="ster-kind"
                size={19}
              />
              <div className="workflow-modal-title">
                <span className="eyebrow">
                  {tr('ΕΛΕΓΧΟΣ ΠΟΙΟΤΗΤΑΣ')} · {(en ? checkpointStage.labelEn : checkpointStage.labelEl).toUpperCase()}
                </span>
                <h2>
                  {checkpointDraft.draft.asset.barcode} · {checkpointDraft.draft.asset.name}
                </h2>
                <p>{en ? checkpointStage.descriptionEn : checkpointStage.descriptionEl}</p>
              </div>
              <StatusBadge value={checkpointDraft.draft.asset.state} />
            </div>
            <div className="workflow-checkpoint-body">
              <div className="workflow-checkpoint-user">
                <UserCheck size={18} />
                <div>
                  <small>{tr('Καταγράφεται από')}</small>
                  <strong>{trData(currentUser.name)}</strong>
                  <span>
                    {trData(currentUser.department)} · {formatDateTime()}
                  </span>
                </div>
              </div>
              <section className="release-check-card">
                <div className="receipt-section-title">
                  <div>
                    <strong>{tr('Απαιτούμενοι έλεγχοι')}</strong>
                    <span>{tr('Όλοι οι ενεργοί έλεγχοι πρέπει να επιβεβαιωθούν για να προχωρήσει η ροή.')}</span>
                  </div>
                  <ShieldCheck size={18} />
                </div>
                {(en ? checkpointStage.checksEn : checkpointStage.checksEl).map((check, index) => (
                  <label className="release-check-row" key={check}>
                    <input
                      type="checkbox"
                      checked={checkpointChecks[index] || false}
                      onChange={e =>
                        setCheckpointChecks(list => list.map((value, i) => (i === index ? e.target.checked : value)))
                      }
                    />
                    <span>
                      <strong>{check}</strong>
                    </span>
                  </label>
                ))}
              </section>
              {checkpointDraft.stageId === 'PACKAGING' && (
                <ShelfLifePicker value={s.shelfLife} onChange={s.setShelfLife} />
              )}
              <label className="cycle-note">
                {tr('Παρατήρηση σταδίου')}
                <textarea
                  value={checkpointNote}
                  onChange={e => setCheckpointNote(e.target.value)}
                  placeholder={tr('Προαιρετική παρατήρηση ή αριθμός κύκλου / πλυντηρίου…')}
                />
              </label>
            </div>
            <div className="modal-actions workflow-modal-actions">
              <button onClick={closeCheckpoint}>{tr('Ακύρωση')}</button>
              <button className="primary" disabled={!checkpointReady} onClick={finishCheckpoint}>
                <CheckCircle2 size={16} /> {tr('Ολοκλήρωση · Επόμενο στάδιο')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
