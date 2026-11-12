/**
 * How the app holds up at a large hospital's size, in a real browser against the mocked Supabase of the
 * screens harness (scripts/screens/mock-supabase.mjs) filled with the sample hospital many times over.
 *
 *   node scripts/scale/bench.mjs [--tools 20000,50000,100000] [--rebuild]
 *
 * For each size, as the Sterilization user, it measures:
 *  - opening: from loading the page until the app shows its first screen with the data, the data downloaded
 *    and the memory the page holds afterwards;
 *  - one change made on another device arriving (the app's look for changes), on the Overview and on the
 *    instruments list: the time the main thread is blocked (long tasks) until the screen shows it;
 *  - typing in the instruments list's search.
 * Builds the app once, not minified (node_modules/.cache/surgitrack-scale/dist; --rebuild makes it again).
 * --profile: also prints where the main thread spent its time while a change arrived on the Overview.
 */
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {
  ACCOUNTS,
  ORG_ID,
  STORAGE_KEY,
  SUPABASE_URL,
  createDatabase,
  fakeSession,
  handleRealtime,
  handleSupabase,
} from '../screens/mock-supabase.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const CACHE = join(ROOT, 'node_modules/.cache/surgitrack-scale');
// Not minified, so a profile names the app's own functions.
const DIST = join(CACHE, 'dist');
const argv = process.argv.slice(2);
const option = (name, fallback) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback);
const SIZES = option('tools', '20000,50000,100000').split(',').map(Number);
/** Instruments in one copy of the sample hospital (SCREENS_SCALE multiplies it). */
const PER_COPY = 325;

function build() {
  if (!argv.includes('--rebuild') && existsSync(join(DIST, 'index.html'))) return;
  console.log('Building the app…');
  const result = spawnSync(
    process.execPath,
    [
      join(ROOT, 'node_modules/vite/bin/vite.js'),
      'build',
      '--outDir',
      DIST,
      '--emptyOutDir',
      '--minify',
      'false',
      '--logLevel',
      'warn',
    ],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_SUPABASE_URL: SUPABASE_URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_placeholder',
      },
    },
  );
  if (result.status !== 0) throw new Error('vite build failed');
}

let seedModule;
async function loadSeed(scale) {
  if (!seedModule) {
    const esbuild = await import('esbuild');
    const outfile = join(CACHE, 'seed.mjs');
    mkdirSync(CACHE, {recursive: true});
    await esbuild.build({
      entryPoints: [join(ROOT, 'scripts/screens/seed-entry.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      jsx: 'automatic',
      define: {'import.meta.env': '{}'},
      logLevel: 'warning',
    });
    seedModule = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
  }
  return seedModule.buildSeed(ORG_ID, scale);
}

const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml'};
function serve() {
  const server = createServer((req, res) => {
    let file = join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
    res.writeHead(200, {'content-type': TYPES[extname(file)] || 'application/octet-stream'});
    res.end(readFileSync(file));
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok(server)));
}

/** Total main-thread time in long tasks (over 50 ms) while `run` lasts, and the longest one. */
async function blocked(page, run) {
  await page.evaluate(() => {
    window.__long = [];
    window.__observer?.disconnect();
    window.__observer = new PerformanceObserver(list => window.__long.push(...list.getEntries().map(e => e.duration)));
    window.__observer.observe({type: 'longtask'});
  });
  const started = Date.now();
  await run();
  const wall = Date.now() - started;
  await page.waitForTimeout(300);
  const tasks = await page.evaluate(() => window.__long);
  return {
    wall,
    blocked: Math.round(tasks.reduce((sum, t) => sum + t, 0)),
    longest: Math.round(Math.max(0, ...tasks)),
  };
}

async function bench(browser, base, tools) {
  const seed = await loadSeed(Math.max(1, Math.round(tools / PER_COPY)));
  const db = createDatabase(seed);
  const account = ACCOUNTS.STERILIZATION;
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, locale: 'el-GR'});
  await context.addInitScript(
    ({key, session}) => {
      if (sessionStorage.getItem('__init')) return;
      sessionStorage.setItem('__init', '1');
      localStorage.setItem('surgitrack-lang', 'el');
      localStorage.setItem(key, JSON.stringify(session));
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      localStorage.setItem(`surgitrack-seen-version:${session.user.id}`, '999.0.0');
      localStorage.setItem(`surgitrack-briefing-seen:${session.user.id}`, today);
      localStorage.setItem(`surgitrack-screen-guides:${session.user.id}`, JSON.stringify({off: true, screens: []}));
    },
    {key: STORAGE_KEY, session: fakeSession(account)},
  );
  let downloaded = 0;
  // Looks for changed instruments that brought one back (the change reached the app).
  let taken = 0;
  await context.route(
    url => url.hostname.endsWith('.supabase.co'),
    async route => {
      const r = route.request();
      const answer = handleSupabase(db, account, {
        method: r.method(),
        url: r.url(),
        headers: r.headers(),
        body: r.postData(),
      });
      downloaded += answer.body ? Buffer.byteLength(answer.body) : 0;
      if (/\/rest\/v1\/instruments\?.*updated_at\.gte/.test(decodeURIComponent(r.url())) && answer.body?.length > 2)
        taken++;
      await route.fulfill(answer);
    },
  );
  await context.route(
    url => !['127.0.0.1', 'localhost'].includes(url.hostname) && !url.hostname.endsWith('.supabase.co'),
    route => route.abort('blockedbyclient'),
  );
  await context.routeWebSocket(/supabase\.co\/realtime/, ws => handleRealtime(ws));
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const heap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const {metrics} = await cdp.send('Performance.getMetrics');
    return Math.round(metrics.find(m => m.name === 'JSHeapUsedSize').value / 1e6);
  };

  // Opening: the wall time, and how much of it the page's own main thread was busy (the rest is the mocked
  // server answering, which a real one does in parallel and much faster).
  let serverMs = 0;
  // The browser's own count of main-thread time (Chromium's Performance metrics, in seconds).
  const busyTime = async () => {
    const {metrics} = await cdp.send('Performance.getMetrics');
    return metrics.find(m => m.name === 'TaskDuration').value;
  };
  const open = async reload => {
    serverMs = 0;
    const busyBefore = await busyTime();
    const started = Date.now();
    if (reload) await page.reload();
    else await page.goto(base + '#/');
    await page
      .waitForFunction(
        () =>
          // The app is open (a list's own «more rows» spinner at its end does not count).
          ![...document.querySelectorAll('.app-spinner-wrap')].some(el => !el.closest('.more-rows')) &&
          document.querySelector('main'),
        null,
        {
          timeout: Number(process.env.OPEN_TIMEOUT || 300000),
        },
      )
      .catch(async error => {
        // What the page shows when it does not open (SHOT=<file.png> also saves a screenshot).
        if (process.env.SHOT) await page.screenshot({path: process.env.SHOT});
        console.log((await page.evaluate(() => document.body.innerText)).slice(0, 600));
        throw error;
      });
    await page.waitForLoadState('networkidle', {timeout: 60000}).catch(() => undefined);
    const ms = Date.now() - started;
    return {ms, busy: Math.round(((await busyTime()) - busyBefore) * 1000), serverMs};
  };
  const first = await open();
  const openMs = first.ms;
  const heapMb = await heap();
  const instruments = db.instruments.length;

  // One instrument changed on another device: the app's look for changes takes it in (focus triggers it).
  const remoteChange = async label => {
    const row = db.instruments[Math.floor(db.instruments.length / 2)];
    row.notes = `${label} ${Date.now()}`;
    row.updated_at = new Date().toISOString();
    return blocked(page, async () => {
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.waitForTimeout(2500);
    });
  };
  const profiling = argv.includes('--profile');
  if (profiling) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.start');
  }
  const onOverview = await remoteChange('overview');
  const hot = profiling ? hotspots((await cdp.send('Profiler.stop')).profile) : undefined;
  const reachedOverview = taken;
  await page.evaluate(() => (location.hash = '#/tools'));
  await page.waitForTimeout(3000);
  const onList = await remoteChange('list');
  const search = page.locator('.asset-filter-search input').first();
  const typing = (await search.count())
    ? await blocked(page, async () => {
        await search.pressSequentially('Kocher', {delay: 80});
        await page.waitForTimeout(1500);
      })
    : undefined;
  const reached = reachedOverview > 0 && taken > reachedOverview;
  // Opening again on the same device: from this device's copy, fetching only what changed since.
  await page.evaluate(() => (location.hash = '#/'));
  await page.waitForTimeout(3000);
  const again = await open(true);
  await context.close();
  return {
    hot,
    first,
    again,
    tools: instruments,
    openMs,
    downloadedMb: Math.round(downloaded / 1e6),
    heapMb,
    onOverview,
    onList,
    typing,
    reached,
  };
}

/** The functions with the most time of their own in a CPU profile, with their share. */
function hotspots(profile) {
  const self = new Map();
  const dt = profile.timeDeltas;
  const byId = new Map(profile.nodes.map(n => [n.id, n]));
  const time = new Map();
  profile.samples.forEach((id, i) => time.set(id, (time.get(id) || 0) + (dt[i] || 0)));
  let total = 0;
  for (const [id, us] of time) {
    const {callFrame: f} = byId.get(id);
    if (
      ['(idle)', '(program)', '(garbage collector)'].includes(f.functionName) &&
      f.functionName !== '(garbage collector)'
    )
      continue;
    const key = `${f.functionName || '(anonymous)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`;
    self.set(key, (self.get(key) || 0) + us);
    total += us;
  }
  // Who calls the busiest function: its callers' chain, three deep.
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n);
  const name = n =>
    `${n.callFrame.functionName || '(anonymous)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`;
  const top = [...self].sort((a, b) => b[1] - a[1])[0]?.[0];
  const chains = new Map();
  for (const [id, us] of time) {
    let n = byId.get(id);
    if (name(n) !== top) continue;
    const chain = [];
    for (let k = 0; k < 4 && parent.get(n.id); k++) chain.push(name((n = parent.get(n.id))));
    const key = chain.join(' ← ');
    chains.set(key, (chains.get(key) || 0) + us);
  }
  const callers = [...chains]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, us]) => `${String(Math.round(us / 1000)).padStart(6)} ms       ↳ called from ${key}`);
  return [...self]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(
      ([key, us]) =>
        `${String(Math.round(us / 1000)).padStart(6)} ms ${((100 * us) / total).toFixed(0).padStart(3)}%  ${key}`,
    )
    .concat(callers);
}

async function main() {
  build();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {}),
  });
  try {
    for (const size of SIZES) {
      const r = await bench(browser, base, size);
      const t = x => (x ? `${x.blocked} ms blocked (longest ${x.longest} ms)` : 'n/a');
      console.log(
        `${String(r.tools).padStart(6)} instruments · open ${(r.openMs / 1000).toFixed(1)} s · ${r.downloadedMb} MB downloaded · ` +
          `${r.heapMb} MB memory\n` +
          `        opening: page busy ${(r.first.busy / 1000).toFixed(1)} s, mocked server ${(r.first.serverMs / 1000).toFixed(1)} s; ` +
          `again from the device's copy ${(r.again.ms / 1000).toFixed(1)} s (page busy ${(r.again.busy / 1000).toFixed(1)} s)\n` +
          `        a change from another device: Overview ${t(r.onOverview)}; instruments list ${t(r.onList)}\n` +
          `        typing a search in the list: ${t(r.typing)}` +
          (r.reached
            ? ''
            : '\n        (the change from another device was not seen arriving: check the look for changes)') +
          (r.hot ? `\n        where the time went (Overview):\n          ${r.hot.join('\n          ')}` : ''),
      );
    }
  } finally {
    await browser.close();
    server.close();
  }
}
await main();
