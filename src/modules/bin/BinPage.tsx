import {useEffect} from 'react';
import {Layers3, RotateCcw, Trash2, Wrench} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import PageHeader from '../../components/ui/PageHeader';
import ScrollableListPanel from '../../components/ui/ScrollableListPanel';
import AssetEmptyState from '../../components/assets/AssetEmptyState';
import {useConfirm} from '../../components/ui/useConfirm';
import {BIN_DAYS, daysLeft, isExpired} from '../../core/recycleBin';
import {getI18nLang, tr, trData} from '../../i18n';

const when = (iso: string) =>
  new Date(iso).toLocaleString(getI18nLang() === 'en' ? 'en-GB' : 'el-GR', {dateStyle: 'short', timeStyle: 'short'});

/** The Sets and instruments deleted in the last 30 days: each can be put back as it was, or deleted for good. */
export default function BinPage() {
  const {recycleBin, restoreFromBin, purgeFromBin, purgeExpiredBin} = useSurgi();
  const [confirm, ask] = useConfirm();
  // What stayed past its 30 days goes when the bin is opened.
  useEffect(() => {
    purgeExpiredBin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const entries = recycleBin.filter(entry => !isExpired(entry));
  return (
    <div className="tools-list-workspace">
      <PageHeader
        eyebrow={tr('ΔΙΑΓΡΑΦΕΣ')}
        title={tr('Κάδος')}
        description={tr(
          'Τα Σετ και τα εργαλεία που διαγράφηκαν μένουν εδώ {0} ημέρες και μπορούν να επανέλθουν όπως ήταν.',
          BIN_DAYS,
        )}
      />
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
              {entries.map(entry => (
                <tr key={entry.id}>
                  <td>
                    <span className="bin-kind">
                      {entry.kind === 'SET' ? <Layers3 size={14} /> : <Wrench size={14} />}
                      {entry.kind === 'SET' ? tr('Σετ') : tr('Εργαλείο')}
                    </span>
                  </td>
                  <td>
                    <strong>{entry.label}</strong>
                  </td>
                  <td>{entry.detail ? trData(entry.detail) : '—'}</td>
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
                        onClick={() =>
                          ask({
                            title: tr('Επαναφορά;'),
                            message: tr('Το «{0}» επανέρχεται όπως ήταν πριν τη διαγραφή.', entry.label),
                            confirmLabel: tr('Επαναφορά'),
                            onConfirm: () => restoreFromBin(entry.id),
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
                            message: tr('Το «{0}» διαγράφεται για πάντα και δεν θα μπορεί να επανέλθει.', entry.label),
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
              ))}
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
