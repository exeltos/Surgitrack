import {useState} from 'react';
import {ClipboardCheck, Gauge, Printer, Send, ShieldCheck, X, MessageSquarePlus} from 'lucide-react';
import {useLibraries} from '../../core/LibraryStore';
import {countsAtDepartment} from '../../core/surgicalCount';
import {sterilizedOnOf} from '../../core/sterileExpiry';
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
  const {
    currentUser,
    sendToSterilization,
    sets,
    tools,
    recordCount,
    preparations,
    sterilizationReleases,
    organizationName,
  } = useSurgi();
  const {systemSettings} = useLibraries();
  const [patientCode, setPatientCode] = useState('');
  const [note, setNote] = useState('');
  const [livesConfirmed, setLivesConfirmed] = useState(false);
  // Operating theatres count the instruments here; ticking them and sending is the signature.
  const asset = kind === 'SET' ? sets.find(x => x.id === id) : tools.find(x => x.id === id);
  const counting = countsAtDepartment(asset?.department, systemSettings.surgicalCountDepartments);
  const members = kind === 'SET' ? tools.filter(t => t.setId === id && t.state !== 'RETIRED') : asset ? [asset] : [];
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState(false);
  const [scan, setScan] = useState('');
  const [scanMessage, setScanMessage] = useState('');
  const counted = members.filter(t => ticked.has(t.id)).length;
  const missing = members.filter(t => !ticked.has(t.id));
  const toggle = (toolId: string) =>
    setTicked(current => {
      const next = new Set(current);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  const allPresent = () => {
    if (!window.confirm(tr('Επιβεβαιώνετε ότι καταμετρήθηκαν και τα {0} εργαλεία;', members.length))) return;
    setTicked(new Set(members.map(t => t.id)));
    setBulk(true);
  };
  const scanTool = () => {
    const code = scan.trim().toUpperCase();
    if (!code) return;
    const tool = members.find(t => t.barcode.toUpperCase() === code);
    if (!tool) setScanMessage(tr('Το {0} δεν ανήκει σε αυτό το Σετ.', code));
    else {
      setTicked(current => new Set(current).add(tool.id));
      setScanMessage(tr('{0} · καταμετρήθηκε', `${tool.barcode} ${tool.name}`));
    }
    setScan('');
  };
  const printForm = () =>
    asset &&
    printCountForm({
      asset,
      items: members,
      hospital: organizationName,
      preparation: preparations.find(r => r.assetId === id),
      release: sterilizationReleases.find(r => r.assetId === id && r.decision === 'RELEASED'),
      draft: {checkedToolIds: [...ticked], patientCode: patientCode.trim()},
    });
  // Limited-use (multi-use with lives) instruments lose one life on every dispatch after a procedure.
  const limitedTools =
    kind === 'TOOL' ? tools.filter(t => t.id === id && t.maxUses) : tools.filter(t => t.setId === id && t.maxUses);
  const limitedSet = kind === 'SET' && !!sets.find(s => s.id === id)?.maxUses;
  const consumesLives = limitedTools.length > 0 || limitedSet;
  const countReady = !counting || (patientCode.trim().length > 0 && counted > 0);
  const canSend = countReady && (!consumesLives || (patientCode.trim().length > 0 && livesConfirmed));
  const send = () => {
    if (!canSend) return;
    if (counting) {
      if (
        missing.length &&
        !window.confirm(tr('Λείπουν {0} εργαλεία. Υπογραφή της καταμέτρησης με έλλειψη;', missing.length))
      )
        return;
      recordCount({
        setId: id,
        assetKind: kind,
        patientCode: patientCode.trim(),
        expected: members.length,
        counted,
        result: missing.length ? 'MISSING' : 'OK',
        note: missing.length ? tr('Λείπουν: {0}', missing.map(t => `${t.barcode} ${t.name}`).join(', ')) : '',
        checkedToolIds: [...ticked],
        missing: missing.map(t => t.barcode),
        mode: bulk ? 'BULK' : 'ITEM',
        sterilizedOn: asset?.sterileUntil ? sterilizedOnOf(asset) : undefined,
        sterilizedTime: asset?.sterileUntil ? asset.sterilizedTime : undefined,
        sterileUntil: asset?.sterileUntil,
      });
    }
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
              {counting
                ? tr('υποχρεωτικός · καταμέτρηση χειρουργείου, όχι ονοματεπώνυμο')
                : consumesLives
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
            <div className="department-count-card">
              <div className="department-count-head">
                <ClipboardCheck size={18} />
                <strong>{tr('Καταμέτρηση εργαλείων')}</strong>
                <small>{tr('{0} από {1} καταμετρημένα', counted, members.length)}</small>
                {members.length > 1 && counted < members.length && (
                  <button type="button" className="department-count-all" onClick={allPresent}>
                    {tr('Όλα παρόντα')}
                  </button>
                )}
              </div>
              {kind === 'SET' && (
                <label className="department-count-scan">
                  <input
                    value={scan}
                    onChange={e => setScan(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        scanTool();
                      }
                    }}
                    placeholder={tr('Σάρωση barcode εργαλείου + Enter')}
                    aria-label={tr('Σάρωση εργαλείου')}
                  />
                  {scanMessage && <small>{scanMessage}</small>}
                </label>
              )}
              <div className="department-count-list">
                {members.map(t => (
                  <label key={t.id} className={ticked.has(t.id) ? 'on' : ''}>
                    <input type="checkbox" checked={ticked.has(t.id)} onChange={() => toggle(t.id)} />
                    <span className="mono">{t.barcode}</span>
                    <strong>{t.name}</strong>
                  </label>
                ))}
              </div>
              {counted > 0 && missing.length > 0 && (
                <p className="department-count-missing">
                  {tr('Λείπουν {0} εργαλεία. Θα δημιουργηθεί εκκρεμότητα.', missing.length)}
                </p>
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
          {counting && (
            <AppButton icon={<Printer size={16} />} onClick={printForm} className="department-count-print">
              {tr('Έντυπο καταμέτρησης')}
            </AppButton>
          )}
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton variant="primary" icon={<Send size={17} />} onClick={send} disabled={!canSend}>
            {counting ? tr('Υπογραφή & αποστολή') : tr('Αποστολή προς Αποστείρωση')}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
