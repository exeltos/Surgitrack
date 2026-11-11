/**
 * Records saved together (S5): a release changes a release record, a movement and the Set at once; they reach
 * the database in one transaction (save_records_together), all of them or none. Against the database in
 * memory of fakeDatabase.ts, with the sync code as the app runs it.
 */
import 'fake-indexeddb/auto';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, render} from '@testing-library/react';
import {useState} from 'react';
import type {CloudRecord} from '../appRecords';
import {tableToRow} from '../cloudTables';
import {mergeRemote} from '../remoteChanges';
import {db, resetDatabase, tableOf} from './fakeDatabase';

vi.mock('../../../lib/supabase', async () => ({supabase: (await import('./fakeDatabase')).fakeSupabase}));
vi.mock('../realtime', () => ({isRealtimeLive: () => false, onRemoteChange: () => () => undefined}));

const ORG = 'org-1';
type Rec = CloudRecord & Record<string, unknown>;
type Collection = 'sets' | 'sterilizationReleases' | 'movements';
const TABLES: Record<Collection, string> = {
  sets: 'instrument_sets',
  sterilizationReleases: 'sterilization_releases',
  movements: 'movements',
};

const SET: Rec = {id: 's1', barcode: 'S000001', code: 'LAP', name: 'Laparoscopy', state: 'AWAITING_RELEASE'};
const OTHER_SET: Rec = {id: 's2', barcode: 'S000002', code: 'ORT', name: 'Orthopaedic', state: 'IN_STORAGE'};
const release: Rec = {id: 'r1', loadId: 'L1', assetId: 's1', assetKind: 'SET', decision: 'RELEASED'};
const movement: Rec = {id: 'm1', asset: 'S000001 · Laparoscopy', assetKind: 'SET', from: 'Αποδέσμευση', to: 'Έτοιμα'};

type Station = {
  sync: typeof import('../useAppRecordSync');
  items: Record<Collection, () => Rec[]>;
  set: Record<Collection, (update: (list: Rec[]) => Rec[]) => void>;
  notices: import('../useAppRecordSync').SyncNotice[];
};

/** A station with the Sets, release records and movements of one hospital, as the store holds them. */
const openStation = async (): Promise<Station> => {
  vi.resetModules();
  const sync = await import('../useAppRecordSync');
  const versions = await import('../versions');
  versions.rememberVersions('sets', [...tableOf('instrument_sets').values()]);
  const station = {sync, items: {}, set: {}, notices: []} as unknown as Station;
  sync.onSyncNotice(notice => station.notices.push(notice));
  function Collection({name, initial}: {name: Collection; initial: Rec[]}) {
    const [items, setItems] = useState(initial);
    station.items[name] = () => items;
    station.set[name] = setItems;
    sync.useAppRecordSync(ORG, name, items, (remote, removed) =>
      setItems(list => mergeRemote(list, remote as Rec[], removed)),
    );
    return null;
  }
  render(
    <>
      <Collection name="sets" initial={[SET, OTHER_SET]} />
      <Collection name="sterilizationReleases" initial={[]} />
      <Collection name="movements" initial={[]} />
    </>,
  );
  return station;
};

/** What the app's release does: a release record, a movement and the Set made ready. */
const releaseSet = (station: Station, suffix = '') =>
  act(async () => {
    station.sync.saveTogether(() => {
      station.set.sterilizationReleases(list => [{...release, id: `r1${suffix}`}, ...list]);
      station.set.movements(list => [{...movement, id: `m1${suffix}`}, ...list]);
      station.set.sets(list => list.map(item => (item.id === 's1' ? {...item, state: 'READY_FOR_PICKUP'} : item)));
    });
  });
const wait = async (ms: number) => {
  for (let passed = 0; passed < ms; passed += 100) await act(() => vi.advanceTimersByTimeAsync(100));
};
const onServer = (collection: Collection, id: string) => tableOf(TABLES[collection]).get(id);
const writes = () => db.requests.filter(request => request.op !== 'select');

describe('records saved together', () => {
  beforeEach(() => {
    resetDatabase();
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date']});
    vi.setSystemTime(new Date('2026-11-12T09:00:00.000Z'));
    const created = '2026-11-01T08:00:00.000Z';
    for (const set of [SET, OTHER_SET])
      tableOf('instrument_sets').set(String(set.id), {
        ...tableToRow(ORG, 'sets', set as never),
        created_at: created,
        updated_at: created,
      });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('a release reaches the database in one transaction, and the records count as saved', async () => {
    const station = await openStation();
    await releaseSet(station);
    await wait(3000);

    expect(writes()).toEqual([{op: 'rpc', table: 'save_records_together', rows: 3}]);
    expect(onServer('sterilizationReleases', 'r1')).toBeDefined();
    expect(onServer('movements', 'm1')).toBeDefined();
    expect(onServer('sets', 's1')?.state).toBe('READY_FOR_PICKUP');
    expect(station.sync.unsavedChanges()).toBe(0);

    // The Set's new version was taken in: the next change of it is not refused as changed elsewhere.
    await act(async () => station.set.sets(list => list.map(item => ({...item, name: 'Laparoscopy 2'}))));
    await wait(2000);
    expect(db.stale).toBe(0);
    expect(onServer('sets', 's1')?.name).toBe('Laparoscopy 2');
  });

  it('refused for good: none of it is kept, on the server or here, and the user hears so', async () => {
    // The database refuses the release record (one of its checks).
    db.refuse = table => (table === 'sterilization_releases' ? {code: '23514', message: 'release check'} : null);
    const station = await openStation();
    await releaseSet(station);
    await wait(5000);

    expect(onServer('sterilizationReleases', 'r1')).toBeUndefined();
    expect(onServer('movements', 'm1')).toBeUndefined();
    expect(onServer('sets', 's1')?.state).toBe('AWAITING_RELEASE');
    // Here too: the movement is not left without its release, nor the Set ready.
    expect(station.items.sterilizationReleases()).toEqual([]);
    expect(station.items.movements()).toEqual([]);
    expect(station.items.sets()[0].state).toBe('AWAITING_RELEASE');
    expect(station.notices.flatMap(notice => (notice.kind === 'refused' ? notice.records : []))).toHaveLength(3);
    // Nothing was sent on its own after the refusal.
    expect(writes().map(write => write.op)).toEqual(['rpc']);
    expect(station.sync.unsavedChanges()).toBe(0);
  });

  it('a change already waiting before the action is not part of it: a refused group leaves it to be saved', async () => {
    db.refuse = table => (table === 'sterilization_releases' ? {code: '23514', message: 'release check'} : null);
    const station = await openStation();
    // Another Set renamed a moment before the release, not saved yet.
    await act(async () =>
      station.set.sets(list => list.map(item => (item.id === 's2' ? {...item, name: 'Orthopaedic 2'} : item))),
    );
    await releaseSet(station);
    await wait(5000);

    expect(onServer('sets', 's2')?.name).toBe('Orthopaedic 2');
    expect(station.items.sets().find(item => item.id === 's2')?.name).toBe('Orthopaedic 2');
    // Only the release's own three records went back.
    expect(onServer('sets', 's1')?.state).toBe('AWAITING_RELEASE');
    expect(station.notices.flatMap(notice => (notice.kind === 'refused' ? notice.records : []))).toHaveLength(3);
    expect(station.sync.unsavedChanges()).toBe(0);
  });

  it('no connection to send the group: the records are saved as before, record by record, nothing lost', async () => {
    db.together = 'offline';
    const station = await openStation();
    await releaseSet(station);
    await wait(5000);

    expect(writes()[0].op).toBe('rpc');
    expect(onServer('sterilizationReleases', 'r1')).toBeDefined();
    expect(onServer('movements', 'm1')).toBeDefined();
    expect(onServer('sets', 's1')?.state).toBe('READY_FOR_PICKUP');
    expect(station.sync.unsavedChanges()).toBe(0);
  });

  it('a database without the function yet: asked once, then everything is saved as before', async () => {
    db.together = 'missing';
    const station = await openStation();
    await releaseSet(station);
    await wait(3000);
    await act(async () => station.set.sets(list => list.map(item => ({...item, state: 'AWAITING_RELEASE'}))));
    await wait(3000);
    await releaseSet(station, '-2');
    await wait(3000);

    expect(writes().filter(write => write.op === 'rpc')).toHaveLength(1);
    expect(onServer('sterilizationReleases', 'r1-2')).toBeDefined();
    expect(onServer('movements', 'm1-2')).toBeDefined();
    expect(onServer('sets', 's1')?.state).toBe('READY_FOR_PICKUP');
    expect(station.sync.unsavedChanges()).toBe(0);
  });

  it('the Set changed meanwhile on another station: the group is refused whole, then merged and saved', async () => {
    const station = await openStation();
    // Another station wrote a note on the Set after this one loaded it.
    const server = onServer('sets', 's1')!;
    tableOf('instrument_sets').set('s1', {
      ...server,
      notes: 'Λείπει ένα ψαλίδι',
      updated_at: '2026-11-12T08:59:00.000Z',
    });
    await releaseSet(station);
    await wait(15_000);

    expect(writes()[0].op).toBe('rpc');
    expect(onServer('sterilizationReleases', 'r1')).toBeDefined();
    expect(onServer('movements', 'm1')).toBeDefined();
    // Both changes kept: the other station's note and this release.
    expect(onServer('sets', 's1')).toMatchObject({state: 'READY_FOR_PICKUP', notes: 'Λείπει ένα ψαλίδι'});
    expect(station.items.sets()[0]).toMatchObject({state: 'READY_FOR_PICKUP', notes: 'Λείπει ένα ψαλίδι'});
    expect(station.sync.unsavedChanges()).toBe(0);
  });

  it('one record alone is saved as before, without a group', async () => {
    const station = await openStation();
    await act(async () => {
      station.sync.saveTogether(() => station.set.movements(list => [movement, ...list]));
    });
    await wait(3000);

    expect(writes().map(write => write.op)).toEqual(['upsert']);
    expect(onServer('movements', 'm1')).toBeDefined();
  });
});
