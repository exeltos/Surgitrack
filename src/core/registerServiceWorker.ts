/**
 * Registers public/sw.js (both the full app and the phone scanning app run through main.tsx), once the page has
 * loaded so it never competes with the first screen. Built versions only: during development a cached app would
 * hide every change. A browser without service workers, or a failed registration, just means no offline start.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const register = () =>
    void navigator.serviceWorker
      .register('./sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(registration => {
        // This page loaded before the worker controlled it: tell the worker what it used, so the first visit
        // already makes the app available offline.
        const used = performance.getEntriesByType('resource').map(entry => entry.name);
        registration.active?.postMessage({type: 'warm', urls: [location.href, ...used]});
      })
      .catch(() => undefined);
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, {once: true});
}
