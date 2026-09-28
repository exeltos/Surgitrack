import {useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction} from 'react';
import {useLocation} from 'react-router-dom';

/**
 * Coming back to a list (browser back or "Back to list") finds it as it was left: same filters,
 * same scroll position, and the record last opened from it highlighted.
 */

const STATE_KEY = 'surgitrack.list.state';
const SCROLL_KEY = 'surgitrack.list.scroll';
const VISITED_KEY = 'surgitrack.list.visited';
const DETAIL_PATH = /^\/(sets|tools)\/[^/]+$/;

const read = <T>(key: string): Record<string, T> => {
  try {
    return JSON.parse(sessionStorage.getItem(key) || '{}') as Record<string, T>;
  } catch {
    return {};
  }
};
const write = (key: string, value: unknown) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the list simply starts fresh next time.
  }
};

/** useState that the list keeps while the user opens a record and comes back. */
export function useRememberedState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const {pathname} = useLocation();
  const storageKey = `${pathname}|${key}`;
  const [value, setValue] = useState<T>(() => {
    const saved = read<T>(STATE_KEY)[storageKey];
    return saved === undefined ? initial : saved;
  });
  useEffect(() => {
    const all = read<unknown>(STATE_KEY);
    all[storageKey] = value;
    write(STATE_KEY, all);
  }, [storageKey, value]);
  return [value, setValue];
}

const scrollables = (root: Element) =>
  [...root.querySelectorAll<HTMLElement>('*')].filter(el => {
    const overflow = getComputedStyle(el).overflowY;
    return (overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight;
  });
/** A stable name for a scrolling element on a page: its classes plus its position among equals. */
const nameOf = (el: HTMLElement, all: HTMLElement[]) => {
  const same = all.filter(other => other.className === el.className);
  return `${el.className}#${same.indexOf(el)}`;
};

const ROW = 'tr, article, li, [role="row"], .ledger-row, .registry-row, .set-tool-row, .asset-row';

/** Mounted once in the app shell around the page content. */
export function useListMemory(contentRef: React.RefObject<HTMLElement>) {
  const location = useLocation();
  const path = location.pathname;
  const previous = useRef(path);

  // Remember scroll positions as the user scrolls.
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    let frame = 0;
    const onScroll = (event: Event) => {
      const target = event.target as HTMLElement;
      if (!(target instanceof HTMLElement) || !root.contains(target)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const all = read<Record<string, number>>(SCROLL_KEY);
        const positions = all[path] || {};
        positions[nameOf(target, scrollables(root))] = target.scrollTop;
        all[path] = positions;
        write(SCROLL_KEY, all);
      });
    };
    root.addEventListener('scroll', onScroll, true);
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener('scroll', onScroll, true);
    };
  }, [contentRef, path]);

  // Opening a record from a list: remember which one, for that list.
  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = path;
    if (from !== path && DETAIL_PATH.test(path)) {
      const visited = read<string>(VISITED_KEY);
      visited[from] = path;
      write(VISITED_KEY, visited);
    }
  }, [path]);

  // Arriving on a page: put its lists back where they were and mark the record last opened.
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const positions = read<Record<string, number>>(SCROLL_KEY)[path] || {};
    const visited = read<string>(VISITED_KEY)[path];
    let restored = Object.keys(positions).length === 0;
    let marked = !visited;
    let tries = 0;
    let timer = 0;
    const attempt = () => {
      tries += 1;
      if (!restored) {
        const all = scrollables(root);
        let pending = false;
        for (const [name, top] of Object.entries(positions)) {
          const el = all.find(candidate => nameOf(candidate, all) === name);
          if (!el) {
            pending = true;
            continue;
          }
          el.scrollTop = top;
          if (Math.abs(el.scrollTop - top) > 2 && el.scrollHeight - el.clientHeight < top) pending = true;
        }
        restored = !pending;
      }
      if (!marked) {
        const link = root.querySelector<HTMLElement>(`a[href="#${visited}"]`);
        if (link) {
          const row = link.closest<HTMLElement>(ROW) || link;
          root.querySelectorAll('.row-last-visited').forEach(el => el.classList.remove('row-last-visited'));
          row.classList.add('row-last-visited');
          if (Object.keys(positions).length === 0) row.scrollIntoView({block: 'nearest'});
          marked = true;
        }
      }
      if ((!restored || !marked) && tries < 30) timer = window.setTimeout(attempt, 50);
    };
    timer = window.setTimeout(attempt, 0);
    return () => window.clearTimeout(timer);
  }, [contentRef, path]);
}
