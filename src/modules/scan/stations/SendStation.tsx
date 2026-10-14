import {useState} from 'react';
import {CheckCheck, ClipboardCheck, Gauge, Send} from 'lucide-react';
import AssetTypeIcon from '../../../components/assets/AssetTypeIcon';
import type {BarcodeFeedback} from '../../../components/barcode/BarcodeCapture';
import {askConfirm} from '../../../components/ui/confirmService';
import {useLibraries} from '../../../core/LibraryStore';
import {sterilizedOnOf} from '../../../core/sterileExpiry';
import {countsAtDepartment} from '../../../core/surgicalCount';
import {tr, trData} from '../../../i18n';
import {useSurgi} from '../../../store/SurgiStore';
import {departmentOf, findScanned, type Scanned} from '../findScanned';
import ScanCamera from '../ScanCamera';
import {ScanDone, ScanRefused, ScanScreen} from '../ScanParts';
import {useScanAnswers} from '../useScanAnswers';

/**
 * Send to Sterilization from the department, as «Αποστολή προς Αποστείρωση» on the Set's page: scan the Set or
 * instrument, the patient code, the use of limited-use instruments, and in the departments that count (the
 * operating theatre), the instrument count, ticked one by one or scanned, signed with the sending.
 */
export default function SendStation({onStations}: {onStations: () => void}) {
  const {sets, tools, role, currentUser, sendToSterilization, recordCount, circulationAllowed} = useSurgi();
  const {systemSettings} = useLibraries();
  const [found, setFound] = useState<Scanned | null>(null);
  const [feedback, setFeedback] = useState<BarcodeFeedback | null>(null);
  const [countFeedback, setCountFeedback] = useState<BarcodeFeedback | null>(null);
  const [sent, setSent] = useState<Scanned | null>(null);
  const [patientCode, setPatientCode] = useState('');
  const [note, setNote] = useState('');
  const [livesConfirmed, setLivesConfirmed] = useState(false);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState(false);
  const answers = useScanAnswers(feedback);
  useScanAnswers(countFeedback);

  const refuse = (message: string) => setFeedback({type: 'ERROR', message});
  const scan = (barcode: string) => {
    const item = findScanned(barcode, sets, tools);
    if (!item) return refuse(tr('{0} δεν βρέθηκε στο μητρώο.', barcode));
    const label = `${item.asset.barcode} · ${item.asset.name}`;
    if (role === 'DEPARTMENT' && departmentOf(item, sets) !== currentUser.department)
      return refuse(tr('{0}: ανήκει σε άλλο τμήμα.', label));
    if (item.kind === 'TOOL' && item.asset.setId) {
      const parent = sets.find(set => set.id === item.asset.setId);
      return refuse(tr('{0}: ανήκει στο Σετ {1} · σκανάρετε το Σετ.', label, parent?.barcode || ''));
    }
    if (item.asset.state !== 'IN_DEPARTMENT') return refuse(tr('{0}: δεν βρίσκεται στο τμήμα.', label));
    setFeedback({type: 'OK', message: label});
    setPatientCode('');
    setNote('');
    setLivesConfirmed(false);
    setTicked(new Set());
    setBulk(false);
    setFound(item);
  };

  if (sent)
    return (
      <ScanScreen title={tr('Αποστολή')} backLabel={tr('Αρχική')} onBack={onStations}>
        <ScanDone
          title={tr('Εστάλη στην Αποστείρωση')}
          text={`${sent.asset.barcode} · ${sent.asset.name}`}
          again={tr('Νέα αποστολή')}
          onAgain={() => {
            setSent(null);
            answers.reset();
          }}
          onStations={onStations}
        />
      </ScanScreen>
    );

  if (!found)
    return (
      <ScanScreen
        title={tr('Αποστολή')}
        subtitle={tr('Σκανάρετε το Σετ ή το εργαλείο που φεύγει για την Αποστείρωση.')}
        backLabel={tr('Αρχική')}
        onBack={onStations}
      >
        <ScanCamera onBarcode={scan} feedback={feedback} />
        <ScanRefused messages={answers.refused} />
      </ScanScreen>
    );

  const {kind, asset} = found;
  const counting = countsAtDepartment(departmentOf(found, sets), systemSettings.surgicalCountDepartments);
  const members = kind === 'SET' ? tools.filter(t => t.setId === asset.id && t.state !== 'RETIRED') : [found.asset];
  const missing = members.filter(t => !ticked.has(t.id));
  const counted = members.length - missing.length;
  // Limited-use instruments lose one use on every dispatch after a procedure.
  const limited = kind === 'TOOL' ? (found.asset.maxUses ? [found.asset] : []) : members.filter(t => t.maxUses);
  const consumesLives = limited.length > 0 || (kind === 'SET' && !!found.asset.maxUses);
  const needsPatient = counting || consumesLives;
  const ready =
    (!needsPatient || patientCode.trim().length > 0) &&
    (!consumesLives || livesConfirmed) &&
    (!counting || counted > 0);

  const tick = (id: string) =>
    setTicked(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const countScan = (barcode: string) => {
    const code = barcode.trim().toUpperCase();
    const tool = members.find(t => t.barcode.toUpperCase() === code);
    if (!tool) {
      setCountFeedback({type: 'ERROR', message: tr('Το {0} δεν ανήκει σε αυτό το Σετ.', code)});
      return;
    }
    setTicked(current => new Set(current).add(tool.id));
    setCountFeedback({type: 'OK', message: tr('{0} · καταμετρήθηκε', `${tool.barcode} ${tool.name}`)});
  };
  const allPresent = async () => {
    const sure = await askConfirm({
      title: tr('Πλήρης καταμέτρηση'),
      message: tr('Επιβεβαιώνετε ότι καταμετρήθηκαν και τα {0} εργαλεία;', members.length),
    });
    if (sure === false) return;
    setTicked(new Set(members.map(t => t.id)));
    setBulk(true);
  };
  const send = async () => {
    // Refused before anything is recorded (used up, recalled): the count is not signed for nothing.
    if (!ready || !circulationAllowed(kind, asset.id)) return;
    if (counting) {
      if (
        missing.length &&
        (await askConfirm({
          title: tr('Υπογραφή με έλλειψη'),
          message: tr('Λείπουν {0} εργαλεία. Υπογραφή της καταμέτρησης με έλλειψη;', missing.length),
          confirmLabel: tr('Υπογραφή & ολοκλήρωση'),
          danger: true,
        })) === false
      )
        return;
      const count = recordCount({
        setId: asset.id,
        assetKind: kind,
        patientCode: patientCode.trim(),
        expected: members.length,
        counted,
        result: missing.length ? 'MISSING' : 'OK',
        note: missing.length ? tr('Λείπουν: {0}', missing.map(t => `${t.barcode} ${t.name}`).join(', ')) : '',
        checkedToolIds: [...ticked],
        missing: missing.map(t => t.barcode),
        mode: bulk ? 'BULK' : 'ITEM',
        sterilizedOn: asset.sterileUntil ? sterilizedOnOf(asset) : undefined,
        sterilizedTime: asset.sterileUntil ? asset.sterilizedTime : undefined,
        sterileUntil: asset.sterileUntil,
      });
      if (!count) return;
    }
    if (!sendToSterilization(kind, asset.id, patientCode.trim() || undefined, note.trim() || undefined)) return;
    setSent(found);
    setFound(null);
  };

  return (
    <ScanScreen
      title={tr('Αποστολή προς Αποστείρωση')}
      subtitle={`${asset.barcode} · ${asset.name}`}
      backLabel={tr('Σάρωση')}
      onBack={() => setFound(null)}
      footer={
        <button type="button" className="scan-primary" disabled={!ready} onClick={() => void send()}>
          <Send size={18} /> {counting ? tr('Υπογραφή & αποστολή') : tr('Αποστολή')}
        </button>
      }
    >
      <dl className="scan-summary">
        <div>
          <dt>{tr('Από')}</dt>
          <dd>{trData(departmentOf(found, sets)) || tr('Χωρίς τμήμα')}</dd>
        </div>
        <div>
          <dt>{tr('Προς')}</dt>
          <dd>{tr('Κεντρική Αποστείρωση')}</dd>
        </div>
        <div>
          <dt>{tr('Αποστέλλει')}</dt>
          <dd>{trData(currentUser.name)}</dd>
        </div>
      </dl>
      <label className="scan-field">
        {needsPatient ? tr('Κωδικός ασθενούς · υποχρεωτικός') : tr('Κωδικός ασθενούς · προαιρετικός')}
        <input
          value={patientCode}
          onChange={e => setPatientCode(e.target.value)}
          placeholder={tr('π.χ. PT-2026-00125')}
          autoComplete="off"
        />
      </label>
      {counting && (
        <section className="scan-count-form" aria-label={tr('Καταμέτρηση εργαλείων')}>
          <h2 className="scan-section">
            <ClipboardCheck size={17} /> {tr('Καταμέτρηση εργαλείων')}
            <span>
              {counted} / {members.length}
            </span>
          </h2>
          {kind === 'SET' && <ScanCamera onBarcode={countScan} feedback={countFeedback} />}
          {members.length > 1 && (
            <button
              type="button"
              className="scan-secondary"
              disabled={counted === members.length}
              onClick={() => void allPresent()}
            >
              <CheckCheck size={17} /> {tr('Όλα παρόντα')}
            </button>
          )}
          <div className="scan-checks">
            {members.map(tool => (
              <label key={tool.id} className={ticked.has(tool.id) ? 'on' : ''}>
                <input type="checkbox" checked={ticked.has(tool.id)} onChange={() => tick(tool.id)} />
                <span>
                  <b>{tool.name}</b>
                  <small className="mono">{tool.barcode}</small>
                </span>
              </label>
            ))}
          </div>
          {counted > 0 && missing.length > 0 && (
            <p className="scan-form-alert">{tr('Λείπουν: {0}', missing.map(t => t.barcode).join(', '))}</p>
          )}
        </section>
      )}
      {consumesLives && (
        <section className="scan-sign" aria-label={tr('Καταγραφή χρήσης')}>
          <h2 className="scan-section">
            <Gauge size={17} /> {tr('Καταγραφή χρήσης')}
          </h2>
          <ul className="scan-items">
            {limited.map(tool => {
              const remaining = Math.max(0, (tool.maxUses || 0) - tool.uses);
              return (
                <li key={tool.id}>
                  <AssetTypeIcon kind="TOOL" maxUses={tool.maxUses} size={16} />
                  <span>
                    <b>{tool.name}</b>
                    <small>
                      {tr('Υπόλοιπο χρήσεων')}: {remaining} → {Math.max(0, remaining - 1)}
                      {remaining <= 1 ? ` · ${tr('Τελευταία χρήση · θα τεθεί εκτός χρήσης')}` : ''}
                    </small>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="scan-checks">
            <label className={livesConfirmed ? 'on' : ''}>
              <input type="checkbox" checked={livesConfirmed} onChange={e => setLivesConfirmed(e.target.checked)} />
              <span>{tr('Επιβεβαιώνω ότι χρησιμοποιήθηκε (καταγράφεται μία χρήση)')}</span>
            </label>
          </div>
        </section>
      )}
      <label className="scan-field">
        {tr('Παρατήρηση αποστολής')}
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={tr('Π.χ. ειδική παρατήρηση μεταφοράς ή κατάστασης…')}
        />
      </label>
    </ScanScreen>
  );
}
