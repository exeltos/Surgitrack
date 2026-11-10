import {describe, expect, it} from 'vitest';
import {
  buildCycleData,
  currentSample,
  curve,
  elapsedMinutes,
  endMinute,
  evaluate,
  isFinished,
  planFor,
  ranMinutes,
  type SimRun,
} from '../cycleSimulator';

describe('planFor', () => {
  it('reads the program', () => {
    expect(planFor('134°C · 5 min')).toMatchObject({setpoint: 134, holdMinutes: 5});
    expect(planFor('121°C · 15 min')).toMatchObject({setpoint: 121, holdMinutes: 15});
  });
  it('falls back to 134°C for 5 minutes', () => {
    expect(planFor('Πρόγραμμα 1')).toMatchObject({setpoint: 134, holdMinutes: 5});
  });
});

describe('evaluate', () => {
  const plan = planFor('134°C · 5 min');
  it('passes a normal cycle', () => {
    const result = evaluate(plan, curve(plan, 'PASS'));
    expect(result.result).toBe('PASS');
    expect(result.holdMinutes).toBeGreaterThanOrEqual(5);
    expect(result.maxTemperature).toBeGreaterThanOrEqual(134);
    expect(result.problems).toEqual([]);
  });
  it('fails when the pressure drops during the hold', () => {
    const result = evaluate(plan, curve(plan, 'LOW_PRESSURE'));
    expect(result.result).toBe('FAIL');
    expect(result.problems).toContain('LOW_PRESSURE');
  });
  it('fails a cycle an alarm stopped', () => {
    const result = evaluate(plan, curve(plan, 'ABORTED'));
    expect(result.result).toBe('FAIL');
    expect(result.problems).toContain('ABORTED');
    expect(endMinute(plan, 'ABORTED')).toBeLessThan(endMinute(plan, 'PASS'));
  });
});

describe('a run over time', () => {
  const plan = planFor('134°C · 5 min');
  const run: SimRun = {scenario: 'PASS', startedAt: 1_000_000, speed: 20};
  it('is a function of the clock: simulated minutes pass faster than real ones', () => {
    expect(elapsedMinutes(run, 1_000_000)).toBe(0);
    expect(elapsedMinutes(run, 1_000_000 + 60_000)).toBe(20);
  });
  it('heats, holds, dries and ends', () => {
    expect(currentSample(run, plan, 1_000_000).phase).toBe('HEATING');
    expect(currentSample(run, plan, 1_000_000 + 25_000).phase).toBe('HOLDING'); // minute ~8
    expect(isFinished(run, plan, 1_000_000 + 10_000)).toBe(false);
    expect(isFinished(run, plan, 1_000_000 + 61_000)).toBe(true);
    expect(currentSample(run, plan, 1_000_000 + 90_000).phase).toBe('DONE');
  });
  it('counts the minutes it really ran, never more than its length, even when the end is recorded a day later', () => {
    expect(ranMinutes(run, plan, 1_000_000 + 30_000)).toBe(10);
    expect(ranMinutes(run, plan, 1_000_000 + 24 * 3_600_000)).toBe(endMinute(plan, 'PASS'));
    const aborted: SimRun = {...run, scenario: 'ABORTED'};
    expect(ranMinutes(aborted, plan, 1_000_000 + 24 * 3_600_000)).toBe(endMinute(plan, 'ABORTED'));
  });
  it('marks a stopped cycle as aborted', () => {
    const aborted: SimRun = {...run, scenario: 'ABORTED'};
    expect(currentSample(aborted, plan, 1_000_000 + 60_000).phase).toBe('ABORTED');
  });
});

describe('buildCycleData', () => {
  it('keeps the summary and a one-minute curve, marked as a simulation', () => {
    const data = buildCycleData('134°C · 5 min', 'PASS', '09/11/2026 10:00', '09/11/2026 10:20');
    expect(data).toMatchObject({source: 'SIMULATION', result: 'PASS', setpoint: 134, requiredHoldMinutes: 5});
    expect(data.curve.length).toBeGreaterThan(15);
    expect(data.curve[0][0]).toBe(0);
  });
});
