import {useLayoutEffect, useRef} from 'react';

/**
 * Keeps a wide table inside its box without sideways scrolling. Texts first wrap only between words;
 * when even that does not fit, the box gets the `fit-tight` class (tighter cells, words may break).
 * Re-checked when the box resizes and whenever `deps` change.
 */
export function useFitWidth<T extends HTMLElement>(deps: readonly unknown[]) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const check = () => {
      box.classList.remove('fit-tight');
      const table = box.querySelector('table');
      if (table && table.scrollWidth > box.clientWidth + 1) box.classList.add('fit-tight');
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(box);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
