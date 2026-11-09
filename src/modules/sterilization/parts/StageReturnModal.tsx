import {useState} from 'react';
import {Undo2, X} from 'lucide-react';
import {useSurgi} from '../../../store/SurgiStore';
import {returnRefusalText} from '../../../core/stageReturn';
import type {WorkflowStageId} from '../../../core/workflow';
import type {AssetKind} from '../../../types/domain';
import {tr, trData} from '../../../i18n';

/**
 * «Επιστροφή σε προηγούμενο στάδιο»: the owner, the hospital admin and the Sterilization supervisor put an
 * item back to an earlier stage (put through a stage by mistake, or received on the wrong tablet), with a reason.
 */
export default function StageReturnModal({
  asset,
  onClose,
}: {
  asset: {kind: AssetKind; id: string; barcode: string; name: string};
  onClose: () => void;
}) {
  const {stageReturnInfo, returnToStage} = useSurgi();
  const info = stageReturnInfo(asset.kind, asset.id);
  const [stage, setStage] = useState<WorkflowStageId | ''>(info?.targets[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const refusal = info?.refusal ? tr(returnRefusalText(info.refusal)) : '';
  const ready = !!info && !info.refusal && !!stage && !!reason.trim();
  return (
    <div
      className="modal-backdrop confirm-dialog-backdrop"
      onMouseDown={e => e.currentTarget === e.target && onClose()}
    >
      <div className="confirm-dialog" role="dialog" aria-modal="true">
        <header>
          <div className="confirm-icon">
            <Undo2 size={20} />
          </div>
          <div>
            <h3>{tr('Επιστροφή σε προηγούμενο στάδιο')}</h3>
            <p>
              {asset.barcode} · {trData(asset.name)}.{' '}
              {tr('Η κίνηση καταγράφεται στο ιστορικό με την αιτιολογία και μπορεί να αναιρεθεί.')}
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={tr('Κλείσιμο')}>
            <X size={18} />
          </button>
        </header>
        {refusal && <div className="identity-error">{refusal}</div>}
        <label className="confirm-dialog-type">
          {tr('Επιστροφή στο στάδιο')}
          <select value={stage} onChange={e => setStage(e.target.value as WorkflowStageId)} disabled={!!refusal}>
            {info?.targets.map(t => (
              <option key={t.id} value={t.id}>
                {trData(t.label)}
              </option>
            ))}
          </select>
        </label>
        <label className="confirm-dialog-type">
          {tr('Αιτιολογία')}
          <textarea
            autoFocus
            rows={2}
            value={reason}
            placeholder={tr('π.χ. λάθος σάρωση, άλλο tablet')}
            onChange={e => setReason(e.target.value)}
          />
        </label>
        <footer>
          <button onClick={onClose}>{tr('Ακύρωση')}</button>
          <button
            className="primary"
            disabled={!ready}
            onClick={() => {
              if (stage && returnToStage(asset.kind, asset.id, stage, reason)) onClose();
            }}
          >
            {tr('Επιστροφή')}
          </button>
        </footer>
      </div>
    </div>
  );
}
