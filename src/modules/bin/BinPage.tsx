import AssetFilterBar from '../../components/assets/AssetFilterBar';
import PrintPreviewModal from '../../components/assets/PrintPreviewModal';
import DownloadMenu from '../../components/ui/DownloadMenu';
import QuickFilters from '../../components/ui/QuickFilters';
import {tableReportHtml, type ExportTable} from '../../core/exportTable';
import {SplitEmpty} from '../traceability/InfoList';
import {useEffect, useState} from 'react';
import {Cable, Layers3, Palette, RotateCcw, Tags, Trash2, TriangleAlert, Wrench} from 'lucide-react';
import {deviceClockTrusted} from '../../data/cloud/clockCheck';
import {useSurgi} from '../../store/SurgiStore';
import {useLibraries} from '../../core/LibraryStore';
import PageHeader from '../../components/ui/PageHeader';
import ScrollableListPanel from '../../components/ui/ScrollableListPanel';
import EmptyState from '../../components/ui/EmptyState';
import {useConfirm} from '../../components/ui/useConfirm';
import {BIN_DAYS, daysLeft, isExpired} from '../../core/recycleBin';
import {restoreDevice, type DeviceSnapshot} from '../../data/cloud/devices';
import type {ColorTape} from '../../core/colorTapes';
import type {LibraryItem} from '../../core/libraries';
import type {LibraryKey} from '../../core/libraryTypes';
import type {BinEntry} from '../../types/domain';
import {getI18nLang, tr, trData} from '../../i18n';
import {formatDateTime} from '../../core/displayDate';

const when = (iso: string) => formatDateTime(iso);

const LIBRARY_NAME: Record<string, string> = {
  departments: 'Τμήματα',
  specialties: 'Ειδικότητες',
  manufacturers: 'Κατασκευαστές',
  suppliers: 'Προμηθευτές',
  toolCategories: 'Κατηγορίες εργαλείων',
  sterilizers: 'Κλίβανοι',
  washers: 'Πλυντήρια',
};

const KIND: Record<BinEntry['kind'], {label: string; icon: typeof Layers3}> = {
  SET: {label: 'Σετ', icon: Layers3},
  TOOL: {label: 'Εργαλείο', icon: Wrench},
  LIBRARY: {label: 'Βιβλιοθήκη Studio', icon: Tags},
  COLOR_TAPE: {label: 'Ταινία χρώματος', icon: Palette},
  DEVICE: {label: 'Συσκευή', icon: Cable},
  ISSUE: {label: 'Αναφορά προβλήματος', icon: TriangleAlert},
};

/** The quick filters name the kinds in the plural, as lists. */
const pluralOf = (kind: BinEntry['kind']) =>
  ({
    SET: tr('Σετ'),
    TOOL: tr('Εργαλεία'),
    LIBRARY: tr('Βιβλιοθήκες Studio'),
    COLOR_TAPE: tr('Ταινίες χρώματος'),
    DEVICE: tr('Συσκευές'),
    ISSUE: tr('Αναφορές προβλημάτων'),
  })[kind];

const detailOf = (entry: BinEntry) =>
  entry.kind === 'LIBRARY'
    ? tr(LIBRARY_NAME[entry.detail || ''] || 'Βιβλιοθήκη Studio')
    : entry.kind === 'DEVICE'
      ? tr('{0} κύκλοι', entry.payload.device?.readingsTotal ?? 0)
      : entry.detail
        ? trData(entry.detail)
        : '—';

/** What was deleted in the last 30 days: each can be put back as it was, or deleted for good. */
export default function BinPage() {
  const {recycleBin, restoreFromBin, removeFromBin, purgeFromBin, purgeExpiredBin, organizationId, role} = useSurgi();
  const libs = useLibraries();
  const [confirm, ask] = useConfirm();
  const [notice, setNotice] = useState<{ok: boolean; text: string} | null>(null);
  // What stayed past its 30 days goes when the bin is opened, if the device's clock agrees with the server's
  // (a wrong clock would otherwise delete what is still recoverable).
  useEffect(() => {
    let active = true;
    void deviceClockTrusted().then(trusted => {
      if (active && trusted) purgeExpiredBin();
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const entries = recycleBin
    .filter(entry => !isExpired(entry))
    .sort((x, y) => Date.parse(y.deletedAt) - Date.parse(x.deletedAt));
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<BinEntry['kind'] | ''>('');
  const [report, setReport] = useState<string | null>(null);
  const needle = query.trim().toLowerCase();
  const matches = (entry: BinEntry) =>
    !needle ||
    [entry.label, detailOf(entry), entry.deletedByName, tr(KIND[entry.kind].label)].some(text =>
      String(text || '')
        .toLowerCase()
        .includes(needle),
    );
  const found = entries.filter(matches);
  const shown = found.filter(entry => !kind || entry.kind === kind);
  // One quick filter per kind the bin holds, with how many of each the search finds.
  const kinds = (Object.keys(KIND) as BinEntry['kind'][]).filter(k => entries.some(entry => entry.kind === k));
  const table = (): ExportTable => ({
    title: tr('Κάδος'),
    subtitle: tr('{0} εγγραφές', shown.length),
    headers: [tr('Τύπος'), tr('Αντικείμενο'), tr('Λεπτομέρεια'), tr('Διαγράφηκε'), tr('Από'), tr('Λήγει σε')],
    rows: shown.map(entry => [
      tr(KIND[entry.kind].label),
      entry.label,
      detailOf(entry),
      when(entry.deletedAt),
      entry.deletedByName || '',
      tr('{0} ημέρες', daysLeft(entry)),
    ]),
  });

  // Studio libraries are saved by the hospital admin only, so only an admin can put one back.
  const canRestore = (entry: BinEntry) =>
    entry.kind === 'LIBRARY' || entry.kind === 'COLOR_TAPE' || entry.kind === 'ISSUE' ? role === 'ADMIN' : true;

  const restore = async (entry: BinEntry) => {
    setNotice(null);
    try {
      if (entry.kind === 'SET' || entry.kind === 'TOOL' || entry.kind === 'ISSUE') {
        restoreFromBin(entry.id);
        return;
      }
      if (entry.kind === 'LIBRARY' && entry.payload.library) {
        libs.restoreItem(entry.payload.library.key as LibraryKey, entry.payload.library.item as unknown as LibraryItem);
      } else if (entry.kind === 'COLOR_TAPE' && entry.payload.colorTape) {
        libs.restoreColorTape(entry.payload.colorTape as unknown as ColorTape);
      } else if (entry.kind === 'DEVICE' && entry.payload.device && organizationId) {
        await restoreDevice(organizationId, entry.payload.device as unknown as DeviceSnapshot);
      } else return;
      removeFromBin(entry.id);
      setNotice({
        ok: true,
        text:
          entry.kind === 'DEVICE'
            ? tr('Η συσκευή «{0}» επανήλθε. Δημιούργησε νέο κλειδί δικτύου από τη σελίδα Συσκευές.', entry.label)
            : tr('Έγινε επαναφορά: {0}.', entry.label),
      });
    } catch (e) {
      setNotice({
        ok: false,
        text: tr(
          'Δεν έγινε επαναφορά: {0}',
          e instanceof Error ? e.message : String((e as {message?: string})?.message || e),
        ),
      });
    }
  };

  return (
    <div className="tools-list-workspace">
      <PageHeader
        eyebrow={tr('Διαγραφές')}
        title={tr('Κάδος')}
        description={tr('Ό,τι διαγράφεται μένει εδώ {0} ημέρες και μπορεί να επανέλθει.', BIN_DAYS)}
      />
      {notice && (
        <div className={`bin-notice ${notice.ok ? 'ok' : 'bad'}`} role="status">
          {notice.text}
        </div>
      )}
      {entries.length > 0 && (
        <>
          {/* The counts on top, the search under them, as on every list. */}
          <QuickFilters
            items={[
              {key: 'all', label: tr('Όλα'), count: found.length, active: !kind, onClick: () => setKind('')},
              ...kinds.map(k => ({
                key: k,
                label: pluralOf(k),
                count: found.filter(entry => entry.kind === k).length,
                active: kind === k,
                onClick: () => setKind(kind === k ? '' : k),
              })),
            ]}
          />
          <AssetFilterBar
            query={query}
            onQueryChange={setQuery}
            placeholder={tr('Αναζήτηση: όνομα, barcode, ποιος το διέγραψε…')}
            extra={
              <>
                <DownloadMenu table={table} onPrint={() => setReport(tableReportHtml(table(), getI18nLang()))} />
                <button
                  type="button"
                  className="bin-empty-all"
                  onClick={() =>
                    ask({
                      title: tr('Άδειασμα κάδου;'),
                      message: tr(
                        'Διαγράφονται για πάντα {0} εγγραφές και δεν θα μπορούν να επανέλθουν.',
                        entries.length,
                      ),
                      confirmLabel: tr('Άδειασμα κάδου'),
                      danger: true,
                      onConfirm: () => entries.forEach(entry => purgeFromBin(entry.id)),
                    })
                  }
                >
                  <Trash2 size={15} /> {tr('Άδειασμα κάδου')}
                </button>
              </>
            }
          />
        </>
      )}
      <ScrollableListPanel ariaLabel={tr('Κάδος')} className={entries.length ? undefined : 'bin-empty-panel'}>
        {shown.length ? (
          <ul className="bin-list">
            {shown.map(entry => {
              const Icon = KIND[entry.kind].icon;
              const left = daysLeft(entry);
              return (
                <li key={entry.id}>
                  <span className="bin-icon" aria-hidden="true">
                    <Icon size={17} />
                  </span>
                  <span className="bin-name">
                    <b>{entry.label}</b>
                    <small>
                      {tr(KIND[entry.kind].label)}
                      {detailOf(entry) !== '—' && ` · ${detailOf(entry)}`}
                    </small>
                  </span>
                  <span className="bin-when">
                    {when(entry.deletedAt)}
                    {entry.deletedByName && <small>{tr('Διαγράφηκε από {0}', entry.deletedByName)}</small>}
                  </span>
                  {/* How long it stays: amber in its last days. */}
                  <span className={`bin-left${left <= 5 ? ' soon' : ''}`}>
                    {left === 1 ? tr('Σε 1 ημέρα') : tr('Σε {0} ημέρες', left)}
                    <span className="bin-track" aria-hidden="true">
                      <i style={{width: `${Math.max(4, Math.min(100, (left / BIN_DAYS) * 100))}%`}} />
                    </span>
                  </span>
                  <span className="bin-actions">
                    <button
                      type="button"
                      className="bin-restore"
                      disabled={!canRestore(entry)}
                      title={canRestore(entry) ? undefined : tr('Μόνο ο Διαχειριστής επαναφέρει εγγραφές βιβλιοθηκών.')}
                      onClick={() =>
                        ask({
                          title: tr('Επαναφορά;'),
                          message: tr('Το «{0}» επανέρχεται όπως ήταν πριν τη διαγραφή.', entry.label),
                          confirmLabel: tr('Επαναφορά'),
                          onConfirm: () => void restore(entry),
                        })
                      }
                    >
                      <RotateCcw size={14} /> {tr('Επαναφορά')}
                    </button>
                    <button
                      type="button"
                      className="bin-purge"
                      title={tr('Οριστική διαγραφή')}
                      aria-label={tr('Οριστική διαγραφή')}
                      onClick={() =>
                        ask({
                          title: tr('Οριστική διαγραφή;'),
                          message: tr('Το «{0}» διαγράφεται για πάντα και δεν θα μπορεί να επανέλθει.', entry.label),
                          confirmLabel: tr('Οριστική διαγραφή'),
                          danger: true,
                          onConfirm: () => purgeFromBin(entry.id),
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : entries.length ? (
          <EmptyState
            icon={<Trash2 size={22} />}
            title={tr('Δεν βρέθηκε τίποτα')}
            description={tr('Αλλάξτε ή καθαρίστε την αναζήτηση.')}
          />
        ) : (
          <SplitEmpty
            icon={Trash2}
            title={tr('Ο Κάδος είναι άδειος')}
            text={tr('Ό,τι διαγράφεται θα εμφανίζεται εδώ για {0} ημέρες.', BIN_DAYS)}
          />
        )}
      </ScrollableListPanel>
      {report && <PrintPreviewModal title={tr('Κάδος')} html={report} onClose={() => setReport(null)} />}
      {confirm}
    </div>
  );
}
