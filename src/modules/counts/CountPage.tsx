import {useMemo, useState} from 'react';
import {useSurgi} from '../../store/SurgiStore';
import {Check, ScanBarcode, Signature, TriangleAlert} from 'lucide-react';
import {tr, trData} from '../../i18n';

/**
 * The final surgical count: every instrument of the Set is ticked one by one (by hand or by scanning its
 * barcode). Nothing starts counted, so a count cannot be signed as complete without counting.
 */
export default function CountPage() {
  const {sets: allSets, tools: allTools, recordCount, counts: allCounts, role, currentUser} = useSurgi();
  // A department counts only its own sets and sees only its own counts (patient codes included).
  const sets = useMemo(
    () => (role === 'DEPARTMENT' ? allSets.filter(x => x.department === currentUser.department) : allSets),
    [allSets, role, currentUser.department],
  );
  const counts = useMemo(() => {
    const visible = new Set(sets.map(x => x.id));
    return allCounts.filter(c => visible.has(c.setId));
  }, [allCounts, sets]);
  const [setId, setSetId] = useState(sets[0]?.id || '');
  const s = useMemo(() => sets.find(x => x.id === setId), [sets, setId]);
  // The instruments physically in the Set right now: what the count is against.
  const members = useMemo(
    () => (s ? allTools.filter(t => t.setId === s.id && t.state !== 'RETIRED') : []),
    [allTools, s],
  );
  const [patientCode, setPatientCode] = useState('');
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [scan, setScan] = useState('');
  const [scanMessage, setScanMessage] = useState('');
  const [damage, setDamage] = useState(false);
  const [note, setNote] = useState('');
  if (!s)
    return (
      <div className="empty">
        <strong>{tr('Δεν υπάρχουν Σετ για καταμέτρηση')}</strong>
        <span>
          {tr('Δεν βρέθηκαν Σετ του τμήματος') + ' '}
          {trData(currentUser.department)}.
        </span>
      </div>
    );
  const expected = members.length;
  const counted = members.filter(t => ticked.has(t.id)).length;
  const missing = members.filter(t => !ticked.has(t.id));
  const complete = counted === expected && !damage;
  const reset = () => {
    setTicked(new Set());
    setScan('');
    setScanMessage('');
    setDamage(false);
    setNote('');
  };
  const toggle = (id: string) =>
    setTicked(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
  const submit = () => {
    if (
      missing.length &&
      !window.confirm(tr('Λείπουν {0} εργαλεία. Υπογραφή της καταμέτρησης με έλλειψη;', missing.length))
    )
      return;
    const missingNote = missing.length ? tr('Λείπουν: {0}', missing.map(t => `${t.barcode} ${t.name}`).join(', ')) : '';
    recordCount({
      setId: s.id,
      patientCode: patientCode.trim(),
      expected,
      counted,
      result: damage ? 'DAMAGE' : counted === expected ? 'OK' : 'MISSING',
      note: [note.trim(), missingNote].filter(Boolean).join(' · '),
    });
    setPatientCode('');
    reset();
  };
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{tr('ΧΕΙΡΟΥΡΓΕΙΟ')}</span>
          <h1>{tr('Καταμέτρηση χειρουργείου')}</h1>
          <p>{tr('Τελική καταμέτρηση μετά την επέμβαση με κωδικό ασθενούς και ηλεκτρονική υπογραφή.')}</p>
        </div>
      </div>
      <div className="count-card">
        <div className="scanbox">
          <ScanBarcode size={22} />
          <div>
            <small>{tr('Σετ')}</small>
            <select
              className="set-select"
              aria-label={tr('Σετ')}
              value={setId}
              onChange={e => {
                setSetId(e.target.value);
                reset();
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
            {tr('Κωδικός ασθενούς')}
            <input value={patientCode} onChange={e => setPatientCode(e.target.value)} placeholder="P-..." />
          </label>
          <label>
            {tr('Σάρωση εργαλείου')}
            <input
              value={scan}
              onChange={e => setScan(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  scanTool();
                }
              }}
              placeholder={tr('Barcode εργαλείου + Enter')}
            />
            {scanMessage && <small className="count-scan-message">{scanMessage}</small>}
          </label>
        </div>
        <div className="count-list" role="group" aria-label={tr('Εργαλεία Σετ')}>
          <div className="count-list-head">
            <strong>{tr('Εργαλεία Σετ')}</strong>
            <span>
              {tr('{0} από {1} καταμετρημένα', counted, expected)}
              {s.expected && s.expected !== expected ? ` · ${tr('πρότυπο {0}', s.expected)}` : ''}
            </span>
            {ticked.size > 0 && (
              <button type="button" className="count-clear" onClick={() => setTicked(new Set())}>
                {tr('Καθαρισμός')}
              </button>
            )}
          </div>
          {members.map(t => (
            <label key={t.id} className={`count-item ${ticked.has(t.id) ? 'on' : ''}`}>
              <input type="checkbox" checked={ticked.has(t.id)} onChange={() => toggle(t.id)} />
              <span className="mono">{t.barcode}</span>
              <strong>{t.name}</strong>
              <small>{t.code}</small>
            </label>
          ))}
        </div>
        <label className="count-damage">
          <input type="checkbox" checked={damage} onChange={e => setDamage(e.target.checked)} />
          {tr('Βλάβη ή φθορά σε εργαλείο (γράψτε ποιο στις παρατηρήσεις)')}
        </label>
        <div className={`count-result ${complete ? 'ok' : 'warning-result'}`}>
          {complete ? <Check size={20} /> : <TriangleAlert size={20} />}
          <div>
            <strong>
              {counted}/{expected} {tr('εργαλεία')}
            </strong>
            <span>
              {complete
                ? tr('Όλα τα εργαλεία του Σετ καταμετρήθηκαν.')
                : damage
                  ? tr('Θα δημιουργηθεί εκκρεμότητα βλάβης.')
                  : counted === 0
                    ? tr('Τσεκάρετε ή σαρώστε κάθε εργαλείο που καταμετράτε.')
                    : tr('Λείπουν {0} εργαλεία. Θα δημιουργηθεί εκκρεμότητα.', missing.length)}
            </span>
          </div>
        </div>
        <label>
          {tr('Παρατηρήσεις')}
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={tr('Παρατηρήσεις, βλάβη ή διευκρίνιση...')}
          />
        </label>
        <div className="sign-row">
          <div>
            <Signature size={20} />
            <span>{tr('Η υπογραφή συνδέεται με τον συνδεδεμένο χρήστη και timestamp.')}</span>
          </div>
          <button className="primary" onClick={submit} disabled={!patientCode.trim() || expected === 0}>
            {tr('Υπογραφή & ολοκλήρωση')}
          </button>
        </div>
      </div>
      {counts.length > 0 && (
        <div className="panel compact">
          <h3>{tr('Πρόσφατες υπογεγραμμένες καταμετρήσεις')}</h3>
          {counts.map(c => (
            <div className="list-row" key={c.id}>
              <span className="mono">{sets.find(s => s.id === c.setId)?.barcode}</span>
              <strong>{c.patientCode}</strong>
              <span>
                {c.counted}/{c.expected} · {trData(c.by)}
              </span>
              <span className="badge">{c.at}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
