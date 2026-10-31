import {Fragment, useEffect, useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {
  Search,
  Route,
  History,
  ExternalLink,
  Flame,
  UserRound,
  Users,
  ArrowLeft,
  ChevronRight,
  Clock3,
} from 'lucide-react';
import {statusLabel} from '../../components/ui/statusLabel';
import DownloadMenu from '../../components/ui/DownloadMenu';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import PrintPreviewModal from '../../components/assets/PrintPreviewModal';
import {tableReportHtml, type ExportTable} from '../../core/exportTable';
import PatientUses from './PatientUses';
import MovementsPage from '../movements/MovementsPage';

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
import {getI18nLang, tr, trData} from '../../i18n';
import HistoryWindowNote from '../../components/ui/HistoryWindowNote';
import {parseDisplayDate} from '../../core/displayDate';
import type {Movement, ProcessLoadStatus, SetAsset, Tool} from '../../types/domain';
import {useUndoneMovements} from '../../components/assets/useUndoneMovements';
import {movementText} from '../../core/movementText';

/** One sterilization cycle an item went through, from the load it was in (or an older per-item record). */
type CycleEntry = {
  id: string;
  at: string;
  sterilizer: string;
  cycleNumber: string;
  program?: string;
  label: string;
  tone: 'ok' | 'bad' | '';
  /** The Set the instrument was in, when the cycle was its Set's. */
  via?: string;
};
const LOAD_STATUS: Record<ProcessLoadStatus, {label: string; tone: CycleEntry['tone']}> = {
  OPEN: {label: 'Σε εξέλιξη', tone: ''},
  PASSED: {label: 'Επιτυχία', tone: 'ok'},
  AWAITING_RELEASE: {label: 'Αναμονή αποδέσμευσης', tone: ''},
  RELEASED: {label: 'Αποδεσμεύτηκε', tone: 'ok'},
  FAILED: {label: 'Αποτυχία', tone: 'bad'},
  REPROCESS: {label: 'Επανεπεξεργασία', tone: 'bad'},
  RECALLED: {label: 'Ανάκληση', tone: 'bad'},
};

const time = (value: string | undefined) => parseDisplayDate(value)?.getTime() ?? 0;
const barcodeOf = (m: Movement) => m.asset.split(' · ')[0].trim();
export default function TraceabilityPage() {
  const {sets, tools, movements, counts, sterilizationCycles, processLoads} = useSurgi();
  const undone = useUndoneMovements();
  // Opened from a movement: the item to look up comes in the address (?q=S000321).
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(() => params.get('q') || '');
  // A movement opened from «Όλες οι κινήσεις» links here with its barcode while the page stays open.
  const urlQuery = params.get('q');
  useEffect(() => {
    if (urlQuery) setQ(urlQuery);
  }, [urlQuery]);
  // Three tabs: the search (a barcode or a patient code), every movement of the hospital, and every use
  // recorded with a patient code.
  const tab = params.get('tab') === 'patients' ? 'PATIENTS' : params.get('tab') === 'history' ? 'HISTORY' : 'SEARCH';
  const patientCodes = new Set(movements.map(m => m.patientCode).filter(Boolean)).size;
  // «Ασθενής»: the list of codes, or (?patient=PT-…) one patient's trace.
  const patient = params.get('patient') || '';
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [report, setReport] = useState<string | null>(null);
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
  const all: Array<SetAsset | Tool> = [...sets, ...tools];
  // A barcode finds its item; a name or code finds every item it fits, to choose from when there are several.
  const exact = needle
    ? all.find(x => x.barcode.toLowerCase() === needle || x.legacyBarcodes?.some(b => b.toLowerCase() === needle))
    : undefined;
  const nameMatches =
    needle && !exact ? all.filter(x => x.name.toLowerCase().includes(needle) || x.code?.toLowerCase() === needle) : [];
  const asset = exact || (nameMatches.length === 1 ? nameMatches[0] : undefined);
  const choosing = !asset && nameMatches.length > 1;
  const isSet = !!asset && sets.some(s => s.id === asset.id);
  const tool = asset && !isSet ? (asset as Tool) : undefined;
  // A member instrument travels inside its Set: the Set's moves belong to its trail too.
  const carrierSet = tool?.mode === 'SET_MEMBER' ? sets.find(s => s.id === tool.setId) : undefined;
  const codes = asset ? [asset.barcode, ...(asset.legacyBarcodes || [])].map(b => b.toLowerCase()) : [];
  const own = asset
    ? movements.filter(m => codes.includes(barcodeOf(m).toLowerCase()))
    : choosing
      ? []
      : needle
        ? movements.filter(m => [m.asset, m.status].some(x => x?.toLowerCase().includes(needle)))
        : [];
  const setMoves = carrierSet
    ? movements.filter(m => barcodeOf(m).toLowerCase() === carrierSet.barcode.toLowerCase())
    : [];
  const related = [...own, ...setMoves];
  // With nothing searched yet: the items that moved most recently, one tap away.
  const recentItems = (() => {
    if (needle) return [];
    const seen = new Map<string, Movement>();
    [...movements]
      .sort((a, b) => time(b.at) - time(a.at))
      .forEach(m => {
        const code = barcodeOf(m);
        if (!m.undoes && !seen.has(code)) seen.set(code, m);
      });
    return [...seen.entries()].slice(0, 8);
  })();
  const countHits = patient ? counts.filter(c => c.patientCode.toLowerCase() === patient.toLowerCase()) : [];
  // The sterilization cycles an item went through: its own, or (an instrument in a Set) its Set's.
  const cyclesOf = (item: SetAsset | Tool): CycleEntry[] => {
    const inSet = 'mode' in item && item.mode === 'SET_MEMBER' ? sets.find(x => x.id === item.setId) : undefined;
    const entries: CycleEntry[] = [];
    processLoads
      .filter(l => l.kind === 'STERILIZATION')
      .forEach(l => {
        const own = l.items.some(i => i.assetId === item.id || i.barcode === item.barcode);
        const viaSet = !own && !!inSet && l.items.some(i => i.assetId === inSet.id);
        if (!own && !viaSet) return;
        const status = LOAD_STATUS[l.status];
        entries.push({
          id: l.id,
          at: l.completedAt || l.createdAt,
          sterilizer: l.equipment,
          cycleNumber: l.cycleNumber,
          program: l.program,
          label: tr(status.label),
          tone: status.tone,
          via: viaSet ? inSet?.barcode : undefined,
        });
      });
    sterilizationCycles
      .filter(c => c.assetId === item.id || c.barcode === item.barcode || c.toolIds?.includes(item.id))
      .forEach(c => {
        if (entries.some(e => e.sterilizer === c.sterilizer && e.cycleNumber === c.cycleNumber)) return;
        entries.push({
          id: c.id,
          at: c.completedAt,
          sterilizer: c.sterilizer,
          cycleNumber: c.cycleNumber,
          program: c.program,
          label: c.result === 'PASSED' ? tr('Επιτυχία') : tr('Αποτυχία'),
          tone: c.result === 'PASSED' ? 'ok' : 'bad',
          via: c.barcode !== item.barcode ? c.barcode : undefined,
        });
      });
    return entries.sort((x, y) => time(y.at) - time(x.at));
  };
  const cycles = asset ? cyclesOf(asset).slice(0, 20) : [];
  // A patient code: what was used for that patient, with the last cycle before the use.
  const patientMoves = patient ? movements.filter(m => m.patientCode?.toLowerCase() === patient.toLowerCase()) : [];
  // A code typed in the item search: offered to open as a patient.
  const typedPatient =
    needle && !asset && !choosing
      ? movements.find(m => m.patientCode?.toLowerCase() === needle)?.patientCode
      : undefined;
  const patientItems = (() => {
    const seen = new Map<string, {item?: SetAsset | Tool; label: string; at: string; cycle?: CycleEntry}>();
    [...patientMoves]
      .sort((a, b) => time(a.at) - time(b.at))
      .forEach(m => {
        const code = barcodeOf(m);
        if (seen.has(code)) return;
        const item = all.find(x => x.barcode === code);
        const used = time(m.at);
        const cycle = item ? cyclesOf(item).find(c => !used || time(c.at) <= used) : undefined;
        seen.set(code, {item, label: m.asset, at: m.at, cycle});
      });
    return [...seen.values()];
  })();
  // The list a person downloads or prints: the moves in front of them, with the patient code when there is one.
  const movesTable = (title: string, list: Movement[]): ExportTable => ({
    title,
    subtitle: tr('{0} κινήσεις', list.length),
    headers: [
      tr('Ημερομηνία / ώρα'),
      tr('Σετ / Εργαλείο'),
      tr('Ενέργεια'),
      tr('Από'),
      tr('Προς'),
      tr('Χρήστης'),
      tr('Κωδικός ασθενούς'),
    ],
    rows: list.map(m => [
      m.at,
      m.asset,
      movementText(m.status),
      trData(m.from),
      trData(m.to),
      trData(m.by),
      m.patientCode || '',
    ]),
  });
  const traceTable = () => movesTable(tr('Ιχνηλάτηση · {0}', q.trim()), related);
  const patientTable = () =>
    movesTable(
      tr('Ασθενής · {0}', patientMoves[0]?.patientCode || patient),
      [...patientMoves].sort((a, b) => time(b.at) - time(a.at)),
    );
  return (
    // The movements tab fills the page, as «Ιστορικό» did on its own.
    <div className={tab === 'HISTORY' ? 'trace-with-history' : undefined}>
      <div className="page-head">
        <div>
          <span className="eyebrow">{tr('ΙΧΝΗΛΑΣΙΜΟΤΗΤΑ')}</span>
          <h1>{tr('Ιχνηλάτηση')}</h1>
          <p>
            {tr(
              'Τι έγινε σε ένα Σετ ή εργαλείο, ή ποιο υλικό καταγράφηκε για έναν ασθενή (μόνο κωδικός, χωρίς ονοματεπώνυμο).',
            )}
          </p>
        </div>
      </div>
      {/* «Όλες οι κινήσεις» shows its own (with «Φόρτωση παλαιότερων»). */}
      {tab !== 'HISTORY' && <HistoryWindowNote auto />}
      <div className="mode-cards" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'SEARCH'}
          className={`mode-card ${tab === 'SEARCH' ? 'active' : ''}`}
          onClick={() => setParams({}, {replace: true})}
        >
          <span className="mode-card-icon">
            <Search size={18} />
          </span>
          <span>
            <strong>{tr('Σετ / εργαλείο')}</strong>
            <small>{tr('Η πορεία ενός Σετ ή εργαλείου, βήμα βήμα')}</small>
          </span>
        </button>
        <button
          role="tab"
          aria-selected={tab === 'PATIENTS'}
          className={`mode-card ${tab === 'PATIENTS' ? 'active' : ''}`}
          onClick={() => setParams({tab: 'patients'}, {replace: true})}
        >
          <span className="mode-card-icon">
            <Users size={18} />
          </span>
          <span>
            <strong>
              {tr('Ασθενής')} <b>{patientCodes}</b>
            </strong>
            <small>{tr('Υλικό ανά κωδικό ασθενούς')}</small>
          </span>
        </button>
        <button
          role="tab"
          aria-selected={tab === 'HISTORY'}
          className={`mode-card ${tab === 'HISTORY' ? 'active' : ''}`}
          onClick={() => setParams({tab: 'history'}, {replace: true})}
        >
          <span className="mode-card-icon">
            <History size={18} />
          </span>
          <span>
            <strong>{tr('Όλες οι κινήσεις')}</strong>
            <small>{tr('Το αμετάβλητο ιστορικό όλου του νοσοκομείου')}</small>
          </span>
        </button>
      </div>
      {tab === 'HISTORY' ? (
        <MovementsPage embedded />
      ) : tab === 'PATIENTS' && !patient ? (
        <PatientUses
          movements={movements}
          onOpen={code => setParams({tab: 'patients', patient: code}, {replace: true})}
        />
      ) : tab === 'PATIENTS' ? (
        <>
          <div className="trace-patient-bar">
            <button type="button" className="trace-back" onClick={() => setParams({tab: 'patients'}, {replace: true})}>
              <ArrowLeft size={16} /> {tr('Όλοι οι ασθενείς')}
            </button>
            {patientMoves.length > 0 && (
              <DownloadMenu
                table={patientTable}
                onPrint={() => setReport(tableReportHtml(patientTable(), getI18nLang()))}
              />
            )}
          </div>
          {patientItems.length > 0 ? (
            <div className="trace-card trace-patient">
              <UserRound size={24} />
              <div>
                <small>{tr('ΚΩΔΙΚΟΣ ΑΣΘΕΝΟΥΣ')}</small>
                <h2>{patientMoves[0].patientCode}</h2>
                <ul>
                  {patientItems.map(p => (
                    <li key={p.label}>
                      {p.item ? (
                        <Link to={sets.some(x => x.id === p.item!.id) ? `/sets/${p.item.id}` : `/tools/${p.item.id}`}>
                          {p.label}
                        </Link>
                      ) : (
                        <b>{p.label}</b>
                      )}
                      <small>
                        {tr('Καταγράφηκε στις {0}', p.at)} ·{' '}
                        {p.cycle
                          ? tr(
                              'Τελευταίος κύκλος πριν: {0} · κύκλος {1} · {2} · {3}',
                              p.cycle.sterilizer,
                              p.cycle.cycleNumber,
                              p.cycle.at,
                              p.cycle.label,
                            )
                          : tr('Δεν βρέθηκε κύκλος αποστείρωσης πριν.')}
                      </small>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="empty">
              <strong>{tr('Δεν βρέθηκε ασθενής με κωδικό «{0}»', patient)}</strong>
            </div>
          )}
          {countHits.map(c => (
            <div className="trace-card" key={c.id}>
              <Route size={24} />
              <div>
                <small>{tr('ΚΩΔΙΚΟΣ ΑΣΘΕΝΟΥΣ')}</small>
                <h2>{c.patientCode}</h2>
                <p>
                  {tr('Υπογεγραμμένη καταμέτρηση Σετ') + ' '}
                  {sets.find(s => s.id === c.setId)?.barcode}: {c.counted}/{c.expected} {tr('εργαλεία ·') + ' '}
                  {c.at}.
                </p>
              </div>
            </div>
          ))}
          <div className="timeline list-scroll-region">
            {[...patientMoves]
              .sort((a, b) => time(b.at) - time(a.at))
              .map(m => (
                <div className="timeline-item trace-step" key={m.id}>
                  <time>{m.at}</time>
                  <div className="dot" />
                  <div>
                    <strong>
                      {movementText(m.status)}{' '}
                      {undone.has(m.id) && <span className="undone-badge">{tr('Αναιρέθηκε')}</span>}
                    </strong>
                    <span className="trace-step-asset">{m.asset}</span>
                    <small>
                      {trData(m.from)} → {trData(m.to)} · {trData(m.by)}
                    </small>
                  </div>
                </div>
              ))}
          </div>
        </>
      ) : (
        <>
          <AssetFilterBar
            className="movement-filter-bar trace-search-bar"
            query={q}
            onQueryChange={setQ}
            onSubmitQuery={remember}
            placeholder={tr('Barcode (S..., T...) ή όνομα Σετ/εργαλείου')}
            extra={
              <>
                <button className="primary" type="button" onClick={() => remember(q)}>
                  {tr('Αναζήτηση')}
                </button>
                {related.length > 0 && (
                  <DownloadMenu
                    table={traceTable}
                    onPrint={() => setReport(tableReportHtml(traceTable(), getI18nLang()))}
                  />
                )}
              </>
            }
          />
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
          {choosing && (
            <div className="trace-pick">
              <strong>{tr('Βρέθηκαν {0} — διαλέξτε ένα:', nameMatches.length)}</strong>
              <ul>
                {nameMatches.slice(0, 30).map(x => (
                  <li key={x.id}>
                    <button type="button" onClick={() => setQ(x.barcode)}>
                      <b className="mono">{x.barcode}</b> {x.name}
                      <small>
                        {trData(x.department) || tr('Απόθεμα')} · {statusLabel(x.state)}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
              {nameMatches.length > 30 && (
                <small>{tr('Εμφανίζονται τα πρώτα 30· γράψτε περισσότερα ή το barcode.')}</small>
              )}
            </div>
          )}
          {asset && (
            <div className="trace-card">
              <Route size={24} />
              <div>
                <small>{isSet ? tr('ΣΕΤ') : tr('ΕΡΓΑΛΕΙΟ')}</small>
                <h2>{asset.barcode}</h2>
                <p>
                  {asset.name} · {trData(asset.department) || tr('Απόθεμα')} · {statusLabel(asset.state)}
                  {carrierSet && ` · ${tr('στο Σετ {0}', `${carrierSet.barcode} ${carrierSet.name}`)}`}
                </p>
              </div>
              <Link className="app-button trace-open" to={isSet ? `/sets/${asset.id}` : `/tools/${asset.id}`}>
                <ExternalLink size={16} /> {tr('Άνοιγμα καρτέλας')}
              </Link>
            </div>
          )}
          {typedPatient && (
            <div className="trace-pick">
              <strong>{tr('Το «{0}» είναι κωδικός ασθενούς.', typedPatient)}</strong>
              <button
                type="button"
                className="app-button"
                onClick={() => setParams({tab: 'patients', patient: typedPatient}, {replace: true})}
              >
                {tr('Άνοιγμα ασθενούς')}
              </button>
            </div>
          )}
          {cycles.length > 0 && (
            <section className="trace-cycles">
              <h3>
                <Flame size={15} /> {tr('Κύκλοι αποστείρωσης')}
              </h3>
              <ul>
                {cycles.map(c => (
                  <li key={c.id}>
                    <time>{c.at}</time>
                    <span>
                      {c.sterilizer} · {tr('κύκλος {0}', c.cycleNumber)}
                      {c.program ? ` · ${c.program}` : ''}
                      {c.via ? ` · ${tr('με το Σετ {0}', c.via)}` : ''}
                    </span>
                    <b className={c.tone}>{c.label}</b>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {related.length > 0 && (
            <div className="movement-ledger trace-ledger">
              <div className="ledger-head">
                <div>
                  <span>
                    {related.length} {related.length === 1 ? tr('εγγραφή') : tr('εγγραφές')}
                  </span>
                </div>
              </div>
              <div className="ledger-columns">
                <span>{tr('Ημερομηνία / ώρα')}</span>
                <span>{tr('Σετ / Εργαλείο')}</span>
                <span>{tr('Διαδρομή')}</span>
                <span>{tr('Ενέργεια')}</span>
                <span>{tr('Χρήστης')}</span>
                <span></span>
              </div>
              <div className="ledger-scroll">
                {related.map((m, i) => {
                  const [code, ...rest] = m.asset.split(' · ');
                  return (
                    <Fragment key={m.id}>
                      {i === own.length && carrierSet && (
                        <h3 className="trace-group">
                          {tr('Κινήσεις του Σετ {0}', `${carrierSet.barcode} · ${carrierSet.name}`)}
                        </h3>
                      )}
                      <div className="ledger-row static">
                        <span className="ledger-date">
                          <Clock3 size={15} />
                          <b>{m.at}</b>
                        </span>
                        <span className="ledger-asset">
                          <small>{m.assetKind === 'SET' ? tr('ΣΕΤ') : tr('ΕΡΓΑΛΕΙΟ')}</small>
                          <b>{code}</b>
                          {rest.length > 0 && <em>{rest.join(' · ')}</em>}
                        </span>
                        <span className="ledger-route">
                          <i>{trData(m.from)}</i>
                          <ChevronRight size={15} />
                          <i>{trData(m.to)}</i>
                        </span>
                        <span>
                          <mark className="movement-chip" title={movementText(m.status)}>
                            {movementText(m.status)}
                          </mark>
                          {undone.has(m.id) && <span className="undone-badge">{tr('Αναιρέθηκε')}</span>}
                        </span>
                        <span className="ledger-user">
                          <UserRound size={15} />
                          <span>
                            <b>{trData(m.by)}</b>
                            {m.patientCode && <small>{tr('Ασθενής {0}', m.patientCode)}</small>}
                          </span>
                        </span>
                        <span />
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            </div>
          )}
          <div className="timeline list-scroll-region">
            {related.length ? null : choosing ? null : recentItems.length ? (
              <section className="trace-recent-items" aria-label={tr('Πρόσφατη δραστηριότητα')}>
                <h3>{tr('Πρόσφατη δραστηριότητα')}</h3>
                <ul>
                  {recentItems.map(([code, m]) => (
                    <li key={code}>
                      <button type="button" onClick={() => setQ(code)}>
                        <b className="mono">{code}</b>
                        <span>{m.asset.split(' · ').slice(1).join(' · ')}</span>
                        <small>
                          {movementText(m.status)} · {m.at}
                        </small>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <div className="empty">
                <strong>
                  {!needle
                    ? tr('Αναζητήστε Σετ ή εργαλείο')
                    : asset
                      ? tr('Δεν βρέθηκαν κινήσεις')
                      : tr('Δεν βρέθηκε Σετ ή εργαλείο με «{0}»', q.trim())}
                </strong>
                <span>
                  {needle
                    ? tr('Δοκιμάστε άλλο barcode ή όνομα.')
                    : tr('Σκανάρετε ή πληκτρολογήστε barcode (S..., T...) ή όνομα.')}
                </span>
              </div>
            )}
          </div>
        </>
      )}
      {report && <PrintPreviewModal title={tr('Ιχνηλάτηση')} html={report} onClose={() => setReport(null)} />}
    </div>
  );
}
