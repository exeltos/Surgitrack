import {useMemo, useState} from 'react';
import {useSurgi} from '../../store/SurgiStore';
import {Check, ScanBarcode, Signature, TriangleAlert} from 'lucide-react';
export default function CountPage() {
  const {sets, recordCount, counts} = useSurgi();
  const [setId, setSetId] = useState(sets[0]?.id || '');
  const s = useMemo(() => sets.find(x => x.id === setId)!, [sets, setId]);
  const [patientCode, setPatientCode] = useState('P-2026-10482');
  const [counted, setCounted] = useState(s?.expected || 0);
  const [result, setResult] = useState<'OK' | 'MISSING' | 'DAMAGE'>('OK');
  const [note, setNote] = useState('');
  if (!s) return null;
  const diff = counted - s.expected;
  const submit = () =>
    recordCount({
      setId: s.id,
      patientCode,
      expected: s.expected,
      counted,
      result: counted === s.expected && result === 'OK' ? 'OK' : result === 'DAMAGE' ? 'DAMAGE' : 'MISSING',
      note,
    });
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Καταμέτρηση χειρουργείου</h1>
          <p>Τελική καταμέτρηση μετά την επέμβαση με κωδικό ασθενούς και ηλεκτρονική υπογραφή.</p>
        </div>
      </div>
      <div className="count-card">
        <div className="scanbox">
          <ScanBarcode size={22} />
          <div>
            <small>SET</small>
            <select
              className="set-select"
              value={setId}
              onChange={e => {
                setSetId(e.target.value);
                const n = sets.find(x => x.id === e.target.value);
                setCounted(n?.expected || 0);
              }}
            >
              {sets.map(x => (
                <option key={x.id} value={x.id}>
                  {x.barcode} · {x.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Κωδικός ασθενούς
            <input value={patientCode} onChange={e => setPatientCode(e.target.value)} placeholder="P-..." />
          </label>
          <label>
            Αναμενόμενα
            <input value={s.expected} readOnly />
          </label>
          <label>
            Καταμετρημένα
            <input type="number" value={counted} onChange={e => setCounted(Number(e.target.value))} />
          </label>
          <label>
            Αποτέλεσμα
            <select value={result} onChange={e => setResult(e.target.value as 'OK' | 'MISSING' | 'DAMAGE')}>
              <option value="OK">Πλήρης καταμέτρηση</option>
              <option value="MISSING">Έλλειψη</option>
              <option value="DAMAGE">Βλάβη</option>
            </select>
          </label>
        </div>
        <div className={`count-result ${diff === 0 && result === 'OK' ? 'ok' : 'warning-result'}`}>
          {diff === 0 && result === 'OK' ? <Check size={20} /> : <TriangleAlert size={20} />}
          <div>
            <strong>
              {counted}/{s.expected} εργαλεία
            </strong>
            <span>
              {diff === 0 && result === 'OK'
                ? 'Η σύνθεση συμφωνεί με το πρότυπο του Set.'
                : diff < 0
                  ? `Έλλειψη ${Math.abs(diff)} εργαλείων. Θα δημιουργηθεί εκκρεμότητα.`
                  : `Υπάρχουν ${diff} επιπλέον εργαλεία. Απαιτείται έλεγχος.`}
            </span>
          </div>
        </div>
        <label>
          Παρατηρήσεις
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Παρατηρήσεις, βλάβη ή διευκρίνιση..."
          />
        </label>
        <div className="sign-row">
          <div>
            <Signature size={20} />
            <span>Η υπογραφή συνδέεται με τον συνδεδεμένο χρήστη και timestamp.</span>
          </div>
          <button className="primary" onClick={submit} disabled={!patientCode.trim()}>
            Υπογραφή & ολοκλήρωση
          </button>
        </div>
      </div>
      {counts.length > 0 && (
        <div className="panel compact">
          <h3>Πρόσφατες υπογεγραμμένες καταμετρήσεις</h3>
          {counts.map(c => (
            <div className="list-row" key={c.id}>
              <span className="mono">{sets.find(s => s.id === c.setId)?.barcode}</span>
              <strong>{c.patientCode}</strong>
              <span>
                {c.counted}/{c.expected} · {c.by}
              </span>
              <span className="badge">{c.at}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
