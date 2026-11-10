import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AppPreferencesProvider} from '../../../core/AppPreferences';
import type {Device, DeviceReading} from '../../../core/deviceData';

// The page talks to the devices tables directly; these stand in for them.
const db = vi.hoisted(() => ({
  devices: [] as Device[],
  readings: [] as DeviceReading[],
  fail: '' as string,
  deleted: [] as string[],
}));
vi.mock('../../../data/cloud/devices', () => ({
  listDevices: async () => {
    if (db.fail) throw new Error(db.fail);
    return db.devices;
  },
  listReadings: async () => db.readings,
  saveDevice: vi.fn(),
  storeReadings: vi.fn(),
  issueDeviceKey: vi.fn(),
  snapshotDevice: async (_org: string, device: Device) => ({device, readings: [], readingsTotal: 0}),
  deleteDevice: async (_org: string, id: string) => {
    db.deleted.push(id);
    db.devices = db.devices.filter(d => d.id !== id);
  },
}));
const store = vi.hoisted(() => ({role: 'ADMIN', addToBin: vi.fn(), loads: [] as unknown[]}));
vi.mock('../../../store/SurgiStore', () => ({
  useSurgi: () => ({
    organizationId: 'org-1',
    role: store.role,
    can: () => true,
    sterilizationCycles: [],
    processLoads: store.loads,
    tools: [],
    addToBin: store.addToBin,
    currentUser: {name: 'ΔΙΑΧΕΙΡΙΣΤΗΣ'},
  }),
}));

// The hospital's sterilizers and washers (Studio › Libraries): one has a device, one has not.
const lib = vi.hoisted(() => ({
  sterilizers: [] as Array<{id: string; el: string; en: string; outOfService?: unknown}>,
  washers: [] as Array<{id: string; el: string; en: string; outOfService?: unknown}>,
  updateItem: vi.fn(),
}));
vi.mock('../../../core/LibraryStore', () => ({useLibraries: () => lib}));
const {default: EquipmentPage} = await import('../EquipmentPage');

const autoclave: Device = {
  id: 'd1',
  name: 'ΚΛΙΒΑΝΟΣ 1',
  kind: 'STERILIZER',
  connection: 'API',
  active: true,
  manufacturer: 'MATACHANA',
};
const washer: Device = {id: 'd2', name: 'ΠΛΥΝΤΗΡΙΟ 1', kind: 'WASHER', connection: 'FILE', active: false};
const reading = (n: string, deviceId = 'd1'): DeviceReading => ({
  id: `r${n}`,
  deviceId,
  cycleNumber: n,
  program: '134°C',
  result: 'PASS',
  source: 'API',
  createdAt: '2026-10-10T07:00:00Z',
});

const open = () =>
  render(
    <MemoryRouter>
      <AppPreferencesProvider>
        <EquipmentPage />
      </AppPreferencesProvider>
    </MemoryRouter>,
  );
/** The row of a piece of equipment. */
const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr') as HTMLElement;
const details = async (name: string) => {
  fireEvent.click(within(await rowOf(name)).getByRole('button', {name: /Λεπτομέρειες/}));
  return screen.findByRole('dialog', {name});
};

beforeEach(() => {
  lib.sterilizers = [
    {id: 'st1', el: 'ΚΛΙΒΑΝΟΣ 1', en: 'Sterilizer 1'},
    {id: 'st2', el: 'ΚΛΙΒΑΝΟΣ 2', en: 'Sterilizer 2'},
  ];
  lib.washers = [{id: 'w1', el: 'ΠΛΥΝΤΗΡΙΟ 1', en: 'Washer 1'}];
  lib.updateItem = vi.fn((key: 'sterilizers' | 'washers', id: string, patch: Record<string, unknown>) => {
    lib[key] = lib[key].map(item => (item.id === id ? {...item, ...patch} : item));
  });
  db.devices = [autoclave, washer];
  db.readings = [reading('1042'), reading('1043'), reading('W-7', 'd2')];
  db.fail = '';
  db.deleted = [];
  store.role = 'ADMIN';
  store.loads = [];
  store.addToBin.mockClear();
});

describe('Sterilizers & Devices, one screen', () => {
  it('lists every piece of equipment in a row: the library sterilizers and washers and the connected devices', async () => {
    open();
    expect((await rowOf('ΚΛΙΒΑΝΟΣ 1')).textContent).toContain('Δίκτυο');
    expect((await rowOf('ΚΛΙΒΑΝΟΣ 2')).textContent).toContain('Χωρίς σύνδεση');
    const washerRow = await rowOf('ΠΛΥΝΤΗΡΙΟ 1');
    expect(within(washerRow).getByText('Ανενεργή')).toBeInTheDocument();
  });

  it('shows the running load of a sterilizer in its row and the Sets and instruments in its card', async () => {
    store.loads = [
      {
        id: 'L1',
        kind: 'STERILIZATION',
        status: 'OPEN',
        equipment: 'ΚΛΙΒΑΝΟΣ 1',
        cycleNumber: '2026-1',
        program: '134°C · 5 min',
        createdAt: '09/11/2026 10:00',
        createdByName: 'Χ',
        items: [{assetId: 's1', assetKind: 'SET', barcode: 'S000334', assetName: 'ΥΣΤΕΡΟΣΚΟΠΗΣΗΣ', department: 'Χ'}],
      },
    ];
    open();
    const row = await rowOf('ΚΛΙΒΑΝΟΣ 1');
    expect(row.textContent).toContain('2026-1');
    expect(within(await rowOf('ΚΛΙΒΑΝΟΣ 2')).getByText('Ελεύθερος')).toBeInTheDocument();
    const card = await details('ΚΛΙΒΑΝΟΣ 1');
    expect(within(card).getByText('S000334')).toBeInTheDocument();
    expect(within(card).getByText('ΥΣΤΕΡΟΣΚΟΠΗΣΗΣ')).toBeInTheDocument();
  });

  it('shows the cycles of the device whose card is open, and only those', async () => {
    open();
    const card = await details('ΚΛΙΒΑΝΟΣ 1');
    const cycles = within(card).getByRole('region', {name: 'Τελευταίοι κύκλοι'});
    expect(within(cycles).getByText('1042')).toBeInTheDocument();
    expect(within(cycles).queryByText('W-7')).not.toBeInTheDocument();
  });

  it('deletes a device only after confirmation, keeping it in the recycle bin first', async () => {
    open();
    const card = await details('ΚΛΙΒΑΝΟΣ 1');
    fireEvent.click(within(card).getByRole('button', {name: 'Διαγραφή'}));
    expect(db.deleted).toEqual([]);
    const confirm = screen.getAllByRole('dialog').find(d => /Θα διαγραφεί/.test(d.textContent || '')) as HTMLElement;
    fireEvent.click(within(confirm).getByRole('button', {name: /Διαγραφή/}));
    await waitFor(() => expect(db.deleted).toEqual(['d1']));
    expect(store.addToBin).toHaveBeenCalledTimes(1);
    // Gone from the devices: it is a library sterilizer with no device again.
    await waitFor(async () => expect((await rowOf('ΚΛΙΒΑΝΟΣ 1')).textContent).toContain('Χωρίς σύνδεση'));
  });

  it('lets only the hospital admin add, edit or delete devices', async () => {
    store.role = 'STERILIZATION';
    open();
    const card = await details('ΚΛΙΒΑΝΟΣ 1');
    expect(screen.queryByRole('button', {name: /Νέα συσκευή/})).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', {name: 'Διαγραφή'})).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', {name: 'Επεξεργασία'})).not.toBeInTheDocument();
  });

  it('says what went wrong when the devices cannot be read', async () => {
    db.fail = 'network down';
    open();
    expect(await screen.findByText(/network down/)).toBeInTheDocument();
  });

  it('offers the admin to connect a library sterilizer that has no device, named', async () => {
    open();
    const card = await details('ΚΛΙΒΑΝΟΣ 2');
    fireEvent.click(within(card).getByRole('button', {name: /Σύνδεση συσκευής/}));
    expect((screen.getByRole('combobox', {name: /Όνομα/}) as HTMLInputElement).value).toBe('ΚΛΙΒΑΝΟΣ 2');
  });

  it('takes a sterilizer out of service with a reason, and puts it back', async () => {
    open();
    const card = await details('ΚΛΙΒΑΝΟΣ 2');
    fireEvent.click(within(card).getByRole('button', {name: 'Εκτός λειτουργίας'}));
    const dialog = await screen.findByRole('dialog', {name: 'Εκτός λειτουργίας'});
    fireEvent.click(within(dialog).getByRole('radio', {name: 'Συντήρηση'}));
    fireEvent.change(within(dialog).getByLabelText(/Σημείωση/), {target: {value: 'Καλέστηκε ο τεχνικός'}});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Εκτός λειτουργίας'}));
    expect(lib.updateItem).toHaveBeenCalledWith(
      'sterilizers',
      'st2',
      expect.objectContaining({
        outOfService: expect.objectContaining({
          reason: 'MAINTENANCE',
          note: 'Καλέστηκε ο τεχνικός',
          by: 'ΔΙΑΧΕΙΡΙΣΤΗΣ',
        }),
      }),
    );
    // The card stays open and now says it, with the note.
    const again = await screen.findByRole('dialog', {name: 'ΚΛΙΒΑΝΟΣ 2'});
    expect(within(again).getByText(/Καλέστηκε ο τεχνικός/)).toBeInTheDocument();
    fireEvent.click(within(again).getByRole('button', {name: 'Επαναφορά σε λειτουργία'}));
    expect(lib.updateItem).toHaveBeenLastCalledWith('sterilizers', 'st2', {outOfService: undefined});
    expect(within(await screen.findByRole('dialog', {name: 'ΚΛΙΒΑΝΟΣ 2'})).queryByText(/Καλέστηκε/)).toBeNull();
  });

  it('cannot take out of service a sterilizer that is running a cycle', async () => {
    store.loads = [
      {
        id: 'L1',
        kind: 'STERILIZATION',
        status: 'OPEN',
        equipment: 'ΚΛΙΒΑΝΟΣ 1',
        cycleNumber: '1',
        program: '134°C',
        createdAt: '09/11/2026 10:00',
        createdByName: 'Χ',
        items: [],
      },
    ];
    open();
    const card = await details('ΚΛΙΒΑΝΟΣ 1');
    expect(within(card).getByRole('button', {name: 'Εκτός λειτουργίας'})).toBeDisabled();
  });

  it('counts the failures of the last 30 days and asks for a check at three', async () => {
    const failed = (id: string, at: string) => ({
      id,
      kind: 'STERILIZATION',
      status: 'FAILED',
      equipment: 'ΚΛΙΒΑΝΟΣ 2',
      cycleNumber: id,
      program: '134°C',
      createdAt: at,
      completedAt: at,
      createdByName: 'Χ',
      items: [],
    });
    const today = new Date();
    const stamp = (daysAgo: number) => {
      const d = new Date(today.getTime() - daysAgo * 86400000);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} 10:00`;
    };
    store.loads = [failed('F1', stamp(1)), failed('F2', stamp(5)), failed('F3', stamp(9))];
    open();
    expect(within(await rowOf('ΚΛΙΒΑΝΟΣ 2')).getByText('3')).toBeInTheDocument();
    const card = await details('ΚΛΙΒΑΝΟΣ 2');
    expect(within(card).getByText(/ελέγξτε τον κλίβανο/)).toBeInTheDocument();
    expect(within(card).getAllByText('Αποτυχία κύκλου')).toHaveLength(3);
  });
});
