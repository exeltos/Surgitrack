import {useState} from 'react';
import {Activity, FlaskConical, Play, ShieldAlert, ShieldCheck} from 'lucide-react';
import {useSurgi} from '../../../store/SurgiStore';
import {getRuntimeDataMode} from '../../../config/dataMode';
import {
  MIN_HOLD_PRESSURE,
  curve,
  currentSample,
  elapsedMinutes,
  endMinute,
  evaluate,
  isFinished,
  planFor,
  type CycleProblem,
  type SimScenario,
} from '../../../core/cycleSimulator';
import type {ProcessLoadRecord} from '../../../types/domain';
import {tr} from '../../../i18n';
import {useNow} from './simulationClock';
import CycleChart from './CycleChart';
import {phaseText} from './cycleLabels';

const problemText = (problem: CycleProblem) =>
  problem === 'ABORTED'
    ? tr('Ο κύκλος διακόπηκε από συναγερμό του κλιβάνου.')
    : problem === 'LOW_PRESSURE'
      ? tr('Η πίεση έπεσε κάτω από το όριο κατά τη διάρκεια της αποστείρωσης.')
      : tr('Η θερμοκρασία δεν κρατήθηκε για όσο χρόνο απαιτεί το πρόγραμμα.');

const scenarios = (): Array<{id: SimScenario; label: string}> => [
  {id: 'PASS', label: tr('Επιτυχής κύκλος')},
  {id: 'LOW_PRESSURE', label: tr('Πτώση πίεσης')},
  {id: 'ABORTED', label: tr('Διακοπή από συναγερμό')},
];

/**
 * A load in the sterilizer: in the Demo a simulated cycle can be started here; its temperature, pressure and
 * phase follow the clock (core/cycleSimulator) until the cycle ends, when it says whether the parameters
 * were kept. Ending the load records the readings with it.
 */
export default function CycleMonitor({load}: {load: ProcessLoadRecord}) {
  const {startCycleSimulation, can} = useSurgi();
  const [scenario, setScenario] = useState<SimScenario>('PASS');
  const run = load.simulation;
  const now = useNow(!!run);
  if (!run) {
    if (getRuntimeDataMode() !== 'DEMO' || !can('sterilization.cycle')) return null;
    return (
      <div className="cycle-monitor cycle-monitor-start">
        <FlaskConical size={16} aria-hidden="true" />
        <span>{tr('Δεν έχει συνδεθεί κλίβανος: δοκιμάστε έναν εικονικό κύκλο.')}</span>
        <select
          value={scenario}
          aria-label={tr('Σενάριο κύκλου')}
          onChange={event => setScenario(event.target.value as SimScenario)}
        >
          {scenarios().map(item => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <button type="button" className="primary compact" onClick={() => startCycleSimulation(load.id, scenario)}>
          <Play size={14} /> {tr('Έναρξη προσομοίωσης')}
        </button>
      </div>
    );
  }
  const plan = planFor(load.program);
  const end = endMinute(plan, run.scenario);
  const finished = isFinished(run, plan, now);
  const sample = currentSample(run, plan, now);
  const minute = Math.min(elapsedMinutes(run, now), end);
  const verdict = finished ? evaluate(plan, curve(plan, run.scenario)) : undefined;
  return (
    <div className={`cycle-monitor${finished ? ' done' : ''}`}>
      <div className="cycle-monitor-head">
        <Activity size={16} aria-hidden="true" />
        <strong>{phaseText(sample.phase)}</strong>
        <span className="cycle-monitor-sim">
          <FlaskConical size={12} /> {tr('Προσομοίωση')}
        </span>
        <small>
          {Math.floor(minute)} / {Math.ceil(end)} {tr('λεπτά')}
        </small>
      </div>
      <div className="cycle-monitor-body">
        <dl className="cycle-readings">
          <div>
            <dt>{tr('Θερμοκρασία')}</dt>
            <dd>{sample.temperature.toFixed(1)} °C</dd>
          </div>
          <div>
            <dt>{tr('Πίεση')}</dt>
            <dd className={sample.phase === 'HOLDING' && sample.pressure < MIN_HOLD_PRESSURE ? 'bad' : ''}>
              {sample.pressure.toFixed(2)} bar
            </dd>
          </div>
          <div>
            <dt>{tr('Πρόγραμμα')}</dt>
            <dd>
              {plan.setpoint}°C · {plan.holdMinutes} {tr('λεπτά')}
            </dd>
          </div>
        </dl>
        <div className="cycle-chart-wrap">
          <CycleChart load={load} now={now} />
          <p className="cycle-chart-legend">
            <span className="temp">{tr('Θερμοκρασία')}</span>
            <span className="pressure">{tr('Πίεση')}</span>
            <span className="limit">{tr('Ελάχιστη πίεση {0} bar', MIN_HOLD_PRESSURE.toFixed(1))}</span>
          </p>
        </div>
      </div>
      {verdict && (
        <div className={`cycle-verdict ${verdict.result === 'PASS' ? 'ok' : 'bad'}`} role="status">
          {verdict.result === 'PASS' ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
          <span>
            {verdict.result === 'PASS'
              ? tr(
                  'Οι παράμετροι τηρήθηκαν: μέγιστη {0} °C, πίεση {1} bar, {2} λεπτά αποστείρωσης.',
                  verdict.maxTemperature.toFixed(1),
                  verdict.maxPressure.toFixed(2),
                  verdict.holdMinutes,
                )
              : verdict.problems.map(problemText).join(' ') + ' ' + tr('Προτείνεται «Αποτυχία κύκλου».')}
          </span>
        </div>
      )}
    </div>
  );
}
