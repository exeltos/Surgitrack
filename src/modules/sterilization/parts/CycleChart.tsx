import {MIN_HOLD_PRESSURE, curve, elapsedMinutes, endMinute, planFor} from '../../../core/cycleSimulator';
import type {ProcessLoadRecord} from '../../../types/domain';
import {tr} from '../../../i18n';

const W = 320;
const H = 96;

/** The planned curve (faint) and what has happened so far (solid): temperature, and pressure under it. */
export default function CycleChart({load, now}: {load: ProcessLoadRecord; now: number}) {
  const run = load.simulation!;
  const plan = planFor(load.program);
  const end = endMinute(plan, run.scenario);
  const done = Math.min(elapsedMinutes(run, now), end);
  const x = (minute: number) => (minute / end) * W;
  const tY = (temperature: number) => H - 6 - ((temperature - 20) / (plan.setpoint + 6 - 20)) * (H - 14);
  const pY = (pressure: number) => H - 6 - (pressure / 2.6) * (H - 14);
  const line = (points: Array<[number, number]>) =>
    points.map(([px, py], index) => `${index ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const planned = curve(plan, run.scenario);
  const made = curve(plan, run.scenario, done);
  const holdFrom = x(plan.heatMinutes);
  const holdTo = x(Math.min(plan.heatMinutes + plan.holdMinutes, end));
  return (
    <svg
      className="cycle-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={tr('Καμπύλη θερμοκρασίας και πίεσης του κύκλου')}
    >
      <rect className="cycle-chart-hold" x={holdFrom} y={0} width={Math.max(holdTo - holdFrom, 0)} height={H} />
      <line className="cycle-chart-limit" x1={0} x2={W} y1={pY(MIN_HOLD_PRESSURE)} y2={pY(MIN_HOLD_PRESSURE)} />
      <path className="cycle-chart-plan" d={line(planned.map(s => [x(s.minute), tY(s.temperature)]))} />
      <path className="cycle-chart-plan" d={line(planned.map(s => [x(s.minute), pY(s.pressure)]))} />
      <path className="cycle-chart-temp" d={line(made.map(s => [x(s.minute), tY(s.temperature)]))} />
      <path className="cycle-chart-pressure" d={line(made.map(s => [x(s.minute), pY(s.pressure)]))} />
    </svg>
  );
}
