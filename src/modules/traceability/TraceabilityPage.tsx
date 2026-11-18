import {useEffect, useState} from 'react';
import {useLocation, useNavigate, useSearchParams} from 'react-router-dom';
import {ArrowLeft, Search, History, Flame, Users, Package} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import {statusLabel} from '../../components/ui/statusLabel';
import DownloadMenu from '../../components/ui/DownloadMenu';
import PrintPreviewModal from '../../components/assets/PrintPreviewModal';
import {tableReportHtml, type ExportTable} from '../../core/exportTable';
import PatientUses from './PatientUses';
import MovementsPage from '../movements/MovementsPage';
import {readRecentSearches, rememberRecentSearch} from '../../core/recentSearches';
import {useSurgi} from '../../store/SurgiStore';
import {getI18nLang, tr, trData} from '../../i18n';
import HistoryWindowNote from '../../components/ui/HistoryWindowNote';
import type {SetAsset, Tool} from '../../types/domain';
import {movementText} from '../../core/movementText';
import {useAssetSuggest} from '../../components/barcode/AssetSuggest';
import ItemTrace from './ItemTrace';
import PatientTrace from './PatientTrace';
import LoadTrace from './LoadTrace';
import {barcodeOf, cyclesOf, roundsOf, time} from './traceModel';

type Tab = 'SEARCH' | 'PATIENTS' | 'LOAD' | 'HISTORY';
const TAB_PARAM: Record<Tab, string | undefined> = {
  SEARCH: undefined,
  PATIENTS: 'patients',
  LOAD: 'load',
  HISTORY: 'history',
};

/**
 * Traceability answers three questions, one tab each: where a Set or instrument is and what happened to it, what
 * was used on a patient and whether it was sterilized in a good cycle, and what a sterilizer load held (to recall
 * it). Every movement of the hospital is the fourth tab.
 */
export default function TraceabilityPage() {
  const {sets, tools, movements, sterilizationCycles, processLoads} = useSurgi();
  // Everything open is in the address (?q=, ?tab=, ?patient=, ?load=): «Πίσω» returns to it, a link opens it.
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(() => params.get('q') || '');
  const urlQuery = params.get('q');
  const [recent, setRecent] = useState<string[]>(readRecentSearches);
  const [report, setReport] = useState<string | null>(null);
  const remember = (value: string) => {
    const term = value.trim();
    if (!term) return;
    setRecent(rememberRecentSearch(recent, term));
  };
  // A finished search (Enter, a pick, leaving the field) is a step of the browser's history, so «Πίσω» returns to it
  // after opening an item, and from it to the empty search.
  const commit = (term: string) => {
    remember(term);
    const value = term.trim();
    // The field shows the term even when the address already has it (a recent search picked again).
    setQ(term);
    if (value && value !== urlQuery) setParams({q: value});
  };
  useEffect(() => {
    // «Πίσω» to a search, or to no search: the field follows the address.
    setQ(urlQuery ?? '');
  }, [urlQuery]);
  const tabParam = params.get('tab');
  const tab: Tab =
    tabParam === 'patients' ? 'PATIENTS' : tabParam === 'load' ? 'LOAD' : tabParam === 'history' ? 'HISTORY' : 'SEARCH';
  const patient = params.get('patient') || '';
  const loadId = params.get('load') || '';
  const openTab = (next: Tab) => {
    if (next !== tab) setParams(TAB_PARAM[next] ? {tab: TAB_PARAM[next]!} : {});
  };
  const navigate = useNavigate();
  // A step to go back to inside the app: the browser's history index (a page reached by a redirect is at 0 too); where
  // there is none (tests, in memory), the router's key, «default» on the first page.
  const location = useLocation();
  const historyIndex = (window.history.state as {idx?: number} | null)?.idx;
  const canGoBack = typeof historyIndex === 'number' ? historyIndex > 0 : location.key !== 'default';
  // Something open on the tab (a search, a patient, a load): with nothing before it, «Πίσω» returns to the tab's start.
  const detailOpen = !!(urlQuery || patient || loadId);
  const goBack = () => (canGoBack ? navigate(-1) : setParams(TAB_PARAM[tab] ? {tab: TAB_PARAM[tab]!} : {}));
  const openPatient = (code: string) => setParams({tab: 'patients', patient: code});
  const openLoad = (id: string) => setParams({tab: 'load', load: id});
  const openItem = (barcode: string) => commit(barcode);

  const needle = q.trim().toLowerCase();
  const all: Array<SetAsset | Tool> = [...sets, ...tools];
  // A barcode finds its item; a name or code finds every item it fits, to choose from when there are several.
  const exact = needle
    ? all.find(x => x.barcode.toLowerCase() === needle || x.legacyBarcodes?.some(b => b.toLowerCase() === needle))
    : undefined;
  const nameMatches =
    needle && !exact ? all.filter(x => x.name.toLowerCase().includes(needle) || x.code?.toLowerCase() === needle) : [];
  // Typing a name or code offers the Sets and instruments (members of Sets too) to pick from.
  const suggest = useAssetSuggest(q, picked => commit(picked), all);
  const asset = exact || (nameMatches.length === 1 ? nameMatches[0] : undefined);
  const choosing = !asset && nameMatches.length > 1;
  const tool = asset && !sets.some(s => s.id === asset.id) ? (asset as Tool) : undefined;
  // A member instrument travels inside its Set: the Set's moves belong to its trail too.
  const carrierSet = tool?.mode === 'SET_MEMBER' ? sets.find(s => s.id === tool.setId) : undefined;
  const codes = [asset, carrierSet]
    .flatMap(x => (x ? [x.barcode, ...(x.legacyBarcodes || [])] : []))
    .map(b => b.toLowerCase());
  const moves = asset ? movements.filter(m => codes.includes(barcodeOf(m).toLowerCase())) : [];
  const cycles = asset ? cyclesOf(asset, sets, processLoads, sterilizationCycles) : [];
  const rounds = asset ? roundsOf(moves, cycles) : [];
  // A code typed in the item search: offered to open as a patient.
  const typedPatient =
    needle && !asset && !choosing
      ? movements.find(m => m.patientCode?.toLowerCase() === needle)?.patientCode
      : undefined;
  // An empty search offers the Sets and instruments that moved last: one click opens their trail.
  const recentlyMoved = (() => {
    if (needle) return [];
    const seen = new Set<string>();
    const out: Array<{item: SetAsset | Tool; at: string; status: string}> = [];
    for (const m of [...movements].sort((a, b) => time(b.at) - time(a.at))) {
      const code = barcodeOf(m);
      if (seen.has(code)) continue;
      seen.add(code);
      const item = all.find(x => x.barcode === code);
      if (item) out.push({item, at: m.at, status: m.status});
      if (out.length === 8) break;
    }
    return out;
  })();
  const traceTable = (): ExportTable => ({
    title: tr('Ιχνηλάτηση · {0}', asset ? `${asset.barcode} ${asset.name}` : q.trim()),
    subtitle: tr('{0} κινήσεις', moves.length),
    headers: [
      tr('Ημερομηνία / ώρα'),
      tr('Σετ / Εργαλείο'),
      tr('Ενέργεια'),
      tr('Από'),
      tr('Προς'),
      tr('Χρήστης'),
      tr('Κωδικός ασθενούς'),
    ],
    rows: [...moves]
      .sort((a, b) => time(b.at) - time(a.at))
      .map(m => [
        m.at,
        m.asset,
        movementText(m.status),
        trData(m.from),
        trData(m.to),
        trData(m.by),
        m.patientCode || '',
      ]),
  });
  const tabs: Array<{id: Tab; label: string; icon: typeof Search}> = [
    {id: 'SEARCH', label: 'Σετ / εργαλείο', icon: Package},
    {id: 'PATIENTS', label: 'Ασθενής', icon: Users},
    {id: 'LOAD', label: 'Φορτίο κλιβάνου', icon: Flame},
    {id: 'HISTORY', label: 'Όλες οι κινήσεις', icon: History},
  ];

  return (
    // The movements tab fills the page, as «Ιστορικό» did on its own.
    <div className={tab === 'HISTORY' ? 'trace-with-history' : 'trace-page'}>
      {/* No page title: the menu says where this is. In its place, top left, one «Πίσω» on every tab, as «Πίσω στη
          λίστα» on the Set and instrument pages: to the previous step (a search, a patient, a load, the page this was
          opened from); with nothing before it, to the tab's empty start. */}
      <h1 className="visually-hidden">{tr('Ιχνηλάτηση')}</h1>
      {(canGoBack || detailOpen) && (
        <div className="trace-head">
          <AppButton icon={<ArrowLeft size={18} />} onClick={goBack} className="trace-page-back">
            {tr('Πίσω')}
          </AppButton>
        </div>
      )}
      <div className="name-check-tabs trace-tabs" role="tablist" aria-label={tr('Τι ψάχνετε')}>
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => openTab(t.id)}
          >
            <t.icon size={16} aria-hidden="true" /> {tr(t.label)}
          </button>
        ))}
      </div>
      {/* «Όλες οι κινήσεις» shows its own (with «Φόρτωση παλαιότερων»). */}
      {tab !== 'HISTORY' && <HistoryWindowNote auto />}
      {tab === 'HISTORY' ? (
        <MovementsPage embedded />
      ) : tab === 'PATIENTS' && !patient ? (
        <PatientUses movements={movements} onOpen={openPatient} />
      ) : tab === 'PATIENTS' ? (
        <PatientTrace patient={patient} onItem={openItem} onLoad={openLoad} />
      ) : tab === 'LOAD' ? (
        <LoadTrace key={loadId} loadId={loadId} onOpen={openLoad} onItem={openItem} onPatient={openPatient} />
      ) : (
        <>
          <form
            className="trace-search"
            onSubmit={e => {
              e.preventDefault();
              commit(q);
            }}
          >
            <Search />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={suggest.onKeyDown}
              onBlur={() => needle && commit(q)}
              placeholder={tr('Barcode (S..., T...) ή όνομα Σετ/εργαλείου')}
              aria-label={tr('Barcode (S..., T...) ή όνομα Σετ/εργαλείου')}
            />
            <button className="primary" type="submit">
              {tr('Αναζήτηση')}
            </button>
            {suggest.listbox}
          </form>
          {!needle && recent.length > 0 && (
            <div className="trace-recent">
              <History size={15} />
              <span>{tr('Πρόσφατες αναζητήσεις')}</span>
              {recent.map(term => (
                <button key={term} type="button" onClick={() => commit(term)}>
                  {term}
                </button>
              ))}
            </div>
          )}
          {/* The list above offers them while typing; this one is for when it was closed (Esc). */}
          {choosing && !suggest.suggestions.length && (
            <div className="trace-pick">
              <strong>{tr('Βρέθηκαν {0} — διαλέξτε ένα:', nameMatches.length)}</strong>
              <ul>
                {nameMatches.slice(0, 30).map(x => (
                  <li key={x.id}>
                    <button type="button" onClick={() => commit(x.barcode)}>
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
          {typedPatient && (
            <div className="trace-pick">
              <strong>{tr('Το «{0}» είναι κωδικός ασθενούς.', typedPatient)}</strong>
              <button type="button" className="app-button" onClick={() => openPatient(typedPatient)}>
                {tr('Άνοιγμα ασθενούς')}
              </button>
            </div>
          )}
          {asset ? (
            <>
              <ItemTrace
                asset={asset}
                carrierSet={carrierSet}
                moves={moves}
                cycles={cycles}
                rounds={rounds}
                onPatient={openPatient}
                onLoad={openLoad}
              />
              {moves.length > 0 && (
                <div className="trace-actions">
                  <DownloadMenu
                    table={traceTable}
                    onPrint={() => setReport(tableReportHtml(traceTable(), getI18nLang()))}
                  />
                </div>
              )}
            </>
          ) : needle ? (
            !choosing &&
            !typedPatient && (
              <div className="empty">
                <strong>{tr('Δεν βρέθηκε Σετ ή εργαλείο με «{0}»', q.trim())}</strong>
                <span>{tr('Δοκιμάστε άλλο barcode ή όνομα.')}</span>
              </div>
            )
          ) : (
            <>
              {recentlyMoved.length > 0 && (
                <section className="trace-recent-list" aria-label={tr('Κινήθηκαν πρόσφατα')}>
                  <h3 className="trace-section-title">{tr('Κινήθηκαν πρόσφατα')}</h3>
                  <ul>
                    {recentlyMoved.map(({item, at, status}) => (
                      <li key={item.id}>
                        <button type="button" onClick={() => commit(item.barcode)}>
                          <b className="mono">{item.barcode}</b>
                          <span>{item.name}</span>
                          <span>{movementText(status)}</span>
                          <span>{at}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
      )}
      {report && <PrintPreviewModal title={tr('Ιχνηλάτηση')} html={report} onClose={() => setReport(null)} />}
    </div>
  );
}
