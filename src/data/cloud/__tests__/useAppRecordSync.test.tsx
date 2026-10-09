import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, render} from '@testing-library/react';
import {useState} from 'react';
import type {CloudRecord, WriteOutcome} from '../appRecords';
import {mergeRemote} from '../remoteChanges';

const api = vi.hoisted(() => ({
  writeAppRecords: vi.fn(),
  deleteAppRecords: vi.fn(),
  loadRecordsById: vi.fn(),
  loadBarcodes: vi.fn(),
  loadChangedRecords: vi.fn(),
}));

vi.mock('../appRecords', () => ({
  writeAppRecords: api.writeAppRecords,
  deleteAppRecords: api.deleteAppRecords,
  loadRecordsById: api.loadRecordsById,
  loadBarcodes: api.loadBarcodes,
  loadTable: vi.fn(),
}));
vi.mock('../remoteChanges', async importOriginal => ({
  ...(await importOriginal<typeof import('../remoteChanges')>()),
  loadChangedRecords: api.loadChangedRecords,
  loadDeletedIds: async () => ({ids: []}),
}));
vi.mock('../realtime', () => ({isRealtimeLive: () => false, onRemoteChange: () => () => undefined}));
vi.mock('../localCache', () => ({takeRestored: () => undefined, writeCollection: async () => undefined}));

const {useAppRecordSync, onSyncNotice, unsavedChanges} = await import('../useAppRecordSync');
const {syncNoticeMessage} = await import('../../../components/layout/syncNoticeMessage');

type Tool = CloudRecord & {barcode: string; name: string};
const tool = (n: number, name = `Tool ${n}`): Tool => ({id: `t${n}`, barcode: `T${String(n).padStart(6, '0')}`, name});
const saved = (): WriteOutcome => ({rejected: [], stale: [], refused: []});

let store: Tool[] = [];
let setStore: (update: (list: Tool[]) => Tool[]) => void = () => undefined;
function Harness({initial}: {initial: Tool[]}) {
  const [items, setItems] = useState(initial);
  store = items;
  setStore = setItems;
  useAppRecordSync('org-1', 'tools', items, (remote, removed) =>
    setItems(list => mergeRemote(list, remote as Tool[], removed)),
  );
  return null;
}
const change = (update: (list: Tool[]) => Tool[]) => act(() => setStore(update));
/** Lets time pass in small steps, so React renders what each timer changed before the next one fires. */
const wait = async (ms: number) => {
  for (let passed = 0; passed < ms; passed += 100) await act(() => vi.advanceTimersByTimeAsync(100));
};
/** What each save sent, by record id. */
const sent = () => api.writeAppRecords.mock.calls.map(call => (call[2] as Tool[]).map(item => item.id));

describe('saving a collection to the cloud', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(api).forEach(fn => fn.mockReset());
    api.writeAppRecords.mockResolvedValue(saved());
    api.deleteAppRecords.mockResolvedValue([]);
    api.loadRecordsById.mockResolvedValue([]);
    api.loadBarcodes.mockResolvedValue([]);
    api.loadChangedRecords.mockResolvedValue({records: []});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('gives a new instrument the next free barcode when another station took it, saves it again and says so', async () => {
    const notices: unknown[] = [];
    const stop = onSyncNotice(notice => notices.push(notice));
    render(<Harness initial={[tool(1)]} />);
    // Another station saved T000002…T000005 meanwhile; this one also handed out T000002.
    api.loadBarcodes.mockResolvedValue(['T000001', 'T000002', 'T000003', 'T000004', 'T000005']);
    api.writeAppRecords.mockResolvedValueOnce({...saved(), rejected: ['t2']});
    await change(list => [tool(2, 'New'), ...list]);
    await wait(2000);

    expect(store.find(item => item.id === 't2')?.barcode).toBe('T000006');
    const second = api.writeAppRecords.mock.calls[1][2] as Tool[];
    expect(second).toEqual([expect.objectContaining({id: 't2', barcode: 'T000006'})]);
    expect(notices).toEqual([{kind: 'barcode', collection: 'tools', changes: [{from: 'T000002', to: 'T000006'}]}]);
    expect(syncNoticeMessage(notices[0] as never).text).toBe(
      'Το barcode T000002 είχε ήδη δοθεί από άλλον σταθμό. Το νέο εργαλείο πήρε το T000006 — τυπώστε ξανά την ετικέτα.',
    );
    expect(unsavedChanges()).toBe(0);
    stop();
  });

  it('drops a record the server refuses for good and keeps saving (and reading) the rest', async () => {
    const notices: unknown[] = [];
    const stop = onSyncNotice(notice => notices.push(notice));
    const server = tool(1);
    render(<Harness initial={[server, tool(3)]} />);
    api.writeAppRecords.mockResolvedValueOnce({
      ...saved(),
      refused: [
        {id: 't1', code: '42501', message: 'row-level security'},
        {id: 't2', code: '42501', message: 'row-level security'},
      ],
    });
    // The changed one exists on the server (it goes back to that version); the new one does not (it goes).
    api.loadRecordsById.mockResolvedValue([server]);
    await change(list => [tool(2, 'New'), ...list.map(item => (item.id === 't1' ? {...item, name: 'Edited'} : item))]);
    await wait(2000);

    expect(store.map(item => item.id)).toEqual(['t1', 't3']);
    expect(store[0]).toBe(server);
    expect(notices).toEqual([
      {
        kind: 'refused',
        records: [
          {label: 'T000001 · Tool 1', reverted: true, reason: 'permission'},
          {label: 'T000002 · New', reverted: false, reason: 'permission'},
        ],
      },
    ]);
    expect(unsavedChanges()).toBe(0);

    // Not blocked: the next change is saved, and looking for other devices' changes resumes.
    await change(list => list.map(item => (item.id === 't3' ? {...item, name: 'Later'} : item)));
    await wait(1000);
    expect(sent().at(-1)).toEqual(['t3']);
    expect(unsavedChanges()).toBe(0);
    api.loadChangedRecords.mockClear();
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(api.loadChangedRecords).toHaveBeenCalled();
    stop();
  });

  it('tries again after a network error, further apart each time, and starts over after a success', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<Harness initial={[tool(1)]} />);
    const times: number[] = [];
    let failing = 3;
    api.writeAppRecords.mockImplementation(async () => {
      times.push(Date.now());
      if (failing-- > 0) throw new Error('Failed to fetch');
      return saved();
    });
    await change(list => list.map(item => ({...item, name: 'Edited'})));
    await wait(60000);
    const gaps = times.slice(1).map((time, i) => time - times[i]);
    // Each wait (5 s, 10 s, 20 s) plus the short pause before a save.
    expect(gaps).toEqual([5400, 10400, 20400]);
    expect(unsavedChanges()).toBe(0);

    times.length = 0;
    failing = 1;
    await change(list => list.map(item => ({...item, name: 'Again'})));
    await wait(10000);
    expect(times[1] - times[0]).toBe(5400);
  });
});
