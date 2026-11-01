import {beforeEach, describe, expect, it} from 'vitest';
import source from '../../../public/sw.js?raw';

/** public/sw.js run against a stand-in for the browser: a Map for the cache and a scripted network. */
const ORIGIN = 'https://app.test';

type Listener = (event: unknown) => void;
type Handled = {respondWith: (p: Promise<Response>) => void};

const setup = () => {
  const stores = new Map<string, Map<string, Response>>();
  const listeners: Record<string, Listener> = {};
  const network = {online: true, calls: [] as string[], status: 200};
  const keyOf = (request: Request | string) => (typeof request === 'string' ? request : request.url);
  const cacheOf = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      match: async (request: Request | string) => store.get(keyOf(request))?.clone(),
      put: async (request: Request | string, response: Response) => void store.set(keyOf(request), response),
      delete: async (request: Request | string) => store.delete(keyOf(request)),
      keys: async () => [...store.keys()].map(url => ({url}) as Request),
    };
  };
  const self = {
    registration: {scope: `${ORIGIN}/`},
    location: {origin: ORIGIN},
    skipWaiting: async () => undefined,
    clients: {claim: async () => undefined},
    addEventListener: (type: string, fn: Listener) => void (listeners[type] = fn),
  };
  const scope = {
    self,
    URL,
    Response,
    caches: {
      open: async (name: string) => cacheOf(name),
      keys: async () => [...stores.keys()],
      delete: async (name: string) => stores.delete(name),
    },
    // Like the real fetch: an address or a request.
    fetch: async (request: {url: string} | string) => {
      const url = typeof request === 'string' ? request : request.url;
      network.calls.push(url);
      if (!network.online) throw new TypeError('Failed to fetch');
      return new Response(`body of ${url}`, {status: network.status});
    },
  };
  // The worker's own code, with the browser's globals handed in by name.
  new Function(...Object.keys(scope), source)(...Object.values(scope));
  /** Sends a request through the worker: the response it chose to give, or undefined when it left it alone. */
  const send = async (url: string, init: {method?: string; mode?: string} = {}) => {
    const real = new Request(url, {method: init.method || 'GET'});
    // A Request's mode cannot be set, so the worker gets one that reads like it.
    const request = {url: real.url, method: real.method, mode: init.mode || 'cors', clone: () => real};
    let given: Promise<Response> | undefined;
    listeners.fetch({request, respondWith: (p: Promise<Response>) => (given = p)} as Handled);
    return given && (await given);
  };
  return {stores, network, send, listeners};
};

let sw: ReturnType<typeof setup>;
beforeEach(() => {
  sw = setup();
});

describe('service worker', () => {
  it('opens a page offline from its last copy, found online first', async () => {
    const online = await sw.send(`${ORIGIN}/index.html`, {mode: 'navigate'});
    expect(await online?.text()).toContain('index.html');
    sw.network.online = false;
    const offline = await sw.send(`${ORIGIN}/`, {mode: 'navigate'});
    expect(await offline?.text()).toContain('index.html');
  });

  it('keeps the phone app and the full app apart', async () => {
    await sw.send(`${ORIGIN}/scan.html`, {mode: 'navigate'});
    sw.network.online = false;
    expect(await (await sw.send(`${ORIGIN}/scan.html`, {mode: 'navigate'}))?.text()).toContain('scan.html');
    await expect(sw.send(`${ORIGIN}/index.html`, {mode: 'navigate'})).rejects.toThrow('Failed to fetch');
  });

  it('prefers the network, so a new version is not hidden by an old copy', async () => {
    await sw.send(`${ORIGIN}/index.html`, {mode: 'navigate'});
    sw.network.calls.length = 0;
    await sw.send(`${ORIGIN}/index.html`, {mode: 'navigate'});
    expect(sw.network.calls).toEqual([`${ORIGIN}/index.html`]);
  });

  it('never stores a one-time link: pages are kept under a fixed key, not their address', async () => {
    await sw.send(`${ORIGIN}/index.html?st_token=secret&type=invite`, {mode: 'navigate'});
    const keys = [...sw.stores.get('surgitrack-v1')!.keys()];
    expect(keys).toEqual([`${ORIGIN}/index.html`]);
  });

  it('does not store error pages', async () => {
    sw.network.status = 500;
    await sw.send(`${ORIGIN}/index.html`, {mode: 'navigate'});
    expect(sw.stores.get('surgitrack-v1')?.size ?? 0).toBe(0);
  });

  it('serves built files from the device after the first time', async () => {
    await sw.send(`${ORIGIN}/assets/main-abc123.js`);
    sw.network.calls.length = 0;
    sw.network.online = false;
    expect(await (await sw.send(`${ORIGIN}/assets/main-abc123.js`))?.text()).toContain('main-abc123.js');
    expect(sw.network.calls).toEqual([]);
  });

  it('leaves everything else alone: other sites (Supabase), writes, the PDF manuals', async () => {
    expect(await sw.send('https://project.supabase.co/rest/v1/sets')).toBeUndefined();
    expect(await sw.send(`${ORIGIN}/assets/main-abc123.js`, {method: 'POST'})).toBeUndefined();
    expect(await sw.send(`${ORIGIN}/manuals/SurgiTrack-manual-el.pdf`, {mode: 'navigate'})).toBeUndefined();
    expect(await sw.send(`${ORIGIN}/manuals/SurgiTrack-manual-el.pdf`)).toBeUndefined();
    expect(await sw.send(`${ORIGIN}/api/anything`)).toBeUndefined();
    expect(sw.network.calls).toEqual([]);
  });

  /** The page that registered the worker tells it what it loaded; resolves when the worker has finished. */
  const warm = (urls: string[]) =>
    new Promise<void>(resolve => {
      sw.listeners.message({
        data: {type: 'warm', urls},
        waitUntil: (p: Promise<unknown>) => void p.then(() => resolve()),
      });
    });

  it('on the first visit, keeps the page and the files it loaded, so one visit is enough to open offline', async () => {
    await warm([`${ORIGIN}/index.html`, `${ORIGIN}/assets/main-abc123.js`, `${ORIGIN}/assets/react-def456.js`]);
    sw.network.online = false;
    expect(await (await sw.send(`${ORIGIN}/`, {mode: 'navigate'}))?.text()).toContain('index.html');
    expect(await (await sw.send(`${ORIGIN}/assets/main-abc123.js`))?.text()).toContain('main-abc123.js');
  });

  it('on the first visit never takes a one-time link, another site, or a file it does not handle', async () => {
    await warm([
      `${ORIGIN}/index.html?st_token=secret&st_link=invite`,
      'https://project.supabase.co/rest/v1/sets',
      `${ORIGIN}/manuals/SurgiTrack-manual-el.pdf`,
      'not an address',
    ]);
    expect(sw.network.calls).toEqual([`${ORIGIN}/index.html`]);
    expect([...sw.stores.get('surgitrack-v1')!.keys()]).toEqual([`${ORIGIN}/index.html`]);
  });

  it('ignores any other message', async () => {
    sw.listeners.message({data: {type: 'something else'}, waitUntil: () => undefined});
    sw.listeners.message({data: null, waitUntil: () => undefined});
    expect(sw.network.calls).toEqual([]);
  });

  it('drops what earlier versions stored when it takes over', async () => {
    sw.stores.set('surgitrack-v0', new Map([['old', new Response('x')]]));
    sw.stores.set('another-app', new Map());
    await new Promise<void>(resolve => {
      sw.listeners.activate({waitUntil: (p: Promise<unknown>) => void p.then(() => resolve())});
    });
    expect([...sw.stores.keys()]).toEqual(['another-app']);
  });
});
