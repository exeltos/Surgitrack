/*
 * SurgiTrack service worker: lets the app (and the phone scanning app) open without a network after it was
 * opened once, and makes repeat visits start from the device.
 *
 *  - Only GET requests to this site are handled. Supabase (data, sign-in, files) and everything else on another
 *    origin never goes through here, so nothing about a person or a patient is ever stored by this file.
 *  - Pages (index.html, scan.html): the network first, so a new version reaches people at once; the last copy is
 *    used only when the network fails. It is kept under a fixed key, never under a URL, because the emailed
 *    invitation and password links carry one-time tokens in theirs.
 *  - /assets/* (named by content, so a file never changes), the help pictures and the icons: from the device
 *    first, fetched once.
 *  - Anything else (the PDF manuals, ...) is left to the browser.
 * Changing CACHE_VERSION drops what earlier versions of this file stored.
 */
const CACHE_VERSION = 'v1';
const CACHE = `surgitrack-${CACHE_VERSION}`;
/** Files kept; the oldest /assets/ files go first when a new release adds more. */
const MAX_FILES = 300;

const here = new URL(self.registration.scope);
const pageKey = path => new URL(path.endsWith('/scan.html') ? 'scan.html' : 'index.html', here).href;
const isPage = path => path.endsWith('/') || path.endsWith('/index.html') || path.endsWith('/scan.html');
const isStatic = path =>
  /\/(assets|help)\/[^/]+$/.test(path) ||
  /\/(favicon\.svg|scan-icon[^/]*|app\.webmanifest|scan\.webmanifest)$/.test(path);

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));

self.addEventListener('activate', event =>
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(key => key.startsWith('surgitrack-') && key !== CACHE).map(key => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  ),
);

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_FILES) return;
  const old = keys.filter(request => new URL(request.url).pathname.includes('/assets/'));
  await Promise.all(old.slice(0, keys.length - MAX_FILES + 50).map(request => cache.delete(request)));
}

async function page(request, path) {
  const cache = await caches.open(CACHE);
  const key = pageKey(path);
  try {
    const response = await fetch(request);
    // A page that came back whole is the new last copy; redirects and errors are passed on as they are.
    if (response.ok && response.status === 200) await cache.put(key, response.clone());
    return response;
  } catch (error) {
    const saved = await cache.match(key);
    if (saved) return saved;
    throw error;
  }
}

async function fromDevice(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok && response.status === 200) {
    await cache.put(request, response.clone());
    await trim(cache);
  }
  return response;
}

self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && isPage(url.pathname)) event.respondWith(page(request, url.pathname));
  else if (request.mode !== 'navigate' && isStatic(url.pathname)) event.respondWith(fromDevice(request));
});
