import {useState} from 'react';
import {Search, Route} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
export default function TraceabilityPage() {
  const {sets, tools, movements, counts} = useSurgi();
  const [q, setQ] = useState('P-2026-10482');
  const needle = q.trim().toLowerCase();
  const related = movements.filter(m =>
    [m.asset, m.patientCode, m.status].some(x => x?.toLowerCase().includes(needle)),
  );
  const countHits = counts.filter(c => c.patientCode.toLowerCase().includes(needle));
  const asset = [...sets, ...tools].find(
    x => x.barcode.toLowerCase() === needle || x.name.toLowerCase().includes(needle),
  );
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ιχνηλάτηση</h1>
          <p>Αναζήτηση από barcode Set/εργαλείου ή από κωδικό ασθενούς — χωρίς ονοματεπώνυμο ασθενούς.</p>
        </div>
      </div>
      <div className="trace-search">
        <Search />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="S..., T... ή κωδικός ασθενούς" />
        <button className="primary">Αναζήτηση</button>
      </div>
      {asset && (
        <div className="trace-card">
          <Route size={24} />
          <div>
            <small>{asset.barcode.startsWith('S') ? 'SET' : 'ΕΡΓΑΛΕΙΟ'}</small>
            <h2>{asset.barcode}</h2>
            <p>
              {asset.name} · {'department' in asset ? asset.department || 'Stock' : 'Stock'} · {asset.state}
            </p>
          </div>
        </div>
      )}
      {countHits.map(c => (
        <div className="trace-card" key={c.id}>
          <Route size={24} />
          <div>
            <small>ΚΩΔΙΚΟΣ ΑΣΘΕΝΟΥΣ</small>
            <h2>{c.patientCode}</h2>
            <p>
              Υπογεγραμμένη καταμέτρηση Set {sets.find(s => s.id === c.setId)?.barcode}: {c.counted}/{c.expected}{' '}
              εργαλεία · {c.at}.
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
                <p>{m.status}</p>
                <small>
                  {m.from} → {m.to} · {m.at} · {m.by}
                </small>
              </div>
            </div>
          ))
        ) : (
          <div className="empty">
            <strong>Δεν βρέθηκαν επιπλέον κινήσεις</strong>
            <span>Δοκιμάστε barcode ή κωδικό ασθενούς.</span>
          </div>
        )}
      </div>
    </>
  );
}
