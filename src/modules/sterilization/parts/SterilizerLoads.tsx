import {SortTh} from '../../../components/ui/SortHeader';
import {useTableSort} from '../../../components/ui/useTableSort';
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
import {formatDate} from '../../../core/displayDate';

/** What the load holds, by kind: «2 Σετ · 3 εργαλεία». */
const contentText = (load: ProcessLoadRecord) => {
  const sets = load.items.filter(item => item.assetKind === 'SET').length;
  const tools = load.items.length - sets;
  return [sets ? tr('{0} Σετ', sets) : '', tools ? tr('{0} εργαλεία', tools) : ''].filter(Boolean).join(' · ');
};

/**
 * The loads in the sterilizer right now, one row each: the sterilizer and cycle, the program (when and by whom it was
 * loaded), where the cycle is (live for a simulated or connected one: phase, progress, temperature and pressure), what
 * is in it, and the actions. The row (or «Λεπτομέρειες») opens the load's card with its Sets and instruments, which
 * are locked until the end of the cycle. With `onFinish` («Στον κλίβανο») the end of the cycle is recorded here:
 * «Τέλος κύκλου» makes the load ready to release, «Αποτυχία κύκλου» sends the whole load back.
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
  const order = useTableSort(loads, {
    equipment: load => load.equipment,
    program: load => load.program,
    items: load => load.items.length,
  });
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
  // The day is said only when it is not today.
  const today = formatDate(new Date());
  const loadedAt = (at: string) => (at.startsWith(today) ? at.slice(today.length).trim() : at);
  return (
    <div className="sterilizer-rows-wrap">
      {confirm}
      <table className="sterilizer-rows">
        <thead>
          <tr>
            <SortTh label={tr('Κλίβανος')} sortKey="equipment" sort={order.sort} onSort={order.toggle} />
            <SortTh label={tr('Πρόγραμμα')} sortKey="program" sort={order.sort} onSort={order.toggle} />
            <th>{tr('Κύκλος')}</th>
            <SortTh label={tr('Αντικείμενα')} sortKey="items" sort={order.sort} onSort={order.toggle} />
            <th>
              <span className="sr-only">{tr('Ενέργειες')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {order.rows.map(load => {
            const live = liveOf(load, now);
            const running = simulationRunning(load, now);
            return (
              <tr
                key={load.id}
                className={`${live?.done ? 'done' : 'busy'} row-opens`}
                title={tr('Λεπτομέρειες')}
                onClick={() => setOpenId(load.id)}
              >
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
                  <small>
                    {loadedAt(load.createdAt)} · {trData(load.createdByName)}
                  </small>
                </td>
                <td data-label={tr('Κύκλος')} className="row-cycle">
                  {live ? (
                    <>
                      <span className="row-cycle-line">
                        <span className={`row-phase${live.done ? ' done' : ''}`}>{phaseText(live.sample.phase)}</span>
                        <span className="num">{live.sample.temperature.toFixed(1)} °C</span>
                        <span
                          className={`num${
                            live.sample.phase === 'HOLDING' && live.sample.pressure < MIN_HOLD_PRESSURE ? ' bad' : ''
                          }`}
                        >
                          {live.sample.pressure.toFixed(2)} bar
                        </span>
                      </span>
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
                      <small>
                        {tr('{0} / {1} λεπτά', Math.floor(live.minute), Math.ceil(live.end))}
                        {load.simulation ? ` · ${tr('Προσομοίωση')}` : ''}
                      </small>
                    </>
                  ) : canSimulate && !load.simulation ? (
                    // Demo: the cycle can be simulated, in the load's card (where the scenario is chosen); its data then
                    // shows here.
                    <button className="row-simulate" onClick={() => setOpenId(load.id)}>
                      <FlaskConical size={14} /> {tr('Προσομοίωση')}
                    </button>
                  ) : (
                    <small>{tr('Χωρίς ζωντανά δεδομένα')}</small>
                  )}
                </td>
                <td data-label={tr('Αντικείμενα')}>{contentText(load)}</td>
                {/* The buttons act on their own: a click on them does not open the card too. */}
                <td className="row-actions" onClick={e => e.stopPropagation()}>
                  <div className="row-actions-inner">
                    <button
                      className="row-icon"
                      title={tr('Λεπτομέρειες')}
                      aria-label={tr('Λεπτομέρειες')}
                      onClick={() => setOpenId(load.id)}
                    >
                      <ListTree size={15} />
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
                          data-tour="cycle-end"
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
