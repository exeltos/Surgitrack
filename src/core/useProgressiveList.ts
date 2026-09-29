import {useEffect, useRef} from 'react';
import {useRememberedState} from './listMemory';

const STEP = 150;

/**
 * Long lists (thousands of instruments) render the first rows at once and the rest as the user
 * scrolls, with a spinner at the end while more are on the way. The count shown is remembered, so
 * coming back to the list restores the same rows (and the scroll position into them).
 */
export function useProgressiveList<T>(items: T[], resetKey: string, name = 'shown') {
  const [count, setCount] = useRememberedState(name, STEP);
  const firstKey = useRef(resetKey);
  useEffect(() => {
    // New filters or search: start again from the top rows.
    if (firstKey.current === resetKey) return;
    firstKey.current = resetKey;
    setCount(STEP);
  }, [resetKey, setCount]);
  return {
    visible: items.length > count ? items.slice(0, count) : items,
    hasMore: items.length > count,
    showMore: () => setCount(c => c + STEP),
  };
}
