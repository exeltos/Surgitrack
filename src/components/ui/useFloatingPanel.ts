import {useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject} from 'react';

/**
 * A panel that opens under its button but floats over the page (fixed), so a card or list with scrolling or
 * clipped edges cannot cut it off. It opens upwards when there is no room below, stays inside the screen's width,
 * and closes on an outside click, Escape, or when the page or a list scrolls or the window changes size.
 *
 * Give `wrap` to the element holding the button and the panel, `panel` to the panel, and `place` as its style.
 */
export function useFloatingPanel(open: boolean, close: () => void, align: 'left' | 'right' = 'right') {
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<CSSProperties>();

  useLayoutEffect(() => {
    if (!open) {
      setPlace(undefined);
      return;
    }
    const toggle = wrap.current?.querySelector('button');
    const menu = panel.current;
    if (!toggle || !menu) return;
    const button = toggle.getBoundingClientRect();
    // Where «fixed 0,0» lands: the screen's corner, unless an ancestor with a filter or transform holds the panel.
    Object.assign(menu.style, {position: 'fixed', top: '0px', left: '0px', right: 'auto'});
    const {left: originX, top: originY, width, height} = menu.getBoundingClientRect();
    const gap = 8;
    const below = button.bottom + gap + height <= window.innerHeight - 8 || button.top - gap - height < 8;
    const wanted = align === 'right' ? button.right - width : button.left;
    setPlace({
      position: 'fixed',
      top: (below ? button.bottom + gap : button.top - gap - height) - originY,
      left: Math.max(8, Math.min(wanted, window.innerWidth - width - 8)) - originX,
      right: 'auto',
    });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onMove = (e: Event) => {
      if (!panel.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, close]);

  return {wrap, panel, place} as {
    wrap: RefObject<HTMLDivElement>;
    panel: RefObject<HTMLDivElement>;
    place: CSSProperties | undefined;
  };
}
