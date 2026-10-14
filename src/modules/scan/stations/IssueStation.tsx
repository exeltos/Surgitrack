import {useState} from 'react';
import {Camera, Trash2, TriangleAlert} from 'lucide-react';
import type {BarcodeFeedback} from '../../../components/barcode/BarcodeCapture';
import {filesToAssetPhotos} from '../../../components/assets/photoUtils';
import {tr, trData} from '../../../i18n';
import {useSurgi} from '../../../store/SurgiStore';
import type {AssetPhoto} from '../../../types/domain';
import {departmentOf, findScanned, type Scanned} from '../findScanned';
import ScanCamera from '../ScanCamera';
import {ScanDone, ScanRefused, ScanScreen} from '../ScanParts';
import {useScanAnswers} from '../useScanAnswers';

/** Where the report says it came from (as «Καρτέλα Εργαλείου» on the instrument's page). */
const SOURCE = 'Εφαρμογή κινητού';

const TYPES = ['Βλάβη / μη λειτουργικό', 'Φθορά', 'Κατεστραμμένο', 'Έλλειψη σύνθεσης', 'Άλλο πρόβλημα'];

/**
 * A fault report from the phone: scan the instrument (or the Set, and pick which of its instruments), the
 * kind of problem, a note and photos from the phone's camera. It lands in «Εκκρεμότητες», as from the PC.
 */
export default function IssueStation({onStations}: {onStations: () => void}) {
  const {sets, tools, role, currentUser, reportIssue, reportSetIssue} = useSurgi();
  const [found, setFound] = useState<Scanned | null>(null);
  const [feedback, setFeedback] = useState<BarcodeFeedback | null>(null);
  const [done, setDone] = useState('');
  const [type, setType] = useState(TYPES[0]);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<AssetPhoto[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const answers = useScanAnswers(feedback);

  const scan = (barcode: string) => {
    const item = findScanned(barcode, sets, tools);
    if (!item) {
      setFeedback({type: 'ERROR', message: tr('{0} δεν βρέθηκε στο μητρώο.', barcode)});
      return;
    }
    const label = `${item.asset.barcode} · ${item.asset.name}`;
    if (role === 'DEPARTMENT' && departmentOf(item, sets) !== currentUser.department) {
      setFeedback({type: 'ERROR', message: tr('{0}: ανήκει σε άλλο τμήμα.', label)});
      return;
    }
    setFeedback({type: 'OK', message: label});
    setType(TYPES[0]);
    setNote('');
    setPhotos([]);
    setPicked(new Set());
    setFound(item);
  };

  if (done)
    return (
      <ScanScreen title={tr('Αναφορά βλάβης')} backLabel={tr('Αρχική')} onBack={onStations}>
        <ScanDone
          title={tr('Η αναφορά καταχωρήθηκε')}
          text={done}
          again={tr('Νέα αναφορά')}
          onAgain={() => {
            setDone('');
            answers.reset();
          }}
          onStations={onStations}
        />
      </ScanScreen>
    );

  if (!found)
    return (
      <ScanScreen
        title={tr('Αναφορά βλάβης')}
        subtitle={tr('Σκανάρετε το εργαλείο ή το Σετ με το πρόβλημα.')}
        backLabel={tr('Αρχική')}
        onBack={onStations}
      >
        <ScanCamera onBarcode={scan} feedback={feedback} />
        <ScanRefused messages={answers.refused} />
      </ScanScreen>
    );

  const {kind, asset} = found;
  const members = kind === 'SET' ? tools.filter(t => t.setId === asset.id && t.state !== 'RETIRED') : [];
  const types = TYPES.filter(item => kind === 'SET' || item !== 'Έλλειψη σύνθεσης');
  const togglePick = (id: string) =>
    setPicked(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const addPhotos = async (files: File[]) => {
    setBusy(true);
    try {
      const added = await filesToAssetPhotos(files, 'issues');
      setPhotos(current => [...current, ...added]);
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    if (kind === 'SET') reportSetIssue(asset.id, [...picked], type, note.trim(), photos, SOURCE);
    else reportIssue(asset.id, type, note.trim(), SOURCE, photos);
    setDone(`${asset.barcode} · ${asset.name} · ${trData(type)}`);
    setFound(null);
  };

  return (
    <ScanScreen
      title={kind === 'SET' ? tr('Αναφορά Σετ') : tr('Αναφορά εργαλείου')}
      subtitle={`${asset.barcode} · ${asset.name}`}
      backLabel={tr('Σάρωση')}
      onBack={() => setFound(null)}
      footer={
        <button type="button" className="scan-primary" disabled={busy} onClick={save}>
          <TriangleAlert size={18} /> {tr('Καταχώρηση αναφοράς')}
        </button>
      }
    >
      <label className="scan-field">
        {tr('Τύπος αναφοράς')}
        <select value={type} onChange={e => setType(e.target.value)}>
          {types.map(item => (
            <option key={item} value={item}>
              {trData(item)}
            </option>
          ))}
        </select>
      </label>
      {members.length > 0 && (
        <section className="scan-count-form" aria-label={tr('Εργαλεία με πρόβλημα')}>
          <h2 className="scan-section">
            {tr('Εργαλεία με πρόβλημα')} <span>{tr('προαιρετικά')}</span>
          </h2>
          <div className="scan-checks">
            {members.map(tool => (
              <label key={tool.id} className={picked.has(tool.id) ? 'on' : ''}>
                <input type="checkbox" checked={picked.has(tool.id)} onChange={() => togglePick(tool.id)} />
                <span>
                  <b>{tool.name}</b>
                  <small className="mono">{tool.barcode}</small>
                </span>
              </label>
            ))}
          </div>
        </section>
      )}
      <label className="scan-field">
        {tr('Παρατήρηση')}
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={
            kind === 'SET'
              ? tr('Περιέγραψε το πρόβλημα που αφορά το Σετ…')
              : tr('Περιέγραψε τι διαπιστώθηκε στο εργαλείο…')
          }
        />
      </label>
      <section className="scan-photos" aria-label={tr('Φωτογραφίες φθοράς / βλάβης')}>
        <h2 className="scan-section">
          {tr('Φωτογραφίες φθοράς / βλάβης')} <span>{photos.length}</span>
        </h2>
        {photos.length > 0 && (
          <ul>
            {photos.map(photo => (
              <li key={photo.id}>
                <img src={photo.dataUrl} alt={photo.name} />
                <button
                  type="button"
                  onClick={() => setPhotos(current => current.filter(item => item.id !== photo.id))}
                  aria-label={tr('Αφαίρεση φωτογραφίας')}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="scan-secondary">
          <Camera size={18} /> {busy ? tr('Φόρτωση…') : tr('Λήψη φωτογραφίας')}
          <input
            className="visually-hidden-file"
            type="file"
            accept="image/*"
            capture="environment"
            disabled={busy}
            onChange={e => {
              const files = [...(e.currentTarget.files || [])];
              e.currentTarget.value = '';
              void addPhotos(files);
            }}
          />
        </label>
      </section>
    </ScanScreen>
  );
}
