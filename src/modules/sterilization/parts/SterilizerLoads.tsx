import {useState} from 'react';
import {Link} from 'react-router-dom';
import {CheckCircle2, Hourglass, Lock, PackageCheck, Printer, TriangleAlert} from 'lucide-react';
import AssetTypeIcon from '../../../components/assets/AssetTypeIcon';
import {useConfirm} from '../../../components/ui/useConfirm';
import {tr, trData} from '../../../i18n';
import type {ProcessLoadRecord} from '../../../types/domain';

/**
 * The loads in the sterilizer right now. Their Sets and instruments are locked (read-only) until the end
 * of the cycle: "End of cycle" sends the load to release, "Cycle failed" sends the whole load back.
 */
export default function SterilizerLoads({
  loads,
  canFinish,
  onFinish,
  onPrint,
}: {
  loads: ProcessLoadRecord[];
  canFinish: boolean;
  onFinish: (loadId: string, result: 'PASSED' | 'FAILED', note?: string) => void;
  onPrint: (loadId: string) => void;
}) {
  const [confirm, ask] = useConfirm();
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (!loads.length)
    return (
      <div className="empty ster-empty">
        <PackageCheck size={32} />
        <strong>{tr('Κανένας κλίβανος σε λειτουργία')}</strong>
        <span>{tr('Μετά τη «Φόρτωση κλιβάνου» το φορτίο εμφανίζεται εδώ μέχρι το τέλος του κύκλου.')}</span>
      </div>
    );
  return (
    <div className="sterilizer-loads">
      {confirm}
      {loads.map(load => {
        const indicators = [
          load.chemicalIndicatorResult !== undefined && tr('Χημικός'),
          load.biologicalIndicatorResult === 'PENDING' && tr('Βιολογικός'),
        ].filter(Boolean);
        return (
          <section
            key={load.id}
            className="sterilizer-load-card"
            aria-label={`${load.equipment} · ${load.cycleNumber}`}
          >
            <header>
              <span className="sterilizer-load-icon">
                <Hourglass size={18} />
              </span>
              <div>
                <strong>
                  {trData(load.equipment)} · {tr('Κύκλος')} {load.cycleNumber}
                </strong>
                <small>
                  {load.program} · {tr('Φορτώθηκε {0} από {1}', load.createdAt, trData(load.createdByName))}
                  {indicators.length ? ` · ${tr('Δείκτες')}: ${indicators.join(', ')}` : ''}
                </small>
              </div>
              <span className="sterilizer-load-badge">
                <Lock size={13} /> {tr('Σε εξέλιξη')}
              </span>
            </header>
            <ul className="sterilizer-load-items">
              {load.items.map(item => (
                <li key={`${item.assetKind}:${item.assetId}`}>
                  <AssetTypeIcon kind={item.assetKind} size={15} />
                  <Link
                    className="mono"
                    to={item.assetKind === 'SET' ? `/sets/${item.assetId}` : `/tools/${item.assetId}`}
                  >
                    {item.barcode}
                  </Link>
                  <b>{item.assetName}</b>
                  <small>{trData(item.department)}</small>
                </li>
              ))}
            </ul>
            <footer>
              <input
                value={notes[load.id] || ''}
                onChange={e => setNotes(current => ({...current, [load.id]: e.target.value}))}
                placeholder={tr('Παρατήρηση τέλους κύκλου (προαιρετικά)…')}
                aria-label={tr('Παρατήρηση τέλους κύκλου')}
                disabled={!canFinish}
              />
              <button className="sterilizer-load-print" onClick={() => onPrint(load.id)}>
                <Printer size={15} /> {tr('Έντυπο')}
              </button>
              <button
                className="release-reprocess"
                disabled={!canFinish}
                onClick={() =>
                  ask({
                    title: tr('Αποτυχία κύκλου;'),
                    message: tr(
                      'Όλο το φορτίο ({0} αντικείμενα) θα επιστρέψει σε επανεπεξεργασία. Η ενέργεια καταγράφεται στο ιστορικό.',
                      load.items.length,
                    ),
                    confirmLabel: tr('Αποτυχία κύκλου'),
                    danger: true,
                    onConfirm: () => onFinish(load.id, 'FAILED', notes[load.id]),
                  })
                }
              >
                <TriangleAlert size={15} /> {tr('Αποτυχία κύκλου')}
              </button>
              <button
                className="primary"
                disabled={!canFinish}
                onClick={() => onFinish(load.id, 'PASSED', notes[load.id])}
              >
                <CheckCircle2 size={15} /> {tr('Τέλος κύκλου · {0}', load.items.length)}
              </button>
            </footer>
          </section>
        );
      })}
    </div>
  );
}
