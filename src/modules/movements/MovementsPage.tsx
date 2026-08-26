import {useMemo, useState} from 'react';
import {ChevronRight, Clock3, Download, MapPin, Printer, Route, Search, ShieldCheck, UserRound, X} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import type {Movement} from '../../types/domain';

function dateKey(value: string) {
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
}
function assetParts(value: string) {
  const [barcode, ...rest] = value.split(' · ');
  return {barcode, name: rest.join(' · ') || value};
}

export default function MovementsPage() {
  const {movements, sets, tools, role, currentUser} = useSurgi();
  const departmentBarcodes = useMemo(
    () =>
      new Set([
        ...sets.filter(item => item.department === currentUser.department).map(item => item.barcode),
        ...tools.filter(item => item.department === currentUser.department).map(item => item.barcode),
      ]),
    [sets, tools, currentUser.department],
  );
  const scopedMovements = useMemo(
    () =>
      role === 'DEPARTMENT'
        ? movements.filter(movement => {
            const barcode = assetParts(movement.asset).barcode;
            return (
              departmentBarcodes.has(barcode) ||
              movement.from === currentUser.department ||
              movement.to === currentUser.department
            );
          })
        : movements,
    [movements, role, currentUser.department, departmentBarcodes],
  );
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<Movement | null>(null);
  const values = (key: 'from' | 'to' | 'status') =>
    [...new Set(scopedMovements.map(m => m[key]).filter(Boolean))].sort();
  const filtered = useMemo(
    () =>
      scopedMovements.filter(m => {
        const d = dateKey(m.at);
        const hay = `${m.asset} ${m.from} ${m.to} ${m.status} ${m.by} ${m.patientCode || ''}`.toLowerCase();
        return (
          (!from || m.from === from) &&
          (!to || m.to === to) &&
          (!status || m.status === status) &&
          (!kind || m.assetKind === kind) &&
          (!dateFrom || !d || d >= dateFrom) &&
          (!dateTo || !d || d <= dateTo) &&
          hay.includes(q.toLowerCase())
        );
      }),
    [scopedMovements, q, from, to, status, kind, dateFrom, dateTo],
  );
  const reset = () => {
    setQ('');
    setFrom('');
    setTo('');
    setStatus('');
    setKind('');
    setDateFrom('');
    setDateTo('');
  };
  const print = () => window.print();
  const exportCsv = () => {
    const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const rows = [
      ['Ημερομηνία', 'Asset', 'Τύπος', 'Από', 'Προς', 'Κίνηση', 'Χρήστης', 'Κωδικός ασθενούς'],
      ...filtered.map(m => [
        m.at,
        m.asset,
        m.assetKind === 'SET' ? 'Σετ' : 'Εργαλείο',
        m.from,
        m.to,
        m.status,
        m.by,
        m.patientCode || '',
      ]),
    ];
    const blob = new Blob(['\ufeff' + rows.map(r => r.map(esc).join(';')).join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SurgiTrack_chain_of_custody.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="movements-workspace">
      <div className="page-head movements-head">
        <div>
          <h1>Κινήσεις & chain of custody</h1>
          <p>
            {role === 'DEPARTMENT'
              ? `Ιστορικό ιχνηλασιμότητας του τμήματος ${currentUser.department}.`
              : 'Αμετάβλητο ιστορικό παραδόσεων, παραλαβών, ελέγχων και μετακινήσεων.'}
          </p>
        </div>
        <div className="movements-actions">
          <button onClick={exportCsv}>
            <Download size={16} /> Export
          </button>
          <button onClick={print}>
            <Printer size={16} /> Εκτύπωση
          </button>
        </div>
      </div>
      <div className="movement-filters">
        <label className="movement-search">
          <Search size={18} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Barcode, Set/εργαλείο, χρήστης ή κωδικός ασθενούς..."
          />
        </label>
        <select value={kind} onChange={e => setKind(e.target.value)}>
          <option value="">Σετ & εργαλεία</option>
          <option value="SET">Σετ</option>
          <option value="TOOL">Εργαλεία</option>
        </select>
        <select value={from} onChange={e => setFrom(e.target.value)}>
          <option value="">Από όλα τα τμήματα</option>
          {values('from').map(v => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select value={to} onChange={e => setTo(e.target.value)}>
          <option value="">Προς όλα τα τμήματα</option>
          {values('to').map(v => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Όλες οι κινήσεις</option>
          {values('status').map(v => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <label className="date-filter">
          <span>Από</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </label>
        <label className="date-filter">
          <span>Έως</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </label>
        <button className="filter-reset" onClick={reset}>
          Καθαρισμός
        </button>
      </div>
      <div className="movement-ledger">
        <div className="ledger-head">
          <div>
            <strong>Ιστορικό κινήσεων</strong>
            <span>
              {filtered.length} {filtered.length === 1 ? 'εγγραφή' : 'εγγραφές'}
            </span>
          </div>
          <small>
            <ShieldCheck size={14} /> Audit trail · οι εγγραφές δεν τροποποιούνται
          </small>
        </div>
        <div className="ledger-columns">
          <span>Ημερομηνία / ώρα</span>
          <span>Set / Εργαλείο</span>
          <span>Διαδρομή</span>
          <span>Ενέργεια</span>
          <span>Χρήστης</span>
          <span></span>
        </div>
        <div className="ledger-scroll">
          {filtered.length ? (
            filtered.map(m => {
              const asset = assetParts(m.asset);
              return (
                <button className="ledger-row" key={m.id} onClick={() => setSelected(m)}>
                  <span className="ledger-date">
                    <Clock3 size={15} />
                    <b>{m.at}</b>
                  </span>
                  <span className="ledger-asset">
                    <small>{m.assetKind === 'SET' ? 'SET' : 'ΕΡΓΑΛΕΙΟ'}</small>
                    <b>{asset.barcode}</b>
                    {asset.name !== asset.barcode && <em>{asset.name}</em>}
                  </span>
                  <span className="ledger-route">
                    <i>{m.from}</i>
                    <ChevronRight size={15} />
                    <i>{m.to}</i>
                  </span>
                  <span>
                    <mark className="movement-chip">{m.status}</mark>
                  </span>
                  <span className="ledger-user">
                    <UserRound size={15} />
                    <span>
                      <b>{m.by}</b>
                      {m.patientCode && <small>Patient {m.patientCode}</small>}
                    </span>
                  </span>
                  <ChevronRight className="ledger-open" size={18} />
                </button>
              );
            })
          ) : (
            <div className="ledger-empty">
              <Route size={28} />
              <strong>Δεν βρέθηκαν κινήσεις</strong>
              <span>Αλλάξτε ή καθαρίστε τα φίλτρα αναζήτησης.</span>
            </div>
          )}
        </div>
      </div>
      {selected && (
        <div
          className="movement-modal-backdrop"
          onMouseDown={e => {
            if (e.currentTarget === e.target) setSelected(null);
          }}
        >
          <div className="movement-detail" role="dialog" aria-modal="true">
            <div className="movement-detail-head">
              <div>
                <small>CHAIN OF CUSTODY</small>
                <h2>Λεπτομέρειες κίνησης</h2>
                <span>{selected.asset}</span>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Κλείσιμο">
                <X />
              </button>
            </div>
            <div className="movement-detail-grid">
              <div>
                <Clock3 />
                <span>Ημερομηνία & ώρα</span>
                <strong>{selected.at}</strong>
              </div>
              <div>
                <Route />
                <span>Ενέργεια</span>
                <strong>{selected.status}</strong>
              </div>
              <div>
                <MapPin />
                <span>Από</span>
                <strong>{selected.from}</strong>
              </div>
              <div>
                <MapPin />
                <span>Προς</span>
                <strong>{selected.to}</strong>
              </div>
              <div>
                <UserRound />
                <span>Καταχώρηση από</span>
                <strong>{selected.by}</strong>
              </div>
              <div>
                <ShieldCheck />
                <span>Τύπος αντικειμένου</span>
                <strong>{selected.assetKind === 'SET' ? 'Σετ' : 'Εργαλείο'}</strong>
              </div>
              {selected.patientCode && (
                <div className="movement-patient">
                  <span>Κωδικός ασθενούς</span>
                  <strong>{selected.patientCode}</strong>
                </div>
              )}
            </div>
            <div className="movement-detail-foot">
              <ShieldCheck size={17} />
              <span>Η εγγραφή αποτελεί μέρος του audit trail και είναι μόνο για ανάγνωση.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
