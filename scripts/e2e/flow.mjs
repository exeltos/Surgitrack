#!/usr/bin/env node
/**
 * End-to-end test of the main flow, through the real screens: a department sends a Set to Sterilization,
 * Sterilization receives, washes, prepares, packs, loads the sterilizer, records the cycle, releases and
 * delivers it, and the department finds it ready. Two people, each in their own browser, work on one hospital
 * (the screens harness's mocked Supabase, see scripts/screens/mock-supabase.mjs); what the app saved is checked
 * in that database after each step. The database's own rules (row security, triggers) are covered by
 * supabase/tests.
 *
 *   node scripts/e2e/flow.mjs [--rebuild] [--headed] [--out dir]
 *
 * Exits 1 on the first failed step, with a screenshot and the visible buttons of each browser in --out.
 */
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
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
  HANDOVER_PASSWORD,
} from '../screens/mock-supabase.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const CACHE = join(ROOT, 'node_modules/.cache/surgitrack-e2e');
const DIST = join(CACHE, 'dist');
const argv = process.argv.slice(2);
const flag = name => argv.includes(`--${name}`);
const outAt = argv.indexOf('--out');
const OUT = resolve(outAt >= 0 ? argv[outAt + 1] : join(CACHE, 'out'));

// ---------- build, data, server
function build() {
  if (!flag('rebuild') && existsSync(join(DIST, 'index.html'))) return;
  console.log('Building the app…');
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

async function loadSeed() {
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
  const mod = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
  return mod.buildSeed(ORG_ID, 1);
}

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
function serve() {
  const server = createServer((req, res) => {
    let file = join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
    res.writeHead(200, {'content-type': TYPES[extname(file)] || 'application/octet-stream'});
    res.end(readFileSync(file));
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok(server)));
}

// ---------- one person in their own browser
async function person(browser, base, db, role) {
  const account = ACCOUNTS[role];
  const context = await browser.newContext({
    viewport: {width: 1440, height: 900},
    locale: 'el-GR',
    timezoneId: 'Europe/Athens',
    reducedMotion: 'reduce',
  });
  await context.addInitScript(
    ({key, session}) => {
      if (sessionStorage.getItem('__e2e_init')) return;
      sessionStorage.setItem('__e2e_init', '1');
      localStorage.setItem('surgitrack-lang', 'el');
      localStorage.setItem(key, JSON.stringify(session));
      // No "what's new", day briefing or screen guides in the way.
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      localStorage.setItem(`surgitrack-seen-version:${session.user.id}`, '999.0.0');
      localStorage.setItem(`surgitrack-briefing-seen:${session.user.id}`, today);
      localStorage.setItem(`surgitrack-screen-guides:${session.user.id}`, JSON.stringify({off: true, screens: []}));
    },
    {key: STORAGE_KEY, session: fakeSession(account)},
  );
  await context.route(
    url => url.hostname.endsWith('.supabase.co'),
    async route => {
      const r = route.request();
      await route.fulfill(
        handleSupabase(db, account, {method: r.method(), url: r.url(), headers: r.headers(), body: r.postData()}),
      );
    },
  );
  await context.route(
    url => !['127.0.0.1', 'localhost'].includes(url.hostname) && !url.hostname.endsWith('.supabase.co'),
    route => route.abort('blockedbyclient'),
  );
  await context.routeWebSocket(/supabase\.co\/realtime/, ws => handleRealtime(ws));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', dialog => void dialog.accept());
  await page.goto(base + '#/');
  await settle(page);
  return {role, page, errors, context};
}

async function settle(page) {
  await page
    .waitForFunction(
      () => ![...document.querySelectorAll('.app-spinner-wrap')].some(el => !el.closest('.more-rows')),
      null,
      {
        timeout: 15000,
      },
    )
    .catch(() => undefined);
  await page.waitForLoadState('networkidle', {timeout: 5000}).catch(() => undefined);
}

/** Goes to a screen and waits for it. */
async function open(who, hash) {
  await who.page.evaluate(h => (location.hash = h), `#${hash}`);
  await settle(who.page);
}

/** Waits until this device has nothing left to save (the sync status in the top bar). */
async function saved(who) {
  await who.page.waitForFunction(() => !document.querySelector('.sync-chip.saving, .sync-chip.failed'), null, {
    timeout: 15000,
  });
  await who.page.waitForTimeout(800);
}

/** A hand-over signed by `account` (their user code and password), in the open receipt or delivery. */
async function signHandover(page, account) {
  await page.getByLabel('Κωδικός χρήστη').first().fill(account.email.split('@')[0]);
  await page.getByLabel('Συνθηματικό').first().fill(HANDOVER_PASSWORD);
  await page.getByRole('button', {name: 'Υπογραφή', exact: true}).first().click();
  await page.waitForTimeout(500);
}

/** Takes what the other devices saved (the app looks again when its window gets the focus). */
async function refresh(who) {
  await who.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await who.page.waitForTimeout(1500);
  await settle(who.page);
}

// ---------- reporting
let stepNo = 0;
const people = [];
async function dump(label) {
  mkdirSync(OUT, {recursive: true});
  for (const who of people) {
    const file = join(OUT, `${String(stepNo).padStart(2, '0')}-${who.role.toLowerCase()}-${label}.png`);
    await who.page.screenshot({path: file}).catch(() => undefined);
    const buttons = await who.page
      .evaluate(() =>
        [...document.querySelectorAll('button, [role=tab], a[href]')]
          .filter(el => el.getClientRects().length && !el.closest('[inert]'))
          .map(el => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50))
          .filter(Boolean),
      )
      .catch(() => []);
    writeFileSync(
      file.replace(/\.png$/, '.txt'),
      `${await who.page.evaluate(() => location.hash)}\n${buttons.join('\n')}\n`,
    );
  }
}
async function step(name, run) {
  stepNo += 1;
  const started = Date.now();
  try {
    await run();
    console.log(`ok   ${String(stepNo).padStart(2)} ${name} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  } catch (error) {
    const lines = String(error.message || error).split('\n');
    // Playwright's call log names the element it was waiting for.
    const waited = lines.find(line => /waiting for/.test(line));
    console.log(
      `FAIL ${String(stepNo).padStart(2)} ${name}\n     ${lines[0]}${waited ? `\n     ${waited.trim()}` : ''}`,
    );
    await dump('failed');
    console.log(`     screenshots and visible buttons in ${OUT}`);
    throw error;
  }
}
const expectEqual = (got, want, what) => {
  if (JSON.stringify(got) !== JSON.stringify(want))
    throw new Error(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

// ---------- the flow
async function main() {
  build();
  const seed = await loadSeed();
  const db = createDatabase(seed);
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({headless: !flag('headed')});
  const row = (table, id) => db[table].find(r => r.id === id);
  let failed = false;
  try {
    // A complete Set of the department user's department, with no open issue on it or its instruments and
    // uses left (the sample hospital's problems, missing instruments, damage reports and used-up instruments,
    // have flows of their own).
    const members = id => db.instruments.filter(t => t.set_id === id && t.state !== 'RETIRED');
    const set = db.instrument_sets.find(
      s =>
        s.state === 'IN_DEPARTMENT' &&
        s.department === ACCOUNTS.DEPARTMENT.department &&
        members(s.id).length === s.expected,
    );
    if (!set) throw new Error('no complete Set in the department');
    const setId = set.id;
    const barcodes = new Set([set.barcode, ...members(setId).map(t => t.barcode)]);
    for (const issue of db.issues)
      if (issue.status === 'OPEN' && barcodes.has(issue.asset.split(' ')[0])) issue.status = 'RESOLVED';
    for (const tool of members(setId)) if (tool.max_uses) tool.uses = 0;
    if (set.max_uses) set.uses = 0;

    const department = await person(browser, base, db, 'DEPARTMENT');
    const sterilization = await person(browser, base, db, 'STERILIZATION');
    people.push(department, sterilization);

    await step(`Department sends ${set.barcode} to Sterilization`, async () => {
      expectEqual(set.state, 'IN_DEPARTMENT', 'state before');
      const {page} = department;
      await open(department, `/sets/${setId}`);
      await page.getByRole('button', {name: 'Προς Αποστείρωση'}).first().click();
      await page.getByPlaceholder('π.χ. PT-2026-00125').first().fill('PT-E2E-0001');
      await page.getByRole('button', {name: 'Καταμέτρηση', exact: true}).click();
      await page.getByRole('button', {name: 'Όλα παρόντα'}).click();
      await page.getByRole('button', {name: 'Επιβεβαίωση', exact: true}).click();
      await page.getByRole('button', {name: 'Υπογραφή καταμέτρησης'}).click();
      await page.getByText('Επιβεβαιώνω ότι χρησιμοποιήθηκε').click();
      await page.getByRole('button', {name: 'Αποστολή προς Αποστείρωση', exact: true}).last().click();
      await saved(department);
      expectEqual(row('instrument_sets', setId).state, 'PENDING_STERILIZATION', 'state saved');
    });

    /** The Sterilization queue row of the Set, and a click on one of its buttons. */
    const queueRow = () => sterilization.page.locator('.ster-work-row').filter({hasText: set.barcode}).first();

    await step('Sterilization receives it', async () => {
      const {page} = sterilization;
      await refresh(sterilization);
      await open(sterilization, '/sterilization');
      await queueRow().getByRole('button', {name: 'Παραλαβή', exact: true}).click();
      // The department's nurse hands it over and signs with their own code and password.
      await signHandover(page, ACCOUNTS.DEPARTMENT);
      await page.getByRole('button', {name: 'Χωρίς εμφανή απόκλιση'}).click();
      await page.getByRole('button', {name: 'Επιβεβαίωση φυσικής παραλαβής'}).click();
      await saved(sterilization);
      expectEqual(row('instrument_sets', setId).state, 'IN_WASHING', 'state saved');
      const receipt = db.receipts.find(r => r.asset_id === setId);
      if (!receipt) throw new Error('no receipt saved');
    });
    /** Opens a stage's queue on the Sterilization screen (its tab). */
    const queue = async name => {
      await open(sterilization, '/sterilization');
      await sterilization.page
        .getByRole('button', {name: new RegExp(`^${name}`)})
        .first()
        .click();
      await sterilization.page.waitForTimeout(400);
    };

    /** Ticks every check of the open stage dialog and completes the stage. */
    const passChecks = async () => {
      const {page} = sterilization;
      const modal = page.locator('.modal-backdrop').last();
      const boxes = modal.locator('input[type=checkbox]');
      for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check();
      await modal.getByRole('button', {name: 'Ολοκλήρωση · Επόμενο στάδιο'}).click();
    };

    await step('Sterilization washes it', async () => {
      await queue('Καθαρισμός');
      // Washing goes through a washer load, with the row's item already picked.
      await queueRow().getByRole('button', {name: 'Φόρτωση πλυντηρίου'}).click();
      const modal = sterilization.page.locator('.load-modal');
      await modal.getByPlaceholder('π.χ. 2026-0815-07').fill('W-E2E-1');
      await modal.getByRole('button', {name: /^Ολοκλήρωση φορτίου/}).click();
      await saved(sterilization);
      expectEqual(row('instrument_sets', setId).state, 'IN_PREPARATION', 'state saved');
    });

    await step('Sterilization checks its composition', async () => {
      const {page} = sterilization;
      await queue('Σύνθεση');
      await queueRow().getByRole('button', {name: 'Έλεγχος & Σύνθεση'}).click();
      const modal = page.locator('.modal-backdrop').last();
      await modal.getByRole('button', {name: 'Επιλογή όλων'}).click();
      await modal.getByText('Ακεραιότητα & λειτουργικότητα').click();
      await modal.getByText('Σύνθεση & συναρμολόγηση').click();
      await modal.getByRole('button', {name: 'Ολοκλήρωση · Προς κλιβανισμό'}).click();
      await saved(sterilization);
      expectEqual(row('instrument_sets', setId).state, 'IN_PACKAGING', 'state saved');
    });

    await step('Sterilization packs and labels it (3 months sterile)', async () => {
      const {page} = sterilization;
      await queue('Συσκευασία');
      await queueRow().getByRole('button', {name: 'Έλεγχος συσκευασίας'}).click();
      await page.getByRole('radio', {name: '3 μήνες'}).click();
      await passChecks();
      await saved(sterilization);
      expectEqual(row('instrument_sets', setId).state, 'IN_STERILIZATION', 'state saved');
    });

    await step('Sterilization loads it into a sterilizer', async () => {
      const {page} = sterilization;
      await queue('Φόρτωση');
      await page.getByRole('button', {name: 'Αποεπιλογή όλων'}).click();
      await queueRow().locator('input[type=checkbox]').check();
      await page.getByRole('button', {name: /^Φόρτωση κλιβάνου · 1/}).click();
      await page.getByPlaceholder('π.χ. 2026-0815-07').fill('E2E-0001');
      await page.getByRole('button', {name: 'Έναρξη κύκλου · 1'}).click();
      await saved(sterilization);
      const load = db.process_loads.find(l => l.cycle_number === 'E2E-0001');
      if (!load) throw new Error('no load saved');
      expectEqual(load.status, 'OPEN', 'load status');
    });

    await step('The cycle ends and passes', async () => {
      const {page} = sterilization;
      await queue('Στον κλίβανο');
      await page.getByRole('button', {name: 'Τέλος κύκλου · 1'}).click();
      await saved(sterilization);
      expectEqual(row('instrument_sets', setId).state, 'AWAITING_RELEASE', 'state saved');
      const cycle = db.sterilization_cycles.find(c => c.asset_id === setId && c.cycle_number === 'E2E-0001');
      expectEqual(cycle?.result, 'PASSED', 'cycle result');
    });

    await step('Sterilization releases the load', async () => {
      const {page} = sterilization;
      await queue('Αποδέσμευση');
      await page.getByRole('button', {name: /^Αποδέσμευση φορτίου/}).click();
      const modal = page.locator('.modal-backdrop').last();
      const load = db.process_loads.find(l => l.cycle_number === 'E2E-0001');
      await modal.locator('select').first().selectOption(load.id);
      await modal.getByText('Φυσικές παράμετροι κύκλου αποδεκτές').click();
      await modal.getByText('Συσκευασίες στεγνές και ακέραιες').click();
      await modal.getByLabel('Χημικός δείκτης').selectOption('PASS');
      await modal.getByRole('button', {name: /^Αποδέσμευση φορτίου · 1/}).click();
      await saved(sterilization);
      expectEqual(row('instrument_sets', setId).state, 'READY_FOR_PICKUP', 'state saved');
      const release = db.sterilization_releases.find(r => r.asset_id === setId && r.load_id === load.id);
      expectEqual(release?.decision, 'RELEASED', 'release decision');
    });

    await step('The department sees it ready for pickup', async () => {
      const {page} = department;
      await refresh(department);
      await open(department, `/sets/${setId}`);
      await page.getByText('Έτοιμο για παραλαβή').first().waitFor();
    });

    await step('Sterilization delivers it to the department', async () => {
      const {page} = sterilization;
      await queue('Παράδοση');
      await queueRow().getByRole('button', {name: 'Παράδοση στο τμήμα'}).click();
      // The department's nurse receives it and signs with their own code and password.
      await signHandover(page, ACCOUNTS.DEPARTMENT);
      await page.getByRole('button', {name: 'Ολοκλήρωση παράδοσης / παραλαβής'}).click();
      await saved(sterilization);
      expectEqual(row('instrument_sets', setId).state, 'IN_DEPARTMENT', 'state saved');
      const delivery = db.deliveries.find(d => d.asset_id === setId);
      if (!delivery) throw new Error('no delivery saved');
    });

    await step('The department has it back, with its whole history', async () => {
      const {page} = department;
      await refresh(department);
      await open(department, `/sets/${setId}`);
      await page.getByText('Στο τμήμα').first().waitFor();
      const history = db.movements.filter(m => String(m.asset).startsWith(set.barcode)).length;
      if (history < 8) throw new Error(`only ${history} movements recorded for the Set`);
    });

    if (process.env.E2E_LOOK) {
      // Exploring: open a screen for one person and keep its picture and buttons (E2E_LOOK=role:/route).
      const [role, hash] = process.env.E2E_LOOK.split(':');
      const who = people.find(p => p.role === role);
      await refresh(who);
      await open(who, hash);
      stepNo += 1;
      await dump('look');
    }
  } catch {
    failed = true;
  } finally {
    for (const who of people)
      if (who.errors.length) console.log(`${who.role} page errors:\n  ${who.errors.join('\n  ')}`);
    await browser.close();
    server.close();
  }
  process.exit(failed ? 1 : 0);
}

await main();
