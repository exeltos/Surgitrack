import {useEffect, useState} from 'react';
import {currentSample, elapsedMinutes, endMinute, isFinished, planFor} from '../../../core/cycleSimulator';
import type {ProcessLoadRecord} from '../../../types/domain';

/** The clock of a running simulation: re-renders twice a second while `active`. */
export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

/** Whether a load in the sterilizer has a simulated cycle that is still running. */
export const simulationRunning = (load: ProcessLoadRecord, now: number) =>
  !!load.simulation && !isFinished(load.simulation, planFor(load.program), now);

/** What a simulated cycle reads right now (undefined for a load with no simulation). */
export function liveOf(load: ProcessLoadRecord, now: number) {
  const run = load.simulation;
  if (!run) return undefined;
  const plan = planFor(load.program);
  const end = endMinute(plan, run.scenario);
  const minute = Math.min(elapsedMinutes(run, now), end);
  return {
    sample: currentSample(run, plan, now),
    end,
    minute,
    done: isFinished(run, plan, now),
    progress: Math.round((minute / end) * 100),
  };
}
