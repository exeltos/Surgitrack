import {useState} from 'react';
import {Send, ShieldCheck, X, MessageSquarePlus} from 'lucide-react';
import AppButton from '../ui/AppButton';
import {useSurgi} from '../../store/SurgiStore';
import type {AssetKind} from '../../types/domain';

export default function DepartmentDispatchModal({
  kind,
  id,
  barcode,
  name,
  onClose,
}: {
  kind: AssetKind;
  id: string;
  barcode: string;
  name: string;
  onClose: () => void;
}) {
  const {currentUser, sendToSterilization} = useSurgi();
  const [patientCode, setPatientCode] = useState('');
  const [note, setNote] = useState('');
  const send = () => {
    sendToSterilization(kind, id, patientCode.trim() || undefined, note.trim() || undefined);
    onClose();
  };
  return (
    <div
      className="modal-backdrop department-modal-backdrop"
      onMouseDown={e => e.currentTarget === e.target && onClose()}
    >
      <div className="asset-modal department-send-modal">
        <header>
          <div>
            <span className="eyebrow">ΗΛΕΚΤΡΟΝΙΚΗ ΠΡΟΩΘΗΣΗ</span>
            <h2>Αποστολή προς Αποστείρωση</h2>
            <p>
              {barcode} · {name}
            </p>
          </div>
          <button className="icon-button department-modal-close" onClick={onClose} aria-label="Κλείσιμο">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body department-send-body">
          <div className="department-send-route">
            <div>
              <span>Από</span>
              <strong>{currentUser.department}</strong>
            </div>
            <Send size={22} />
            <div>
              <span>Προς</span>
              <strong>Κεντρική Αποστείρωση</strong>
            </div>
          </div>
          <label className="department-patient-code">
            Κωδικός ασθενούς <small>προαιρετικός · μόνο για ιχνηλασιμότητα, όχι ονοματεπώνυμο</small>
            <input
              value={patientCode}
              onChange={e => setPatientCode(e.target.value)}
              placeholder="π.χ. PT-2026-00125"
            />
          </label>
          <div className="department-signature-card">
            <ShieldCheck size={21} />
            <div>
              <span>Αποστέλλει</span>
              <strong>{currentUser.name}</strong>
              <small>{currentUser.department} · η ενέργεια καταγράφεται αυτόματα στο ιστορικό</small>
            </div>
          </div>
          <label className="department-send-note">
            <span>
              <MessageSquarePlus size={16} />
              <strong>Παρατήρηση αποστολής</strong>
              <small>προαιρετική</small>
            </span>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Π.χ. ειδική παρατήρηση μεταφοράς ή κατάστασης…"
            />
          </label>
        </div>
        <footer>
          <AppButton onClick={onClose}>Ακύρωση</AppButton>
          <AppButton variant="primary" icon={<Send size={17} />} onClick={send}>
            Αποστολή προς Αποστείρωση
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
