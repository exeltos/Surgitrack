import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
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
const store = vi.hoisted(() => ({role: 'ADMIN', addToBin: vi.fn()}));
vi.mock('../../../store/SurgiStore', () => ({
  useSurgi: () => ({
    organizationId: 'org-1',
    role: store.role,
    can: () => true,
    sterilizationCycles: [],
    processLoads: [],
    addToBin: store.addToBin,
    currentUser: {name: 'ΔΙΑΧΕΙΡΙΣΤΗΣ'},
  }),
}));

// The hospital's sterilizers and washers (Studio › Libraries): one has a device, one has not.
vi.mock('../../../core/LibraryStore', () => ({
  useLibraries: () => ({
    sterilizers: [
      {id: 'st1', el: 'ΚΛΙΒΑΝΟΣ 1', en: 'Sterilizer 1'},
      {id: 'st2', el: 'ΚΛΙΒΑΝΟΣ 2', en: 'Sterilizer 2'},
    ],
    washers: [{id: 'w1', el: 'ΠΛΥΝΤΗΡΙΟ 1', en: 'Washer 1'}],
  }),
}));
const {default: DevicesPage} = await import('../DevicesPage');

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
    <AppPreferencesProvider>
      <DevicesPage />
    </AppPreferencesProvider>,
  );

beforeEach(() => {
  db.devices = [autoclave, washer];
  db.readings = [reading('1042'), reading('1043'), reading('W-7', 'd2')];
  db.fail = '';
  db.deleted = [];
  store.role = 'ADMIN';
  store.addToBin.mockClear();
});

describe('Connected devices', () => {
  it('lists the hospital devices, inactive ones marked', async () => {
    open();
    expect(await screen.findByText('ΚΛΙΒΑΝΟΣ 1')).toBeInTheDocument();
    const card = screen.getByText('ΠΛΥΝΤΗΡΙΟ 1').closest('.device-card') as HTMLElement;
    expect(within(card).getByText('Ανενεργή')).toBeInTheDocument();
  });

  it('shows the cycles of the device picked, and only those', async () => {
    open();
    const cycles = await screen.findByRole('region', {name: 'Τελευταίοι κύκλοι'});
    expect(within(cycles).getByText('1042')).toBeInTheDocument();
    expect(within(cycles).queryByText('W-7')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('ΠΛΥΝΤΗΡΙΟ 1'));
    const washerCycles = await screen.findByRole('region', {name: 'Τελευταίοι κύκλοι'});
    expect(within(washerCycles).getByText('W-7')).toBeInTheDocument();
    expect(within(washerCycles).queryByText('1042')).not.toBeInTheDocument();
  });

  it('deletes a device only after confirmation, keeping it in the recycle bin first', async () => {
    open();
    const card = (await screen.findByText('ΚΛΙΒΑΝΟΣ 1')).closest('.device-card') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', {name: 'Διαγραφή'}));
    expect(db.deleted).toEqual([]);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', {name: /Διαγραφή/}));
    await waitFor(() => expect(db.deleted).toEqual(['d1']));
    expect(store.addToBin).toHaveBeenCalledTimes(1);
    // Gone from the devices (it is offered again as a library sterilizer with no device).
    await waitFor(() =>
      expect(within(document.querySelector('.devices-grid') as HTMLElement).queryByText('ΚΛΙΒΑΝΟΣ 1')).toBeNull(),
    );
  });

  it('lets only the hospital admin add, edit or delete devices', async () => {
    store.role = 'STERILIZATION';
    open();
    await screen.findByText('ΚΛΙΒΑΝΟΣ 1');
    expect(screen.queryByRole('button', {name: /Νέα συσκευή/})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Διαγραφή'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Επεξεργασία'})).not.toBeInTheDocument();
  });

  it('says what went wrong when the devices cannot be read', async () => {
    db.fail = 'network down';
    open();
    expect(await screen.findByText(/network down/)).toBeInTheDocument();
  });

  it('offers the library sterilizers that have no device yet, named, to the admin', async () => {
    open();
    const strip = await screen.findByRole('region', {name: 'Χωρίς σύνδεση'});
    expect(
      within(strip)
        .getAllByRole('button')
        .map(b => b.textContent?.trim()),
    ).toEqual(['ΚΛΙΒΑΝΟΣ 2']);
    fireEvent.click(within(strip).getByRole('button', {name: /ΚΛΙΒΑΝΟΣ 2/}));
    expect((screen.getByRole('combobox', {name: /Όνομα/}) as HTMLInputElement).value).toBe('ΚΛΙΒΑΝΟΣ 2');
  });
});
