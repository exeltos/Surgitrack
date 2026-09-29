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
    // Storage unavailable: reload anyway, the browser cache makes a loop unlikely.
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
      const backdrops = [...document.querySelectorAll<HTMLElement>('.modal-backdrop')].filter(
        el => el.offsetParent !== null || getComputedStyle(el).position === 'fixed',
      );
      const top = backdrops[backdrops.length - 1];
      if (!top) return;
      const buttons = [...top.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
      const close =
        top.querySelector<HTMLButtonElement>('[data-modal-close]:not([disabled])') ||
        buttons.find(b => /^(Κλείσιμο|Close)/i.test(b.getAttribute('aria-label') || '')) ||
        buttons.find(b => CLOSE_LABELS.test((b.textContent || '').trim())) ||
        top.querySelector<HTMLButtonElement>('header .icon-button:not([disabled]), .modal-x:not([disabled])');
      if (!close) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close.click();
    },
    true,
  );
}
