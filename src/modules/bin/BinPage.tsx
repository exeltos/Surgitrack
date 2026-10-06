import {useEffect, useState} from 'react';
import {Cable, Layers3, Palette, RotateCcw, Tags, Trash2, Wrench} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import {useLibraries} from '../../core/LibraryStore';
import PageHeader from '../../components/ui/PageHeader';
import ScrollableListPanel from '../../components/ui/ScrollableListPanel';
import AssetEmptyState from '../../components/assets/AssetEmptyState';
import {useConfirm} from '../../components/ui/useConfirm';
import {BIN_DAYS, daysLeft, isExpired} from '../../core/recycleBin';
import {restoreDevice, type DeviceSnapshot} from '../../data/cloud/devices';
import type {ColorTape} from '../../core/colorTapes';
import type {LibraryItem} from '../../core/libraries';
import type {LibraryKey} from '../../core/libraryTypes';
import type {BinEntry} from '../../types/domain';
import {getI18nLang, tr, trData} from '../../i18n';

const when = (iso: string) =>
  new Date(iso).toLocaleString(getI18nLang() === 'en' ? 'en-GB' : 'el-GR', {dateStyle: 'short', timeStyle: 'short'});

const LIBRARY_NAME: Record<string, string> = {
  departments: 'Τμήματα',
  specialties: 'Ειδικότητες',
  manufacturers: 'Κατασκευαστές',
  suppliers: 'Προμηθευτές',
  toolCategories: 'Κατηγορίες εργαλείων',
  sterilizers: 'Κλίβανοι',
};

const KIND: Record<BinEntry['kind'], {label: string; icon: typeof Layers3}> = {
  SET: {label: 'Σετ', icon: Layers3},
  TOOL: {label: 'Εργαλείο', icon: Wrench},
  LIBRARY: {label: 'Βιβλιοθήκη Studio', icon: Tags},
  COLOR_TAPE: {label: 'Ταινία χρώματος', icon: Palette},
  DEVICE: {label: 'Συσκευή', icon: Cable},
};

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
  // What stayed past its 30 days goes when the bin is opened.
  useEffect(() => {
    purgeExpiredBin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const entries = recycleBin.filter(entry => !isExpired(entry));

  // Studio libraries are saved by the hospital admin only, so only an admin can put one back.
  const canRestore = (entry: BinEntry) =>
    entry.kind === 'LIBRARY' || entry.kind === 'COLOR_TAPE' ? role === 'ADMIN' : true;

  const restore = async (entry: BinEntry) => {
    setNotice(null);
    try {
      if (entry.kind === 'SET' || entry.kind === 'TOOL') {
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
        eyebrow={tr('ΔΙΑΓΡΑΦΕΣ')}
        title={tr('Κάδος')}
        description={tr(
          'Ό,τι διαγράφεται (Σετ, εργαλεία, συσκευές, εγγραφές βιβλιοθηκών) μένει εδώ {0} ημέρες και μπορεί να επανέλθει όπως ήταν.',
          BIN_DAYS,
        )}
      />
      {notice && (
        <div className={`bin-notice ${notice.ok ? 'ok' : 'bad'}`} role="status">
          {notice.text}
        </div>
      )}
      <ScrollableListPanel ariaLabel={tr('Κάδος')}>
        {entries.length ? (
          <table className="asset-registry-table bin-table">
            <thead>
              <tr>
                <th>{tr('Τύπος')}</th>
                <th>{tr('Αντικείμενο')}</th>
                <th>{tr('Λεπτομέρεια')}</th>
                <th>{tr('Διαγράφηκε')}</th>
                <th>{tr('Λήγει σε')}</th>
                <th>
                  <span className="visually-hidden">{tr('Ενέργειες')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => {
                const Icon = KIND[entry.kind].icon;
                return (
                  <tr key={entry.id}>
                    <td>
                      <span className="bin-kind">
                        <Icon size={14} />
                        {tr(KIND[entry.kind].label)}
                      </span>
                    </td>
                    <td>
                      <strong>{entry.label}</strong>
                    </td>
                    <td>{detailOf(entry)}</td>
                    <td>
                      {when(entry.deletedAt)}
                      <small className="bin-by">{entry.deletedByName}</small>
                    </td>
                    <td>{tr('{0} ημέρες', daysLeft(entry))}</td>
                    <td>
                      <div className="bin-actions">
                        <button
                          type="button"
                          className="issue-action wide"
                          disabled={!canRestore(entry)}
                          title={
                            canRestore(entry) ? undefined : tr('Μόνο ο Διαχειριστής επαναφέρει εγγραφές βιβλιοθηκών.')
                          }
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
                          className="issue-action danger"
                          title={tr('Οριστική διαγραφή')}
                          aria-label={tr('Οριστική διαγραφή')}
                          onClick={() =>
                            ask({
                              title: tr('Οριστική διαγραφή;'),
                              message: tr(
                                'Το «{0}» διαγράφεται για πάντα και δεν θα μπορεί να επανέλθει.',
                                entry.label,
                              ),
                              confirmLabel: tr('Οριστική διαγραφή'),
                              danger: true,
                              onConfirm: () => purgeFromBin(entry.id),
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <AssetEmptyState>{tr('Ο Κάδος είναι άδειος. Ό,τι διαγράφεις θα εμφανίζεται εδώ.')}</AssetEmptyState>
        )}
      </ScrollableListPanel>
      {confirm}
    </div>
  );
}
