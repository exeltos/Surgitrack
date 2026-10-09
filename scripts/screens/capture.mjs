#!/usr/bin/env node
/**
 * Screenshot harness: builds the app with placeholder Supabase settings, serves the build locally, mocks
 * the whole Supabase project in the browser (see mock-supabase.mjs) and captures every route for every
 * role that can open it, at desktop and mobile size. See README.md.
 *
 *   node scripts/screens/capture.mjs [--lang el|en] [--role ADMIN,STERILIZATION,...|all]
 *        [--viewport desktop|mobile|both] [--out dir] [--only route] [--rebuild] [--no-extras]
 */
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {
  ACCOUNTS,
  JOIN_TOKEN,
  ORG_ID,
  STORAGE_KEY,
  SUPABASE_URL,
  createDatabase,
  fakeSession,
  handleRealtime,
  handleSupabase,
} from './mock-supabase.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const CACHE = join(ROOT, 'node_modules/.cache/surgitrack-screens');
const DIST = join(CACHE, 'dist');

// ---------- arguments
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const next = argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
};
const LANG = arg('lang', 'el') === 'en' ? 'en' : 'el';
const ALL_ROLES = ['ADMIN', 'STERILIZATION', 'SUPERVISOR', 'DEPARTMENT', 'VIEWER', 'PLATFORM'];
const roleArg = String(arg('role', 'all')).toUpperCase();
const ROLES = roleArg === 'ALL' ? ALL_ROLES : roleArg.split(',').filter(r => ALL_ROLES.includes(r));
const VIEWPORTS = {desktop: {width: 1440, height: 900}, mobile: {width: 390, height: 844}};
const vpArg = String(arg('viewport', 'both'));
const VIEWPORT_NAMES = vpArg === 'both' ? Object.keys(VIEWPORTS) : vpArg.split(',').filter(v => VIEWPORTS[v]);
const OUT = resolve(String(arg('out', join(CACHE, 'out'))));
const ONLY = arg('only', undefined);
const REBUILD = !!arg('rebuild', false);
const EXTRAS = !arg('no-extras', false);
const SETTLE_MS = Number(arg('settle', 600));
// Tallest screenshot: long lists (hundreds of instruments) are cut here rather than producing 20,000px images.
const MAX_HEIGHT = Number(arg('max-height', 4000));

// ---------- build
function build() {
  if (!REBUILD && existsSync(join(DIST, 'index.html'))) {
    console.log(`Using existing build in ${DIST} (pass --rebuild to rebuild).`);
    return;
  }
  console.log('Building the app (vite build, placeholder Supabase settings)…');
  const result = spawnSync(
    process.execPath,
    [join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', DIST, '--emptyOutDir', '--logLevel', 'warn'],
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

/** The Demo sample hospital as table rows, computed by the app's own code (bundled with esbuild). */
async function loadSeed() {
  const esbuild = await import('esbuild');
  const outfile = join(CACHE, 'seed.mjs');
  mkdirSync(CACHE, {recursive: true});
  await esbuild.build({
    entryPoints: [join(HERE, 'seed-entry.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    jsx: 'automatic',
    define: {'import.meta.env': '{}'},
    logLevel: 'warning',
  });
  const mod = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
  return mod.buildSeed(ORG_ID);
}

/** The routes declared in App.tsx with the permission each needs. */
function appRoutes() {
  const source = readFileSync(join(ROOT, 'src/app/App.tsx'), 'utf8');
  const routes = [];
  const re = /<Route\s+path="([^"]+)"\s+element=\{\s*<Guard permission="([^"]+)"/g;
  for (let m; (m = re.exec(source));) routes.push({path: m[1], permission: m[2]});
  return routes;
}

const slug = route =>
  route
    .replace(/^\//, '')
    .replace(/\?tab=/, '-tab-')
    .replace(/\/:id$/, '-detail')
    .replace(/[/?=&]+/g, '-') || 'home';

// ---------- static server
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
};
function serve() {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = join(DIST, path);
    if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
    res.writeHead(200, {'content-type': TYPES[extname(file)] || 'application/octet-stream'});
    res.end(readFileSync(file));
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok(server)));
}

// ---------- browser helpers
async function newContext(browser, {viewport, account, db, log}) {
  const context = await browser.newContext({
    viewport: VIEWPORTS[viewport],
    deviceScaleFactor: 1,
    isMobile: viewport === 'mobile',
    hasTouch: viewport === 'mobile',
    locale: LANG === 'el' ? 'el-GR' : 'en-GB',
    timezoneId: 'Europe/Athens',
    reducedMotion: 'reduce',
  });
  const session = account ? fakeSession(account) : null;
  await context.addInitScript(
    ({lang, key, session}) => {
      if (sessionStorage.getItem('__harness_init')) return;
      sessionStorage.setItem('__harness_init', '1');
      localStorage.setItem('surgitrack-lang', lang);
      localStorage.setItem('surgitrack-motion', '1');
      if (session) localStorage.setItem(key, JSON.stringify(session));
      else localStorage.removeItem(key);
    },
    {lang: LANG, key: STORAGE_KEY, session},
  );
  // Every Supabase call is answered here; anything else off this machine is refused (and logged).
  await context.route(
    url => url.hostname.endsWith('.supabase.co'),
    async route => {
      const request = route.request();
      const response = handleSupabase(db, account, {
        method: request.method(),
        url: request.url(),
        headers: request.headers(),
        body: request.postData(),
      });
      if (response.status >= 400 && response.status !== 406)
        log.mock.push(`${request.method()} ${new URL(request.url()).pathname} -> ${response.status}`);
      await route.fulfill(response);
    },
  );
  await context.route(
    url => !['127.0.0.1', 'localhost'].includes(url.hostname) && !url.hostname.endsWith('.supabase.co'),
    route => {
      log.blocked.push(route.request().url());
      return route.abort('blockedbyclient');
    },
  );
  await context.routeWebSocket(/supabase\.co\/realtime/, ws => handleRealtime(ws));
  return context;
}

function attachLogging(page, log) {
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning')
      log.console.push(`[${msg.type()}] ${msg.text()}`.slice(0, 600));
  });
  page.on('pageerror', err => log.console.push(`[pageerror] ${err.message}`.slice(0, 600)));
  page.on('requestfailed', req => {
    const failure = req.failure()?.errorText || '';
    if (failure.includes('blockedbyclient')) return; // logged as blocked
    // Chromium reports a routed HEAD request as aborted even though the page receives the answer
    // (the pending-requests badge shows the count): a harness artifact, not an app failure.
    if (req.method() === 'HEAD' && req.url().includes('.supabase.co') && failure.includes('ERR_ABORTED')) return;
    log.failed.push(`${req.method()} ${req.url()} (${failure})`);
  });
  page.on('response', res => {
    if (res.status() >= 400 && !res.url().includes('.supabase.co')) log.failed.push(`${res.status()} ${res.url()}`);
  });
}

/** Waits until the page shows no spinner and the network has been quiet for a moment. */
async function settle(page) {
  await page.waitForLoadState('domcontentloaded');
  await page
    .waitForFunction(
      () => ![...document.querySelectorAll('.app-spinner-wrap')].some(el => !el.closest('.more-rows')),
      null,
      {timeout: 15000},
    )
    .catch(() => undefined);
  await page.waitForLoadState('networkidle', {timeout: 5000}).catch(() => undefined);
  await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
  await page.waitForTimeout(SETTLE_MS);
}

async function pageState(page) {
  return page.evaluate(() => {
    const text = document.body.innerText || '';
    return {
      hash: location.hash,
      // A spinner other than the "more rows" marker at the end of a progressive list.
      spinner: [...document.querySelectorAll('.app-spinner-wrap')].some(el => !el.closest('.more-rows')),
      moreRows: !!document.querySelector('.more-rows'),
      accessDenied: !!document.querySelector('.access-denied'),
      gateError: !!document.querySelector('.cloud-gate'),
      errorBoundary: /Κάτι πήγε στραβά|Something went wrong|Δεν ήταν δυνατή η φόρτωση|could not be loaded/i.test(text),
      textLength: text.trim().length,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
}

/**
 * Full-page screenshot. The app shell keeps the page at the window's height and scrolls inside panels
 * (lists, tables), so "full page" alone would cut them: the window is made taller until no panel
 * scrolls any more (as on a very tall screen), then put back.
 */
async function shoot(page, file, viewport) {
  const size = VIEWPORTS[viewport];
  let height = size.height;
  for (let i = 0; i < 5; i++) {
    const extra = await page.evaluate(() => {
      let most = 0;
      for (const el of document.querySelectorAll('body *')) {
        if (el.clientHeight < 80) continue;
        const overflow = getComputedStyle(el).overflowY;
        if (overflow !== 'auto' && overflow !== 'scroll') continue;
        most = Math.max(most, el.scrollHeight - el.clientHeight);
      }
      return most;
    });
    if (extra < 4 || height >= MAX_HEIGHT) break;
    height = Math.min(height + extra, MAX_HEIGHT);
    await page.setViewportSize({width: size.width, height});
    await page.waitForTimeout(250);
  }
  await page.screenshot({path: join(OUT, file), fullPage: true, animations: 'disabled'});
  if (height !== size.height) await page.setViewportSize(size);
}

// ---------- run
async function main() {
  build();
  const seed = await loadSeed();
  const routes = appRoutes();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  mkdirSync(OUT, {recursive: true});
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
  const index = [];
  const record = (entry, log) => {
    index.push({
      ...entry,
      consoleErrors: [...new Set(log.console)],
      failedRequests: [...new Set(log.failed)],
      blockedRequests: [...new Set(log.blocked)],
      mockErrors: [...new Set(log.mock)],
    });
    log.console.length = log.failed.length = log.blocked.length = log.mock.length = 0;
  };
  const wanted = route => !ONLY || route === ONLY || route.includes(String(ONLY));

  for (const viewport of VIEWPORT_NAMES) {
    // Signed out: sign-in screen and the hospital's public signup (join) page.
    if (EXTRAS && ROLES.length) {
      const db = createDatabase(seed);
      const log = {console: [], failed: [], blocked: [], mock: []};
      const context = await newContext(browser, {viewport, account: null, db, log});
      const page = await context.newPage();
      attachLogging(page, log);
      for (const [name, hash, route] of [
        ['signin', '#/', '/ (signed out)'],
        [`join`, `#/join/${JOIN_TOKEN}`, '/join/:token'],
      ]) {
        if (!wanted(route) && !wanted(name)) continue;
        await page.goto(base + hash);
        await settle(page);
        const file = `${LANG}_signedout_${viewport}_${name}.png`;
        await shoot(page, file, viewport);
        record({file, route, role: 'SIGNED_OUT', viewport, lang: LANG, state: await pageState(page)}, log);
        console.log(`  ${file}`);
      }
      await context.close();
    }

    for (const role of ROLES) {
      const account = ACCOUNTS[role];
      const db = createDatabase(seed);
      const log = {console: [], failed: [], blocked: [], mock: []};
      const context = await newContext(browser, {viewport, account, db, log});
      const page = await context.newPage();
      attachLogging(page, log);
      page.on('dialog', dialog => void dialog.dismiss());

      let list;
      if (role === 'PLATFORM') {
        // The platform owner outside any hospital: Studio and the hospital list.
        list = ['/studio', '/hospitals', '/hospital'];
      } else {
        const allowed = new Set(seed.permissions[role]);
        list = routes.filter(r => allowed.has(r.permission)).map(r => r.path);
        if (allowed.has('issue.view')) list.push('/issues?tab=replacements');
        if (role === 'ADMIN') list.push('/no-such-page');
      }

      // First load: the app restores the session and loads the hospital.
      await page.goto(base + '#/');
      await settle(page);
      const home = await pageState(page);
      if (wanted('home') || wanted('/')) {
        const file = `${LANG}_${role.toLowerCase()}_${viewport}_home-firstload.png`;
        await shoot(page, file, viewport);
        record({file, route: '/ (first load)', role, viewport, lang: LANG, landedOn: home.hash, state: home}, log);
        console.log(`  ${file}`);
      } else log.console.length = log.failed.length = log.blocked.length = log.mock.length = 0;
      // One reload puts every role in its steady state (as after a refresh), which is what the route
      // screenshots below show; the first-load shot above covers the sign-in path.
      await page.reload();
      await settle(page);
      log.console.length = log.failed.length = log.blocked.length = log.mock.length = 0;

      for (const route of list) {
        if (!wanted(route)) continue;
        const target = route
          .replace('/sets/:id', `/sets/${seed.firstSetId}`)
          .replace('/tools/:id', `/tools/${seed.firstToolId}`);
        await page.evaluate(h => (location.hash = h), `#${target}`);
        await settle(page);
        await page.evaluate(() => window.scrollTo(0, 0));
        const state = await pageState(page);
        const file = `${LANG}_${role.toLowerCase()}_${viewport}_${slug(route)}.png`;
        await shoot(page, file, viewport);
        const landed = decodeURIComponent(state.hash.replace(/^#/, ''));
        record(
          {
            file,
            route,
            url: target,
            role,
            viewport,
            lang: LANG,
            ...(landed !== target ? {redirectedTo: landed} : {}),
            state,
          },
          log,
        );
        console.log(`  ${file}${landed !== target ? `  (redirected to ${landed})` : ''}`);
      }

      if (EXTRAS && role !== 'PLATFORM') await captureModals(page, {role, viewport, seed, record, log, wanted});
      await context.close();
    }
  }
  await browser.close();
  server.close();
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2));
  const problems = index.filter(
    e =>
      e.redirectedTo ||
      e.state?.spinner ||
      e.state?.gateError ||
      e.state?.errorBoundary ||
      e.state?.accessDenied ||
      e.consoleErrors.some(c => c.startsWith('[error]') || c.startsWith('[pageerror]')),
  );
  console.log(`\n${index.length} screenshots in ${OUT} (index.json). ${problems.length} with something to look at.`);
}

/** A few dialogs reachable with one click, captured where the role has them. */
async function captureModals(page, {role, viewport, record, log, wanted}) {
  const modals = [];
  const sterilization = ['STERILIZATION', 'SUPERVISOR', 'ADMIN'].includes(role);
  if (sterilization)
    modals.push(
      {
        // The receipt dialog of the first item waiting at the counter.
        name: 'sterilization-receive-modal',
        route: '/sterilization',
        open: () =>
          page
            .locator('.ster-row-action button')
            .filter({hasText: /Παραλαβή|Receive/})
            .first()
            .click({timeout: 3000}),
      },
      {
        name: 'sterilization-batch-receive-modal',
        route: '/sterilization',
        open: () =>
          page
            .locator('button')
            .filter({hasText: /Μαζική παραλαβή|Batch|Bulk/i})
            .first()
            .click({timeout: 3000}),
      },
    );
  if (sterilization)
    modals.push({
      name: 'issues-resolve-modal',
      route: '/issues',
      open: () =>
        page
          .getByTitle(/^(Επίλυση|Resolve)$/)
          .first()
          .click({timeout: 3000}),
    });
  // Every signed-in role: the in-app sign-out question.
  modals.push({
    name: 'signout-modal',
    route: '/',
    open: () =>
      page
        .getByTitle(/^(Αποσύνδεση|Sign out)$/)
        .first()
        .click({timeout: 3000}),
  });
  for (const modal of modals) {
    if (!wanted(modal.name) && !wanted(modal.route)) continue;
    // A fresh page for each dialog, so one left open cannot hide the next one's button.
    await page.evaluate(h => (location.hash = h), `#${modal.route}`);
    await page.reload();
    await settle(page);
    log.console.length = log.failed.length = log.blocked.length = log.mock.length = 0;
    try {
      await modal.open();
      await page.waitForSelector('.modal-backdrop, [role="dialog"], [aria-modal="true"], dialog[open]', {
        timeout: 3000,
      });
      await page.waitForTimeout(SETTLE_MS);
      const file = `${LANG}_${role.toLowerCase()}_${viewport}_${modal.name}.png`;
      await shoot(page, file, viewport);
      record(
        {file, route: modal.route, modal: modal.name, role, viewport, lang: LANG, state: await pageState(page)},
        log,
      );
      console.log(`  ${file}`);
      await page.keyboard.press('Escape');
    } catch (e) {
      console.log(`  (could not open ${modal.name} for ${role}/${viewport}: ${String(e.message).split('\n')[0]})`);
      log.console.length = log.failed.length = log.blocked.length = log.mock.length = 0;
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
