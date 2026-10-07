import {useState} from 'react';
import {CheckCircle2, ClipboardCheck, Gauge, Printer, Send, ShieldCheck, X, MessageSquarePlus} from 'lucide-react';
import {useLibraries} from '../../core/LibraryStore';
import {countsAtDepartment} from '../../core/surgicalCount';
import type {SurgicalCount} from '../../store/types';
import CountModal from './CountModal';
import {printCountForm} from './printCountForm';
import AppButton from '../ui/AppButton';
import {useSurgi} from '../../store/SurgiStore';
import type {AssetKind} from '../../types/domain';
import {tr, trData} from '../../i18n';

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
  const {currentUser, sendToSterilization, sets, tools, preparations, sterilizationReleases, organizationName} =
    useSurgi();
  const {systemSettings} = useLibraries();
  const [patientCode, setPatientCode] = useState('');
  const [note, setNote] = useState('');
  const [livesConfirmed, setLivesConfirmed] = useState(false);
  // Operating theatres sign the instrument count (its own window) before the Set can be sent.
  const asset = kind === 'SET' ? sets.find(x => x.id === id) : tools.find(x => x.id === id);
  const counting = countsAtDepartment(asset?.department, systemSettings.surgicalCountDepartments);
  const [countOpen, setCountOpen] = useState(false);
  const [count, setCount] = useState<SurgicalCount | null>(null);
  const printSigned = () =>
    asset &&
    count &&
    printCountForm({
      asset,
      items: kind === 'SET' ? tools.filter(t => t.setId === id && t.state !== 'RETIRED') : [asset],
      hospital: organizationName,
      preparation: preparations.find(r => r.assetId === id),
      release: sterilizationReleases.find(r => r.assetId === id && r.decision === 'RELEASED'),
      count,
    });
  // Limited-use (multi-use with lives) instruments lose one life on every dispatch after a procedure.
  const limitedTools =
    kind === 'TOOL' ? tools.filter(t => t.id === id && t.maxUses) : tools.filter(t => t.setId === id && t.maxUses);
  const limitedSet = kind === 'SET' && !!sets.find(s => s.id === id)?.maxUses;
  const consumesLives = limitedTools.length > 0 || limitedSet;
  const canSend = (!counting || !!count) && (!consumesLives || (patientCode.trim().length > 0 && livesConfirmed));
  const send = () => {
    if (!canSend) return;
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
            <span className="eyebrow">{tr('ΗΛΕΚΤΡΟΝΙΚΗ ΠΡΟΩΘΗΣΗ')}</span>
            <h2>{tr('Αποστολή προς Αποστείρωση')}</h2>
            <p>
              {barcode} · {name}
            </p>
          </div>
          <button className="icon-button department-modal-close" onClick={onClose} aria-label={tr('Κλείσιμο')}>
            <X size={18} />
          </button>
        </header>
        <div className="modal-body department-send-body">
          <div className="department-send-route">
            <div>
              <span>{tr('Από')}</span>
              <strong>{trData(currentUser.department)}</strong>
            </div>
            <Send size={22} />
            <div>
              <span>{tr('Προς')}</span>
              <strong>{tr('Κεντρική Αποστείρωση')}</strong>
            </div>
          </div>
          <label className="department-patient-code">
            {tr('Κωδικός ασθενούς') + ' '}
            <small>
              {consumesLives
                ? tr('υποχρεωτικός · εργαλείο περιορισμένων χρήσεων, όχι ονοματεπώνυμο')
                : tr('προαιρετικός · μόνο για ιχνηλασιμότητα, όχι ονοματεπώνυμο')}
            </small>
            <input
              value={patientCode}
              onChange={e => setPatientCode(e.target.value)}
              placeholder={tr('π.χ. PT-2026-00125')}
            />
          </label>
          {counting && (
            <div className={`department-count-step ${count ? 'signed' : ''}`}>
              {count ? <CheckCircle2 size={20} /> : <ClipboardCheck size={20} />}
              <div>
                <strong>{tr('Καταμέτρηση εργαλείων')}</strong>
                <small>
                  {count
                    ? tr('Υπογεγραμμένη · {0} από {1} · {2} {3}', count.counted, count.expected, count.by, count.at)
                    : tr('Απαιτείται πριν την αποστολή · χειρουργείο')}
                </small>
                {count?.missing?.length ? (
                  <small className="missing">{tr('Λείπουν: {0}', count.missing.join(', '))}</small>
                ) : null}
              </div>
              {count ? (
                <AppButton icon={<Printer size={15} />} onClick={printSigned}>
                  {tr('Έντυπο')}
                </AppButton>
              ) : (
                <AppButton variant="primary" icon={<ClipboardCheck size={15} />} onClick={() => setCountOpen(true)}>
                  {tr('Καταμέτρηση')}
                </AppButton>
              )}
            </div>
          )}
          {consumesLives && (
            <div className="department-lives-card">
              <div className="department-lives-head">
                <Gauge size={18} />
                <strong>{tr('Καταγραφή χρήσης')}</strong>
                <small>{tr('Υπόλοιπο χρήσεων')}</small>
              </div>
              <ul>
                {limitedTools.map(t => {
                  const remaining = Math.max(0, (t.maxUses || 0) - t.uses);
                  return (
                    <li key={t.id} className={remaining <= 1 ? 'last-life' : ''}>
                      <span>
                        {t.barcode} · {t.name}
                      </span>
                      <b>
                        {remaining} → {Math.max(0, remaining - 1)}
                      </b>
                      {remaining <= 1 && <small>{tr('Τελευταία χρήση · θα τεθεί εκτός χρήσης')}</small>}
                    </li>
                  );
                })}
              </ul>
              <label className="department-lives-confirm">
                <input type="checkbox" checked={livesConfirmed} onChange={e => setLivesConfirmed(e.target.checked)} />
                {tr('Επιβεβαιώνω ότι χρησιμοποιήθηκε (καταγράφεται μία χρήση)')}
              </label>
            </div>
          )}
          <div className="department-signature-card">
            <ShieldCheck size={21} />
            <div>
              <span>{tr('Αποστέλλει')}</span>
              <strong>{currentUser.name}</strong>
              <small>
                {trData(currentUser.department)} {tr('· η ενέργεια καταγράφεται αυτόματα στο ιστορικό')}
              </small>
            </div>
          </div>
          <label className="department-send-note">
            <span>
              <MessageSquarePlus size={16} />
              <strong>{tr('Παρατήρηση αποστολής')}</strong>
              <small>{tr('προαιρετική')}</small>
            </span>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={tr('Π.χ. ειδική παρατήρηση μεταφοράς ή κατάστασης…')}
            />
          </label>
        </div>
        <footer>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton variant="primary" icon={<Send size={17} />} onClick={send} disabled={!canSend}>
            {tr('Αποστολή προς Αποστείρωση')}
          </AppButton>
        </footer>
      </div>
      {countOpen && (
        <CountModal
          kind={kind}
          id={id}
          patientCode={patientCode}
          onClose={() => setCountOpen(false)}
          onSigned={signed => {
            setCount(signed);
            setPatientCode(signed.patientCode);
            setCountOpen(false);
          }}
        />
      )}
    </div>
  );
}
