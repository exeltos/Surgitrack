import {useState} from 'react';
import {Barcode, X} from 'lucide-react';
import AppButton from '../ui/AppButton';
import {useSurgi} from '../../store/SurgiStore';
import {tr} from '../../i18n';
import type {SetAsset, Tool} from '../../types/domain';

const REASONS = ['Φθαρμένη ετικέτα', 'Χαμένη ετικέτα', 'Διπλό barcode', 'Άλλο'];

/**
 * Issuing a new barcode for a Set or instrument. The next free number is assigned, the old barcode
 * stays on record (scanning an old label still finds the item) and the new label is printed.
 */
export default function NewBarcodeModal({
  kind,
  asset,
  onDone,
  onClose,
}: {
  kind: 'SET' | 'TOOL';
  asset: SetAsset | Tool;
  /** Called with the new barcode, e.g. to open the label print. */
  onDone: (barcode: string) => void;
  onClose: () => void;
}) {
  const {reissueBarcode, nextBarcode} = useSurgi();
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  const next = nextBarcode(kind);
  const ready = reason !== 'Άλλο' || note.trim().length > 0;
  const confirm = () => {
    if (!ready) return;
    const text = note.trim() ? `${reason} · ${note.trim()}` : reason;
    const barcode = reissueBarcode(kind, asset.id, text);
    if (barcode) onDone(barcode);
  };
  return (
    <div className="modal-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <div className="new-barcode-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <span className="eyebrow">{tr('ΝΕΟ BARCODE')}</span>
            <h2>{asset.name}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={tr('Κλείσιμο')}>
            <X size={18} />
          </button>
        </header>
        <div className="new-barcode-swap">
          <span>
            <small>{tr('Τωρινό')}</small>
            <b className="mono">{asset.barcode}</b>
          </span>
          <Barcode size={22} />
          <span className="new">
            <small>{tr('Νέο')}</small>
            <b className="mono">{next}</b>
          </span>
        </div>
        <p>
          {tr(
            'Το τωρινό barcode μένει στο ιστορικό: αν σαρωθεί παλιά ετικέτα, η εφαρμογή βρίσκει το ίδιο αντικείμενο και ειδοποιεί ότι αντικαταστάθηκε.',
          )}
        </p>
        <div className="new-barcode-reasons">
          <span>{tr('Αιτία')}</span>
          {REASONS.map(r => (
            <label key={r} className={reason === r ? 'active' : ''}>
              <input type="radio" checked={reason === r} onChange={() => setReason(r)} />
              {tr(r)}
            </label>
          ))}
        </div>
        <label className="asset-manage-note">
          <span>{reason === 'Άλλο' ? tr('Αιτιολογία (υποχρεωτική)') : tr('Σημείωση (προαιρετική)')}</span>
          <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} />
        </label>
        <footer>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton variant="primary" icon={<Barcode size={16} />} disabled={!ready} onClick={confirm}>
            {tr('Έκδοση και εκτύπωση')}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
