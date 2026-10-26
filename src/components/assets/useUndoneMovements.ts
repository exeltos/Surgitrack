import {useMemo} from 'react';
import {useSurgi} from '../../store/SurgiStore';
import {undoneIds} from '../../core/movementUndo';

/** The ids of the movements that were undone later (history marks them «Αναιρέθηκε»). */
export function useUndoneMovements() {
  const {movements} = useSurgi();
  return useMemo(() => undoneIds(movements), [movements]);
}
