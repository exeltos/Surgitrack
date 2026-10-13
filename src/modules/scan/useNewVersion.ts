import {useEffect, useRef} from 'react';

/** The published script of the page: «assets/main-AbC123.js». */
const SCRIPT = /assets\/main-[\w-]+\.js/;

const runningScript = () =>
  [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')]
    .map(script => SCRIPT.exec(script.src)?.[0])
    .find(Boolean);

/**
 * A phone keeps the app open in the background for days. When it comes back to the front and a newer
 * version has been published, the app reloads into it, but only while `idle` (on the stations, never in
 * the middle of a round): otherwise as soon as the round is over.
 */
export function useNewVersion(idle: boolean) {
  const pending = useRef(false);
  const idleRef = useRef(idle);
  idleRef.current = idle;

  useEffect(() => {
    const running = runningScript();
    if (!running) return;
    const check = async () => {
      if (document.visibilityState !== 'visible' || pending.current) return;
      try {
        const page = await fetch(window.location.pathname, {cache: 'no-store'});
        const published = SCRIPT.exec(await page.text())?.[0];
        if (!published || published === running) return;
        pending.current = true;
        if (idleRef.current) window.location.reload();
      } catch {
        // Offline: checked again the next time the app comes to the front.
      }
    };
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);

  useEffect(() => {
    if (idle && pending.current) window.location.reload();
  }, [idle]);
}
