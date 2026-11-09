import {useEffect, useState} from 'react';
import {isFinished, planFor} from '../../../core/cycleSimulator';
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
