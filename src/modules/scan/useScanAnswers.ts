import {useEffect, useState} from 'react';
import type {BarcodeFeedback} from '../../components/barcode/BarcodeCapture';
import {signalScan} from './scanSignal';

/** How many refused scans stay in view. */
const KEEP = 4;

/**
 * Answers each scan as it comes (a tone, a vibration) and keeps the refused ones in view, newest first,
 * so a red scan is not lost when the next one comes. `reset` clears them for a new round.
 */
export function useScanAnswers(feedback: BarcodeFeedback | null | undefined) {
  const [refused, setRefused] = useState<string[]>([]);
  useEffect(() => {
    if (!feedback) return;
    signalScan(feedback.type);
    if (feedback.type === 'ERROR') setRefused(list => [feedback.message, ...list].slice(0, KEEP));
  }, [feedback]);
  return {refused, reset: () => setRefused([])};
}
