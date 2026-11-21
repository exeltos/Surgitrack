import PageHeader from '../../components/ui/PageHeader';
import {useEffect, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {Search, History, Flame, Users, Package, Layers3, Wrench} from 'lucide-react';
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
import {barcodeOf, time, traceOf} from './traceModel';

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
  // A load's own moves begin with its record id («Φορτίο L1795…-8wmny8 · ΚΛΙΒΑΝΟΣ Α · …»): the sterilizer and
  // cycle say it, the id does not.
  const withoutLoadId = (text: string) => text.replace(/^(Φορτίο|Load) L[\w-]+ · /, '');
  // A member instrument travels inside its Set: the Set's moves belong to its trail too.
  const {carrierSet, moves, cycles, rounds} = asset
    ? traceOf(asset, sets, movements, processLoads, sterilizationCycles)
    : {carrierSet: undefined, moves: [], cycles: [], rounds: []};
  // A code typed in the item search: offered to open as a patient.
  const typedPatient =
    needle && !asset && !choosing
      ? movements.find(m => m.patientCode?.toLowerCase() === needle)?.patientCode
      : undefined;
  // An empty search offers the Sets and instruments that moved last: one click opens their trail.
  const recentlyMoved = (() => {
    const seen = new Set<string>();
    const out: Array<{item: SetAsset | Tool; at: string; status: string}> = [];
    for (const m of [...movements].sort((a, b) => time(b.at) - time(a.at))) {
      const code = barcodeOf(m);
      if (seen.has(code)) continue;
      seen.add(code);
      const item = all.find(x => x.barcode === code);
      if (item) out.push({item, at: m.at, status: m.status});
      if (out.length === 30) break;
    }
    return out;
  })();
  // The item open in the card, shown in the list beside it (scrolled to, when further down).
  const openId = asset?.id || patient || loadId;
  useEffect(() => {
    if (!openId) return;
    // A newly opened card starts at its head, not where the one before was scrolled to.
    const card = document.querySelector('.trace-split-card');
    if (card) card.scrollTop = 0;
    const row = document.querySelector('.trace-split-list .selected');
    if (row && 'scrollIntoView' in row) row.scrollIntoView({block: 'nearest'});
  }, [openId]);
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
      {/* The page's title, as on every other page; under it the tabs, or inside one of its cards (a Set or
          instrument found, a patient, a load) only «Πίσω» in their place, as «Πίσω στη λίστα» on the Set and
          instrument pages: to the previous step, or with nothing before it, to the tab's list. */}
      <PageHeader title={tr('Ιχνηλάτηση')} />
      {/* The tabs stay on every step; inside a found card (a Set or instrument, a patient, a load) «Πίσω» on their
          right goes to the previous step, or with nothing before it, to the tab's list. */}
      <div className="trace-tabs-row">
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
      </div>
      {/* «Όλες οι κινήσεις» shows its own (with «Φόρτωση παλαιότερων»). */}
      {tab !== 'HISTORY' && <HistoryWindowNote auto />}
      {tab === 'HISTORY' ? (
        <MovementsPage embedded />
      ) : tab === 'PATIENTS' ? (
        // The patients on the left, the one open on the right, as for the Sets and instruments.
        <div className="trace-split">
          <aside className="trace-split-list" aria-label={tr('Ασθενείς')}>
            <PatientUses movements={movements} onOpen={openPatient} selected={patient} />
          </aside>
          <section className="trace-split-card" aria-label={tr('Ασθενής')}>
            {patient ? (
              <PatientTrace patient={patient} onItem={openItem} onLoad={openLoad} />
            ) : (
              <p className="trace-split-empty">{tr('Διαλέξτε έναν ασθενή από τη λίστα, ή γράψτε τον κωδικό του.')}</p>
            )}
          </section>
        </div>
      ) : tab === 'LOAD' ? (
        <LoadTrace loadId={loadId} onOpen={openLoad} onItem={openItem} onPatient={openPatient} />
      ) : (
        // The list on the left (search, recent searches, the items that moved last or those a name fits), the open
        // item's card on the right: picking another changes only the card. Each side scrolls on its own.
        <div className="trace-split">
          <aside className="trace-split-list" aria-label={tr('Σετ και εργαλεία')}>
            {/* The same search bar as above every other list; Enter or «Αναζήτηση» opens what was typed. */}
            <form
              className="asset-filter-bar trace-search-bar"
              onSubmit={e => {
                e.preventDefault();
                commit(q);
              }}
            >
              <div className="asset-filter-search">
                <Search size={17} />
                <input
                  type="search"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  onKeyDown={suggest.onKeyDown}
                  onBlur={() => needle && commit(q)}
                  placeholder={tr('Barcode (S..., T...) ή όνομα Σετ/εργαλείου')}
                  aria-label={tr('Barcode (S..., T...) ή όνομα Σετ/εργαλείου')}
                />
              </div>
              <button className="asset-filter-toggle" type="submit">
                {tr('Αναζήτηση')}
              </button>
              {suggest.listbox}
            </form>
            {recent.length > 0 && (
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
            {typedPatient && (
              <div className="trace-pick">
                <strong>{tr('Το «{0}» είναι κωδικός ασθενούς.', typedPatient)}</strong>
                <button type="button" className="app-button" onClick={() => openPatient(typedPatient)}>
                  {tr('Άνοιγμα ασθενούς')}
                </button>
              </div>
            )}
            {/* A name fitting several: those, to pick from; otherwise what moved last. */}
            {choosing ? (
              <section
                className="trace-recent-list"
                aria-label={tr('Βρέθηκαν {0} — διαλέξτε ένα:', nameMatches.length)}
              >
                <h3 className="trace-section-title">{tr('Βρέθηκαν {0} — διαλέξτε ένα:', nameMatches.length)}</h3>
                <ul>
                  {nameMatches.slice(0, 30).map(x => (
                    <li key={x.id}>
                      <button type="button" onClick={() => commit(x.barcode)}>
                        <b className="mono trace-code">{x.barcode}</b>
                        <span>{x.name}</span>
                        <span>
                          {trData(x.department) || tr('Απόθεμα')} · {statusLabel(x.state)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {nameMatches.length > 30 && (
                  <small className="trace-hint">
                    {tr('Εμφανίζονται τα πρώτα 30· γράψτε περισσότερα ή το barcode.')}
                  </small>
                )}
              </section>
            ) : (
              recentlyMoved.length > 0 && (
                <section className="trace-recent-list" aria-label={tr('Κινήθηκαν πρόσφατα')}>
                  <h3 className="trace-section-title">{tr('Κινήθηκαν πρόσφατα')}</h3>
                  <ul>
                    {recentlyMoved.map(({item, at, status}) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={asset?.id === item.id ? 'selected' : undefined}
                          aria-current={asset?.id === item.id ? 'true' : undefined}
                          onClick={() => commit(item.barcode)}
                        >
                          <b className="mono trace-code">
                            {'expected' in item ? (
                              <Layers3 size={15} aria-label={tr('Σετ')} />
                            ) : (
                              <Wrench size={15} aria-label={tr('Εργαλείο')} />
                            )}
                            {item.barcode}
                          </b>
                          <span>{item.name}</span>
                          <span title={movementText(status)}>{withoutLoadId(movementText(status))}</span>
                          <span>{at}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            )}
          </aside>
          <section className="trace-split-card" aria-label={tr('Ιχνηλάτηση')}>
            {asset ? (
              <ItemTrace
                asset={asset}
                carrierSet={carrierSet}
                moves={moves}
                cycles={cycles}
                rounds={rounds}
                onPatient={openPatient}
                onLoad={openLoad}
                actions={
                  moves.length > 0 && (
                    <DownloadMenu
                      table={traceTable}
                      onPrint={() => setReport(tableReportHtml(traceTable(), getI18nLang()))}
                    />
                  )
                }
              />
            ) : needle && !choosing && !typedPatient ? (
              <div className="empty">
                <strong>{tr('Δεν βρέθηκε Σετ ή εργαλείο με «{0}»', q.trim())}</strong>
                <span>{tr('Δοκιμάστε άλλο barcode ή όνομα.')}</span>
              </div>
            ) : (
              <p className="trace-split-empty">
                {tr('Διαλέξτε ένα Σετ ή εργαλείο από τη λίστα, ή γράψτε το barcode του.')}
              </p>
            )}
          </section>
        </div>
      )}
      {report && <PrintPreviewModal title={tr('Ιχνηλάτηση')} html={report} onClose={() => setReport(null)} />}
    </div>
  );
}
