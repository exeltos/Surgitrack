import {useState} from 'react';
import {
  CheckCircle2,
  Flame,
  FlaskConical,
  Hourglass,
  ListTree,
  PackageCheck,
  Printer,
  TriangleAlert,
} from 'lucide-react';
import {getRuntimeDataMode} from '../../../config/dataMode';
import {useSurgi} from '../../../store/SurgiStore';
import {useConfirm} from '../../../components/ui/useConfirm';
import {MIN_HOLD_PRESSURE} from '../../../core/cycleSimulator';
import {tr, trData} from '../../../i18n';
import type {ProcessLoadRecord} from '../../../types/domain';
import LoadDetailsDialog from './LoadDetailsDialog';
import {phaseText} from './cycleLabels';
import {liveOf, simulationRunning, useNow} from './simulationClock';

/**
 * The loads in the sterilizer right now, one row each: the sterilizer and cycle, the program, where the cycle is
 * (live for a simulated one: phase, temperature, pressure, progress), what is in it, and the actions. «Λεπτομέρειες»
 * opens the load's card with its Sets and instruments. Their Sets and instruments are locked until the end of
 * the cycle. «Στον κλίβανο» only shows them; Release (with `onFinish`) records the end of the cycle: «Τέλος κύκλου»
 * makes the load ready to release, «Αποτυχία κύκλου» sends the whole load back.
 */
export default function SterilizerLoads({
  loads,
  canFinish = false,
  onFinish,
  onPrint,
  onReport,
}: {
  loads: ProcessLoadRecord[];
  canFinish?: boolean;
  onFinish?: (loadId: string, result: 'PASSED' | 'FAILED') => void;
  onPrint?: (loadId: string) => void;
  onReport?: (loadId: string) => void;
}) {
  const [confirm, ask] = useConfirm();
  const {can} = useSurgi();
  // In the Demo, a load with no simulation can be given one (opened in its card, with the scenarios).
  const canSimulate = getRuntimeDataMode() === 'DEMO' && can('sterilization.cycle');
  const [openId, setOpenId] = useState('');
  // A simulated cycle still running: the clock re-renders the rows (and the buttons when it ends).
  const now = useNow(loads.some(load => !!load.simulation));
  if (!loads.length && !onFinish)
    return (
      <div className="empty ster-empty">
        <PackageCheck size={32} />
        <strong>{tr('Κανένας κλίβανος σε λειτουργία')}</strong>
        <span>{tr('Μετά τη «Φόρτωση κλιβάνου» το φορτίο εμφανίζεται εδώ μέχρι το τέλος του κύκλου.')}</span>
      </div>
    );
  if (!loads.length) return null;
  const opened = loads.find(load => load.id === openId);
  return (
    <div className="sterilizer-rows-wrap">
      {confirm}
      <table className="sterilizer-rows">
        <thead>
          <tr>
            <th>{tr('Κλίβανος')}</th>
            <th>{tr('Πρόγραμμα')}</th>
            <th>{tr('Κατάσταση')}</th>
            <th>{tr('Θερμοκρασία')}</th>
            <th>{tr('Πίεση')}</th>
            <th>{tr('Πρόοδος')}</th>
            <th>{tr('Αντικείμενα')}</th>
            <th>
              <span className="sr-only">{tr('Ενέργειες')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {loads.map(load => {
            const live = liveOf(load, now);
            const running = simulationRunning(load, now);
            return (
              <tr key={load.id} className={live?.done ? 'done' : 'busy'}>
                <td data-label={tr('Κλίβανος')}>
                  <span className="row-name">
                    {live?.done ? <Hourglass size={16} aria-hidden="true" /> : <Flame size={16} aria-hidden="true" />}
                    <b>{trData(load.equipment)}</b>
                  </span>
                  <small>
                    {tr('Κύκλος')} {load.cycleNumber}
                  </small>
                </td>
                <td data-label={tr('Πρόγραμμα')}>
                  {load.program}
                  <small>{tr('Φορτώθηκε {0} από {1}', load.createdAt, trData(load.createdByName))}</small>
                </td>
                <td data-label={tr('Κατάσταση')}>
                  <span className={`row-phase${live?.done ? ' done' : ''}`}>
                    {live ? phaseText(live.sample.phase) : tr('Σε εξέλιξη')}
                  </span>
                  {load.simulation && <small>{tr('Προσομοίωση')}</small>}
                </td>
                <td data-label={tr('Θερμοκρασία')} className="num">
                  {live ? `${live.sample.temperature.toFixed(1)} °C` : '—'}
                </td>
                <td data-label={tr('Πίεση')} className="num">
                  {live ? (
                    <span
                      className={
                        live.sample.phase === 'HOLDING' && live.sample.pressure < MIN_HOLD_PRESSURE ? 'bad' : ''
                      }
                    >
                      {live.sample.pressure.toFixed(2)} bar
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td data-label={tr('Πρόοδος')}>
                  {live ? (
                    <>
                      <div
                        className="tile-progress"
                        role="progressbar"
                        aria-valuenow={live.progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={tr('Πρόοδος κύκλου')}
                      >
                        <i style={{width: `${live.progress}%`}} />
                      </div>
                      <small>{tr('{0} / {1} λεπτά', Math.floor(live.minute), Math.ceil(live.end))}</small>
                    </>
                  ) : (
                    <small>{tr('Χωρίς ζωντανά δεδομένα')}</small>
                  )}
                </td>
                <td data-label={tr('Αντικείμενα')} className="num">
                  {load.items.length}
                </td>
                <td className="row-actions">
                  <div className="row-actions-inner">
                    {canSimulate && !load.simulation && (
                      <button className="row-details" onClick={() => setOpenId(load.id)}>
                        <FlaskConical size={15} /> {tr('Προσομοίωση')}
                      </button>
                    )}
                    <button className="row-details" onClick={() => setOpenId(load.id)}>
                      <ListTree size={15} /> {tr('Λεπτομέρειες')}
                    </button>
                    {onFinish && (
                      <>
                        {onPrint && (
                          <button
                            className="row-icon"
                            title={tr('Έντυπο')}
                            aria-label={tr('Έντυπο')}
                            onClick={() => onPrint(load.id)}
                          >
                            <Printer size={15} />
                          </button>
                        )}
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
                              onConfirm: () => onFinish(load.id, 'FAILED'),
                            })
                          }
                        >
                          <TriangleAlert size={15} /> {tr('Αποτυχία κύκλου')}
                        </button>
                        <button
                          className="primary"
                          disabled={!canFinish || running}
                          title={running ? tr('Ο κύκλος τρέχει ακόμα') : undefined}
                          onClick={() => onFinish(load.id, 'PASSED')}
                        >
                          <CheckCircle2 size={15} /> {tr('Τέλος κύκλου')}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {opened && (
        <LoadDetailsDialog load={opened} onClose={() => setOpenId('')} onPrint={onPrint} onReport={onReport} />
      )}
    </div>
  );
}
