/**
 * A simulated sterilizer cycle, for the Demo and for trying the flow without a real autoclave.
 *
 * The cycle is a pure function of time: a run keeps only when it started, the scenario and how much faster
 * than real time it runs, so the live view, a reload and the finished record all draw the same curve. The
 * values are made up and always marked «Προσομοίωση»; they never pass for a device's data.
 */

export type SimScenario = 'PASS' | 'LOW_PRESSURE' | 'ABORTED';

/** What a run keeps: when it started (epoch ms), the scenario and the speed (simulated seconds per second). */
export type SimRun = {scenario: SimScenario; startedAt: number; speed: number};

export type CyclePlan = {
  /** Holding temperature (°C) and how long it must be held (minutes). */
  setpoint: number;
  holdMinutes: number;
  heatMinutes: number;
  dryMinutes: number;
};

export type CyclePhase = 'HEATING' | 'HOLDING' | 'DRYING' | 'ABORTED' | 'DONE';

export type CycleSample = {minute: number; temperature: number; pressure: number; phase: CyclePhase};

/** The rule a cycle is judged by: temperature and pressure kept for the whole hold. */
export const MIN_HOLD_PRESSURE = 2.0;
/** The default speed: a 20-minute cycle runs in about a minute. */
export const DEFAULT_SPEED = 20;

const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

/** The plan of a program written like «134°C · 5 min» (anything else runs the common 134°C for 5 minutes). */
export function planFor(program: string): CyclePlan {
  const temperature = /(\d{2,3})\s*°?\s*C/i.exec(program);
  const minutes = /(\d{1,2})\s*(?:min|λεπτ|')/i.exec(program);
  const setpoint = temperature ? Math.min(Math.max(Number(temperature[1]), 110), 140) : 134;
  const holdMinutes = minutes ? Math.min(Math.max(Number(minutes[1]), 1), 30) : 5;
  return {setpoint, holdMinutes, heatMinutes: 6, dryMinutes: 9};
}

/** The minute the cycle ends: the planned end, or the alarm that stopped it. */
export function endMinute(plan: CyclePlan, scenario: SimScenario): number {
  if (scenario === 'ABORTED') return plan.heatMinutes + plan.holdMinutes * 0.4;
  return plan.heatMinutes + plan.holdMinutes + plan.dryMinutes;
}

/** One reading at a minute of the cycle (a steady, repeatable ripple stands in for the sensor's noise). */
export function sampleAt(plan: CyclePlan, scenario: SimScenario, minute: number): CycleSample {
  const t = Math.max(0, Math.min(minute, endMinute(plan, scenario)));
  const holdStart = plan.heatMinutes;
  const holdEnd = plan.heatMinutes + plan.holdMinutes;
  const ripple = Math.sin(t * 2.7);
  if (t < holdStart) {
    const x = t / holdStart;
    const ease = x * x * (3 - 2 * x);
    return {
      minute: t,
      temperature: round(25 + (plan.setpoint + 0.6 - 25) * ease),
      pressure: round(1 + 1.15 * ease, 2),
      phase: 'HEATING',
    };
  }
  if (t <= holdEnd) {
    let pressure = 2.15 + 0.03 * ripple;
    // The pressure falls below the limit for the middle of the hold, and recovers.
    if (
      scenario === 'LOW_PRESSURE' &&
      t >= holdStart + plan.holdMinutes * 0.4 &&
      t <= holdStart + plan.holdMinutes * 0.8
    )
      pressure = 1.55 + 0.04 * ripple;
    const phase: CyclePhase = scenario === 'ABORTED' && t >= endMinute(plan, scenario) ? 'ABORTED' : 'HOLDING';
    return {minute: t, temperature: round(plan.setpoint + 0.7 + 0.3 * ripple), pressure: round(pressure, 2), phase};
  }
  const x = (t - holdEnd) / plan.dryMinutes;
  return {
    minute: t,
    temperature: round(plan.setpoint + 0.7 - (plan.setpoint + 0.7 - 55) * x),
    pressure: round(2.15 - 1.95 * x, 2),
    phase: x >= 1 ? 'DONE' : 'DRYING',
  };
}

/** Simulated minutes since the run started. */
export const elapsedMinutes = (run: SimRun, now: number) =>
  Math.max(0, ((now - run.startedAt) / 1000) * (run.speed / 60));

/**
 * Simulated minutes the cycle really ran at `now`: never more than its own length, because the clock keeps
 * running after it ends (the end of a cycle recorded the next day is still a 20-minute cycle).
 */
export const ranMinutes = (run: SimRun, plan: CyclePlan, now: number) =>
  Math.min(elapsedMinutes(run, now), endMinute(plan, run.scenario));

export const isFinished = (run: SimRun, plan: CyclePlan, now: number) =>
  elapsedMinutes(run, now) >= endMinute(plan, run.scenario);

/** The reading at this moment (the last one once the cycle has ended; «ABORTED» when an alarm stopped it). */
export function currentSample(run: SimRun, plan: CyclePlan, now: number): CycleSample {
  const sample = sampleAt(plan, run.scenario, elapsedMinutes(run, now));
  if (run.scenario === 'ABORTED' && isFinished(run, plan, now)) return {...sample, phase: 'ABORTED'};
  return sample;
}

/** The readings from the start up to `minute` (the whole cycle by default), one per `step` minutes. */
export function curve(plan: CyclePlan, scenario: SimScenario, upTo = Infinity, step = 0.5): CycleSample[] {
  const end = Math.min(upTo, endMinute(plan, scenario));
  const out: CycleSample[] = [];
  for (let minute = 0; minute < end; minute += step) out.push(sampleAt(plan, scenario, minute));
  out.push(sampleAt(plan, scenario, end));
  return out;
}

export type CycleProblem = 'ABORTED' | 'LOW_PRESSURE' | 'SHORT_HOLD';

export type CycleEvaluation = {
  result: 'PASS' | 'FAIL';
  maxTemperature: number;
  maxPressure: number;
  /** Minutes the temperature and pressure were both in range. */
  holdMinutes: number;
  /** The lowest pressure during the hold (what the pressure rule is judged by). */
  minHoldPressure: number;
  problems: CycleProblem[];
};

/** Whether the readings kept the temperature and the pressure for the whole hold. */
export function evaluate(plan: CyclePlan, samples: readonly CycleSample[], step = 0.5): CycleEvaluation {
  const inRange = samples.filter(s => s.temperature >= plan.setpoint && s.pressure >= MIN_HOLD_PRESSURE);
  const held = inRange.length * step;
  const duringHold = samples.filter(
    s => s.minute >= plan.heatMinutes && s.minute <= plan.heatMinutes + plan.holdMinutes,
  );
  const problems: CycleProblem[] = [];
  if (samples.some(s => s.phase === 'ABORTED')) problems.push('ABORTED');
  if (duringHold.some(s => s.pressure < MIN_HOLD_PRESSURE)) problems.push('LOW_PRESSURE');
  if (held < plan.holdMinutes && !problems.includes('ABORTED') && !problems.includes('LOW_PRESSURE'))
    problems.push('SHORT_HOLD');
  return {
    result: problems.length ? 'FAIL' : 'PASS',
    maxTemperature: Math.max(0, ...samples.map(s => s.temperature)),
    maxPressure: Math.max(0, ...samples.map(s => s.pressure)),
    holdMinutes: round(held),
    minHoldPressure: duringHold.length ? Math.min(...duringHold.map(s => s.pressure)) : 0,
    problems,
  };
}

/** What a finished cycle keeps with its load (for the cycle report): the summary and a one-minute curve. */
export type CycleData = {
  source: 'SIMULATION' | 'DEVICE';
  startedAt: string;
  endedAt: string;
  program: string;
  setpoint: number;
  requiredHoldMinutes: number;
  result: 'PASS' | 'FAIL';
  problems: CycleProblem[];
  maxTemperature: number;
  maxPressure: number;
  holdMinutes: number;
  /** The lowest pressure during the hold (absent in data kept before it was recorded). */
  minHoldPressure?: number;
  /** [minute, °C, bar] once a minute. */
  curve: Array<[number, number, number]>;
};

export function buildCycleData(
  program: string,
  scenario: SimScenario,
  startedAt: string,
  endedAt: string,
  /** Simulated minutes the cycle ran before it ended (less than its length when someone stopped it). */
  upTo = Infinity,
): CycleData {
  const plan = planFor(program);
  const samples = curve(plan, scenario, upTo);
  const evaluation = evaluate(plan, samples);
  return {
    source: 'SIMULATION',
    startedAt,
    endedAt,
    program,
    setpoint: plan.setpoint,
    requiredHoldMinutes: plan.holdMinutes,
    result: evaluation.result,
    problems: evaluation.problems,
    maxTemperature: evaluation.maxTemperature,
    maxPressure: evaluation.maxPressure,
    holdMinutes: evaluation.holdMinutes,
    minHoldPressure: evaluation.minHoldPressure,
    curve: samples.filter(s => Number.isInteger(s.minute)).map(s => [s.minute, s.temperature, s.pressure]),
  };
}
