import {useState} from 'react';
import {Search, Route, History} from 'lucide-react';
import {statusLabel} from '../../components/ui/statusLabel';

const RECENT_KEY = 'surgitrack.trace.recent';
/** The last searches on this device (barcodes and patient codes), newest first. */
const readRecent = (): string[] => {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').slice(0, 6) : [];
  } catch {
    return [];
  }
};
import {useSurgi} from '../../store/SurgiStore';
import {tr, trData} from '../../i18n';
import HistoryWindowNote from '../../components/ui/HistoryWindowNote';
export default function TraceabilityPage() {
  const {sets, tools, movements, counts} = useSurgi();
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState<string[]>(readRecent);
  const remember = (value: string) => {
    const term = value.trim();
    if (!term) return;
    const next = [term, ...recent.filter(x => x.toLowerCase() !== term.toLowerCase())].slice(0, 6);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // Private mode: the list just is not kept.
    }
  };
  const needle = q.trim().toLowerCase();
  // Nothing is shown until something is searched: an empty query would match every record.
  const related = needle
    ? movements.filter(m => [m.asset, m.patientCode, m.status].some(x => x?.toLowerCase().includes(needle)))
    : [];
  const countHits = needle ? counts.filter(c => c.patientCode.toLowerCase().includes(needle)) : [];
  const asset = needle
    ? [...sets, ...tools].find(x => x.barcode.toLowerCase() === needle || x.name.toLowerCase().includes(needle))
    : undefined;
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{tr('ΙΧΝΗΛΑΣΙΜΟΤΗΤΑ')}</span>
          <h1>{tr('Ιχνηλάτηση')}</h1>
          <p>{tr('Αναζήτηση από barcode Set/εργαλείου ή από κωδικό ασθενούς — χωρίς ονοματεπώνυμο ασθενούς.')}</p>
        </div>
      </div>
      <HistoryWindowNote auto />
      <form
        className="trace-search"
        onSubmit={e => {
          e.preventDefault();
          remember(q);
        }}
      >
        <Search />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onBlur={() => needle && remember(q)}
          placeholder={tr('S..., T... ή κωδικός ασθενούς')}
        />
        <button className="primary" type="submit">
          {tr('Αναζήτηση')}
        </button>
      </form>
      {!needle && recent.length > 0 && (
        <div className="trace-recent">
          <History size={15} />
          <span>{tr('Πρόσφατες αναζητήσεις')}</span>
          {recent.map(term => (
            <button key={term} type="button" onClick={() => setQ(term)}>
              {term}
            </button>
          ))}
        </div>
      )}
      {asset && (
        <div className="trace-card">
          <Route size={24} />
          <div>
            <small>{asset.barcode.startsWith('S') ? 'SET' : tr('ΕΡΓΑΛΕΙΟ')}</small>
            <h2>{asset.barcode}</h2>
            <p>
              {asset.name} · {trData(asset.department) || tr('Απόθεμα')} · {statusLabel(asset.state)}
            </p>
          </div>
        </div>
      )}
      {countHits.map(c => (
        <div className="trace-card" key={c.id}>
          <Route size={24} />
          <div>
            <small>{tr('ΚΩΔΙΚΟΣ ΑΣΘΕΝΟΥΣ')}</small>
            <h2>{c.patientCode}</h2>
            <p>
              {tr('Υπογεγραμμένη καταμέτρηση Set') + ' '}
              {sets.find(s => s.id === c.setId)?.barcode}: {c.counted}/{c.expected} {tr('εργαλεία ·') + ' '}
              {c.at}.
            </p>
          </div>
        </div>
      ))}
      <div className="timeline list-scroll-region">
        {related.length ? (
          related.map(m => (
            <div className="timeline-item" key={m.id}>
              <div className="dot" />
              <div>
                <strong>{m.asset}</strong>
                <p>{trData(m.status)}</p>
                <small>
                  {trData(m.from)} → {trData(m.to)} · {m.at} · {trData(m.by)}
                </small>
              </div>
            </div>
          ))
        ) : (
          <div className="empty">
            <strong>{needle ? tr('Δεν βρέθηκαν κινήσεις') : tr('Αναζητήστε Set, εργαλείο ή ασθενή')}</strong>
            <span>
              {needle
                ? tr('Δοκιμάστε άλλο barcode ή κωδικό ασθενούς.')
                : tr('Σκανάρετε ή πληκτρολογήστε barcode (S..., T...) ή κωδικό ασθενούς.')}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
