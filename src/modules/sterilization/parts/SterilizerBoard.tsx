import {Flame, FlaskConical, Hourglass, Power} from 'lucide-react';
import {
  MIN_HOLD_PRESSURE,
  currentSample,
  elapsedMinutes,
  endMinute,
  isFinished,
  planFor,
  type CyclePhase,
} from '../../../core/cycleSimulator';
import type {ProcessLoadRecord} from '../../../types/domain';
import {tr, trData} from '../../../i18n';
import {useNow} from './simulationClock';

const phaseText = (phase: CyclePhase) =>
  phase === 'HEATING'
    ? tr('Προθέρμανση')
    : phase === 'HOLDING'
      ? tr('Αποστείρωση')
      : phase === 'DRYING'
        ? tr('Στέγνωμα')
        : phase === 'ABORTED'
          ? tr('Διακοπή κύκλου')
          : tr('Ολοκληρώθηκε');

/**
 * All the hospital's sterilizers on one screen: each is free, or runs a load with its phase, readings and
 * progress (live for a simulated cycle). The details of each load are in its card below.
 */
export default function SterilizerBoard({names, loads}: {names: string[]; loads: ProcessLoadRecord[]}) {
  const now = useNow(loads.some(load => !!load.simulation));
  // A sterilizer the library does not list but a load runs in still shows.
  const all = [...names, ...loads.map(load => load.equipment).filter(name => !names.includes(name))];
  const unique = [...new Set(all)];
  const running = loads.length;
  return (
    <section className="sterilizer-board" aria-label={tr('Κλίβανοι')}>
      <header>
        <strong>{tr('Κλίβανοι')}</strong>
        <small>
          {running
            ? tr('{0} σε λειτουργία · {1} ελεύθεροι', running, Math.max(unique.length - running, 0))
            : tr('Όλοι ελεύθεροι')}
        </small>
      </header>
      <div className="sterilizer-board-grid">
        {unique.map(name => {
          const load = loads.find(item => item.equipment === name);
          if (!load)
            return (
              <article key={name} className="sterilizer-tile free">
                <div className="tile-head">
                  <Power size={16} aria-hidden="true" />
                  <strong>{trData(name)}</strong>
                </div>
                <span className="tile-state">{tr('Ελεύθερος')}</span>
              </article>
            );
          const run = load.simulation;
          const plan = planFor(load.program);
          const sample = run ? currentSample(run, plan, now) : undefined;
          const end = run ? endMinute(plan, run.scenario) : 0;
          const minute = run ? Math.min(elapsedMinutes(run, now), end) : 0;
          const done = !!run && isFinished(run, plan, now);
          const progress = run ? Math.round((minute / end) * 100) : 0;
          return (
            <article key={name} className={`sterilizer-tile busy${done ? ' done' : ''}`}>
              <div className="tile-head">
                {done ? <Hourglass size={16} aria-hidden="true" /> : <Flame size={16} aria-hidden="true" />}
                <strong>{trData(name)}</strong>
                {run && (
                  <span className="tile-sim">
                    <FlaskConical size={11} /> {tr('Προσομοίωση')}
                  </span>
                )}
              </div>
              <span className="tile-state">
                {sample ? phaseText(sample.phase) : tr('Κύκλος σε εξέλιξη')} · {tr('Κύκλος')} {load.cycleNumber}
              </span>
              {sample ? (
                <>
                  <div className="tile-readings">
                    <b>{sample.temperature.toFixed(1)} °C</b>
                    <b className={sample.phase === 'HOLDING' && sample.pressure < MIN_HOLD_PRESSURE ? 'bad' : ''}>
                      {sample.pressure.toFixed(2)} bar
                    </b>
                  </div>
                  <div
                    className="tile-progress"
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={tr('Πρόοδος κύκλου')}
                  >
                    <i style={{width: `${progress}%`}} />
                  </div>
                  <small>
                    {done
                      ? tr('Ο κύκλος τελείωσε: αναμένει «Τέλος κύκλου»')
                      : tr('{0} / {1} λεπτά', Math.floor(minute), Math.ceil(end))}
                  </small>
                </>
              ) : (
                <small>{tr('Χωρίς ζωντανά δεδομένα')}</small>
              )}
              <small className="tile-load">
                {load.program} · {load.items.length} {tr('αντικείμενα')}
              </small>
            </article>
          );
        })}
      </div>
    </section>
  );
}
