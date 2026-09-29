import {lazy, type ComponentType} from 'react';

const RELOAD_KEY = 'surgitrack-chunk-reload';

/** A page file that failed to download, usually because a new version was published meanwhile. */
export const isChunkLoadError = (error: unknown) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch|ChunkLoadError|text\/html/i.test(
    String((error as {message?: string})?.message || error),
  );

/**
 * Reloads the page once to pick up the new version. Returns false when a reload happened in the
 * last 30 seconds, so a real outage shows an error instead of reloading forever.
 */
export function reloadForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Without a stored guard a reload could repeat forever: show the error instead.
    return false;
  }
  window.location.reload();
  return true;
}

/** Vite reports failed preloads of page files; reload to the new version instead of freezing. */
export function installChunkRecovery() {
  window.addEventListener('vite:preloadError', event => {
    if (reloadForNewVersion()) event.preventDefault();
  });
}

/** React.lazy that reloads once when the page file is gone after a new version was published. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same constraint as React.lazy
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{default: T}>) {
  return lazy(() =>
    load().catch(error => {
      if (isChunkLoadError(error) && reloadForNewVersion()) return new Promise<{default: T}>(() => {});
      throw error;
    }),
  );
}

/** Every kind of dialog backdrop in the app. */
const DIALOG_BACKDROPS = [
  '.modal-backdrop',
  '.movement-modal-backdrop',
  '.nested-modal-backdrop',
  '.studio-drawer-backdrop',
  '.camera-modal-backdrop',
  '.auth-info-backdrop',
].join(',');

/**
 * The dialog the user sees in front: the one under the middle of the screen, or else the one
 * with the highest z-index (document order and nesting break ties). Document order alone is not
 * enough: some pages render an overlay earlier in the page than the dialog it covers.
 */
function frontDialog(): HTMLElement | undefined {
  const hit = document.elementFromPoint?.(window.innerWidth / 2, window.innerHeight / 2);
  const underPointer = hit?.closest<HTMLElement>(DIALOG_BACKDROPS);
  if (underPointer) return underPointer;
  const visible = [...document.querySelectorAll<HTMLElement>(DIALOG_BACKDROPS)].filter(
    el => el.getClientRects().length > 0,
  );
  const zIndex = (el: HTMLElement) => Number.parseInt(getComputedStyle(el).zIndex, 10) || 0;
  const depth = (el: HTMLElement) => {
    let n = 0;
    for (let p = el.parentElement; p; p = p.parentElement) if (p.matches(DIALOG_BACKDROPS)) n++;
    return n;
  };
  return visible
    .map((el, order) => ({el, key: [zIndex(el), depth(el), order]}))
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2])
    .pop()?.el;
}

const CLOSE_LABELS = /^(Κλείσιμο|Ακύρωση|Close|Cancel|Άκυρο|Όχι|No)$/i;

/**
 * Escape closes the dialog in front, whichever it is: its × button, or else its Cancel / Close
 * button. Without this, a dialog without its own Escape handling stays open over the page and
 * its backdrop swallows every click, which looks like the app froze.
 */
export function installEscapeClosesDialogs() {
  window.addEventListener(
    'keydown',
    event => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const top = frontDialog();
      if (!top) return;
      const buttons = [...top.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
      const close =
        top.querySelector<HTMLButtonElement>('[data-modal-close]:not([disabled])') ||
        buttons.find(b => /^(Κλείσιμο|Close)/i.test(b.getAttribute('aria-label') || '')) ||
        buttons.find(b => CLOSE_LABELS.test((b.textContent || '').trim())) ||
        top.querySelector<HTMLButtonElement>('header .icon-button:not([disabled]), .modal-x:not([disabled])');
      event.preventDefault();
      event.stopImmediatePropagation();
      if (close) return close.click();
      // No close button inside (e.g. a drawer beside its backdrop): the backdrop itself closes it.
      top.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
      top.click();
    },
    true,
  );
}
