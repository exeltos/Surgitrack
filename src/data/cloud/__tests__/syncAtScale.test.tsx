/**
 * Load test of the sync (useAppRecordSync) at a large hospital's size, against a database in memory that
 * behaves like ours where it matters (fakeDatabase.ts). Each station has its own copy of the sync modules
 * (vi.resetModules), so its versions and save queue are its own, as on separate devices.
 *
 * It checks what a large hospital needs from the sync: an idle screen sends nothing, one change is one small
 * request, a whole load released at once goes in a few requests, and stations that change the same
 * instruments at the same time end up with the same data as the database, without a flood of requests and
 * without losing a change unannounced; and each change writes only what changed to the device's copy.
 */
import 'fake-indexeddb/auto';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, render} from '@testing-library/react';
import {useState} from 'react';
import type {CloudRecord} from '../appRecords';
import {tableFromRow, tableToRow} from '../cloudTables';
import {recordKey} from '../remoteChanges';
import {db, resetDatabase, tableOf} from './fakeDatabase';

type Row = Record<string, unknown>;

vi.mock('../../../lib/supabase', async () => ({supabase: (await import('./fakeDatabase')).fakeSupabase}));
vi.mock('../realtime', () => ({isRealtimeLive: () => false, onRemoteChange: () => () => undefined}));

const ORG = 'org-1';
type Tool = CloudRecord & Record<string, unknown>;

/** A small, fixed random sequence: the same run every time. */
const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 2 ** 32;
  return seed / 2 ** 32;
};

const DEPARTMENTS = ['Ορθοπαιδική', 'Γενική Χειρουργική', 'Ουρολογία', 'Γυναικολογία', 'Νευροχειρουργική', 'ΩΡΛ'];
const STATES = ['ready', 'in_use', 'dirty', 'washing', 'packing', 'sterilizing'];
const makeTool = (n: number): Tool => ({
  id: `tool-${n}`,
  barcode: `T${String(n).padStart(6, '0')}`,
  code: `C-${n % 997}`,
  name: `Λαβίδα Kocher ${n % 40} cm`,
  department: DEPARTMENTS[n % DEPARTMENTS.length],
  specialty: 'Γενική',
  manufacturer: ['Aesculap', 'KLS Martin', 'Medicon'][n % 3],
  mode: 'tracked',
  setId: n % 3 ? `set-${Math.floor(n / 12)}` : undefined,
  state: STATES[n % STATES.length],
  uses: n % 150,
  maxUses: 300,
  sterilizations: n % 200,
  colorTapes: n % 5 ? ['red', 'blue'] : [],
  ownership: 'hospital',
  notes: '',
});

/** Fills the instruments table: what the hospital saved before today. */
const seed = (count: number) => {
  const table = tableOf('instruments');
  const created = '2026-01-15T08:00:00.000Z';
  for (let n = 0; n < count; n++) {
    const row = tableToRow(ORG, 'tools', makeTool(n) as never);
    table.set(String(row.id), {...row, created_at: created, updated_at: created});
  }
};

/** The record as the database holds it now, in the store's form. */
const saved = (id: string) => tableFromRow('tools', tableOf('instruments').get(id) as Row);
const sameRecord = (a: CloudRecord, b: CloudRecord) =>
  recordKey(tableFromRow('tools', tableToRow(ORG, 'tools', a as never))) === recordKey(b);

type SyncModules = {
  sync: typeof import('../useAppRecordSync');
  versions: typeof import('../versions');
  remote: typeof import('../remoteChanges');
  cache: typeof import('../localCache');
};
type Notice = import('../useAppRecordSync').SyncNotice;
type Conflict = import('../useAppRecordSync').SyncConflict;

/** One station: its own copy of the sync code, its own store, what it was told. */
type Station = {
  modules: SyncModules;
  items: () => Tool[];
  change: (update: (list: Tool[]) => Tool[]) => Promise<void>;
  notices: Notice[];
  conflicts: Conflict[];
};

let stationCount = 0;
/** The user of the n-th station opened in the current test. */
let firstStation = 0;
const stationIndex = (n: number) => firstStation + n;
const openStation = async (): Promise<Station> => {
  vi.resetModules();
  const modules: SyncModules = {
    sync: await import('../useAppRecordSync'),
    versions: await import('../versions'),
    remote: await import('../remoteChanges'),
    cache: await import('../localCache'),
  };
  // Each station keeps its copy under its own user, as on its own device.
  modules.cache.setCacheOwner({userId: `station-${stationCount++}`, organizationId: ORG});
  // What the app's first load does: every instrument, with the version of each.
  const rows = [...tableOf('instruments').values()];
  modules.versions.rememberVersions('tools', rows);
  const initial = rows.map(row => tableFromRow('tools', row) as Tool);
  const station: Station = {
    modules,
    items: () => current,
    change: async () => undefined,
    notices: [],
    conflicts: [],
  };
  let current = initial;
  let setItems: (update: (list: Tool[]) => Tool[]) => void = () => undefined;
  modules.sync.onSyncNotice(notice => station.notices.push(notice));
  modules.sync.onSyncConflict(conflict => station.conflicts.push(conflict));
  function Store() {
    const [items, set] = useState(initial);
    current = items;
    setItems = set;
    modules.sync.useAppRecordSync(ORG, 'tools', items, (remote, removed) =>
      set(list => modules.remote.mergeRemote(list, remote as Tool[], removed)),
    );
    return null;
  }
  render(<Store />);
  station.change = async update => {
    await act(async () => setItems(update));
  };
  return station;
};

/** Lets time pass in steps, so React renders what each timer changed before the next one fires. */
const wait = async (ms: number, step = 100) => {
  for (let passed = 0; passed < ms; passed += step) await act(() => vi.advanceTimersByTimeAsync(step));
};
const writes = () => db.requests.filter(r => r.op !== 'select' && r.table === 'instruments');
const reads = () => db.requests.filter(r => r.op === 'select');
const edit = (id: string, fields: Record<string, unknown>) => (list: Tool[]) =>
  list.map(item => (item.id === id ? {...item, ...fields} : item));
const realNow = performance.now.bind(performance);
const put = IDBObjectStore.prototype.put;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
/** The measured numbers, printed with the test run. */
// Written straight to the terminal: jsdom keeps console output of a passing test to itself.
const report = (line: string) =>
  (globalThis as unknown as {process: {stdout: {write: (text: string) => void}}}).process.stdout.write(`${line}\n`);

describe('sync at a large hospital’s size', () => {
  beforeEach(() => {
    resetDatabase();
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date']});
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      const copy = value as {items?: unknown[]; upserts?: unknown[]};
      db.copies.push((copy.items || copy.upserts || []).length);
      return put.call(this, value, key);
    });
    vi.setSystemTime(new Date('2026-11-11T09:00:00.000Z'));
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('an idle screen with 20,000 instruments sends nothing and only looks for changes now and then', async () => {
    seed(20_000);
    await openStation();
    await wait(10 * 60_000, 1000);

    expect(writes()).toEqual([]);
    // A look every 20 s (changed records + deletions), each returning nothing.
    expect(reads().length).toBeLessThanOrEqual(2 * 32);
    expect(reads().every(read => read.rows === 0)).toBe(true);
    // The device's copy (megabytes at this size) is written whole once, when the screen opens.
    expect(db.copies.filter(records => records === 20_000)).toHaveLength(1);
    expect(sum(db.copies)).toBeLessThanOrEqual(20_000);
  }, 60_000);

  it('a busy station: each change is one request with one record, and stays fast with 20,000 instruments', async () => {
    seed(20_000);
    const station = await openStation();
    await wait(5000);
    db.requests.length = 0;
    db.copies.length = 0;
    const times: number[] = [];
    for (let n = 0; n < 30; n++) {
      const start = realNow();
      await station.change(edit(`tool-${n * 7}`, {state: 'washing', notes: `πλύση ${n}`}));
      await act(() => vi.advanceTimersByTimeAsync(500));
      times.push(realNow() - start);
      await wait(9500, 500);
    }

    expect(writes()).toHaveLength(30);
    expect(writes().every(write => write.op === 'upsert' && write.rows === 1)).toBe(true);
    for (let n = 0; n < 30; n++) expect(sameRecord(station.items()[n * 7], saved(`tool-${n * 7}`))).toBe(true);
    expect(station.modules.sync.unsavedChanges()).toBe(0);
    // Change, compare 20,000 records and save, measured on this machine: well under a frame budget × 10.
    const median = [...times].sort((a, b) => a - b)[15];
    report(
      `sync at scale: one change among 20,000 instruments: median ${median.toFixed(1)} ms; ` +
        `device copy: ${sum(db.copies)} records written for 30 changes`,
    );
    expect(median).toBeLessThan(250);
    // Only what changed goes to the disk: all 30 changes together write less than one whole copy.
    expect(Math.max(...db.copies)).toBeLessThanOrEqual(30);
    expect(sum(db.copies)).toBeLessThan(20_000);
  }, 60_000);

  it('a whole release of 500 instruments goes in three requests', async () => {
    seed(5000);
    const station = await openStation();
    await wait(5000);
    db.requests.length = 0;
    const released = new Set(Array.from({length: 500}, (_, n) => `tool-${n * 9}`));
    await station.change(list => list.map(item => (released.has(item.id) ? {...item, state: 'ready'} : item)));
    await wait(3000);

    expect(writes().map(write => write.rows)).toEqual([200, 200, 100]);
    expect([...released].every(id => saved(id).state === 'ready')).toBe(true);
    expect(station.modules.sync.unsavedChanges()).toBe(0);
  }, 60_000);

  it('four stations changing the same instruments at once end up with the database’s data, no change lost unannounced', async () => {
    seed(2000);
    // Each station changes its own field, on a small set of instruments all four keep touching.
    const FIELDS = ['state', 'department', 'notes', 'specialty'];
    const stations: Station[] = [];
    firstStation = stationCount;
    for (let s = 0; s < 4; s++) stations.push(await openStation());
    await wait(5000);
    db.requests.length = 0;
    db.stale = 0;

    const next = random(42);
    const hot = Array.from({length: 40}, (_, n) => `tool-${n * 50}`);
    // What each station last set on each instrument (its own field).
    const lastSet = stations.map(() => new Map<string, string>());
    let edits = 0;
    for (let second = 0; second < 5 * 60; second++) {
      for (let s = 0; s < stations.length; s++) {
        // On average one change every 3 s per station.
        if (next() > 1 / 3) continue;
        const id = hot[Math.floor(next() * hot.length)];
        const value = `${FIELDS[s]}-${s}-${second}`;
        lastSet[s].set(id, value);
        await stations[s].change(edit(id, {[FIELDS[s]]: value}));
        edits++;
      }
      await act(() => vi.advanceTimersByTimeAsync(1000));
    }
    // Quiet time: the last saves, retries and looks for changes run.
    await wait(3 * 60_000, 500);

    const writeRequests = writes().length;
    const stale = stations.flatMap(station => station.notices);
    const givenUp = stale.flatMap(notice => (notice.kind === 'refused' ? notice.records : []));
    const conflicts = stations.flatMap(station => station.conflicts);
    let lost = 0;
    lastSet.forEach((values, s) =>
      values.forEach((value, id) => {
        if (saved(id)[FIELDS[s]] !== value) lost++;
      }),
    );
    report(
      `sync at scale: 4 stations, ${edits} changes to 40 shared instruments in 5 min → ` +
        `${writeRequests} write requests (${db.stale} refused as changed elsewhere, then merged), ${reads().length} reads, ${givenUp.length} changes given back, ` +
        `${conflicts.length} same-field conflicts, ${lost} final values not kept`,
    );

    // Everyone sees what the database holds, and has nothing left to save.
    for (const station of stations) {
      expect(station.modules.sync.unsavedChanges()).toBe(0);
      const mismatched = station.items().filter(item => !sameRecord(item, saved(item.id)));
      expect(mismatched.map(item => item.id)).toEqual([]);
    }
    // The contention is real: saves were refused as changed elsewhere and merged.
    expect(db.stale).toBeGreaterThan(0);
    // What each station would open with next time: its copy, read back, is what it holds now.
    for (const [index, station] of stations.entries()) {
      await act(() => vi.advanceTimersByTimeAsync(1000));
      const copy = await station.modules.cache.readCache(
        {userId: `station-${stationIndex(index)}`, organizationId: ORG},
        ['tools'],
      );
      expect(copy.tools?.expired).toBe(false);
      expect(copy.tools?.items).toEqual(station.items());
    }
    // Each station changes its own field: merging keeps them all, nothing is reported as a same-field clash.
    expect(conflicts).toEqual([]);
    // A change that did not stick was announced to the station that made it.
    expect(lost).toBeLessThanOrEqual(givenUp.length);
    // No flood: a few requests per change at most, even with this much contention.
    expect(writeRequests).toBeLessThanOrEqual(edits * 4);
  }, 120_000);
});
