import {useEffect, useRef} from 'react';
import Spinner from './Spinner';

/** End of a progressive list (a table row, or a block with `colSpan` omitted): loads the next rows when it scrolls into view. */
export function MoreRows({colSpan, onVisible}: {colSpan?: number; onVisible: () => void}) {
  const ref = useRef<HTMLTableRowElement & HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      onVisible();
      return;
    }
    const observer = new IntersectionObserver(entries => entries.some(e => e.isIntersecting) && onVisible(), {
      rootMargin: '400px 0px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible]);
  if (colSpan === undefined)
    return (
      <div ref={ref} className="more-rows">
        <Spinner />
      </div>
    );
  return (
    <tr ref={ref} className="more-rows">
      <td colSpan={colSpan}>
        <Spinner />
      </td>
    </tr>
  );
}
