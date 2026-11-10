import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {
  Cable,
  CheckCircle2,
  Flame,
  FlaskConical,
  Hourglass,
  ListTree,
  Plus,
  Power,
  TriangleAlert,
  Wrench,
  RefreshCcw,
  Upload,
  Wifi,
  X,
  XCircle,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import KpiStrip from '../../components/ui/KpiStrip';
import {equipmentTrouble} from '../../core/equipmentHealth';
import OutOfServiceDialog from './OutOfServiceDialog';
import TestDialog from './TestDialog';
import {TEST_KINDS, testKindOfProgram, testsInUse, testsState, withTest} from '../../core/equipmentTests';
import type {EquipmentTest} from '../../core/libraries';
import AppButton from '../../components/ui/AppButton';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {useSurgi} from '../../store/SurgiStore';
import {useAppPreferences} from '../../core/AppPreferences';
import {useLibraries} from '../../core/LibraryStore';
import {useHasModule} from '../../data/cloud/modulesContext';
import {getRuntimeDataMode} from '../../config/dataMode';
import {
  deviceKindLabel,
  type Device,
  type DeviceKind,
  type DeviceReading,
  type ReadingDraft,
} from '../../core/deviceData';
import {MIN_HOLD_PRESSURE} from '../../core/cycleSimulator';
import {
  deleteDevice,
  snapshotDevice,
  issueDeviceKey,
  listDevices,
  listReadings,
  saveDevice,
  storeReadings,
  type DeviceInput,
} from '../../data/cloud/devices';
import {isSimulatedDevice, simulatedDeviceName} from '../../data/cloud/simulatedDevice';
import {DeviceEditor, FileDialog, KeyDialog, SerialDialog} from './DeviceDialogs';
import EquipmentDetails, {type EquipmentRow} from './EquipmentDetails';
import {binEntryForDevice} from '../../core/recycleBin';
import {messageOf} from './deviceUi';
import {formatDateTime} from '../../core/displayDate';
import {phaseText} from '../sterilization/parts/cycleLabels';
import {liveOf, useNow} from '../sterilization/parts/simulationClock';

const connectionShort = {
  API: {el: 'Δίκτυο', en: 'Network'},
  FILE: {el: 'Αρχείο', en: 'File'},
  SERIAL: {el: 'Καλώδιο', en: 'Cable'},
};
const emptyDevice: DeviceInput = {name: '', kind: 'STERILIZER', connection: 'FILE', active: true};

/**
 * Sterilizers and washers on one screen: a row for each piece of the hospital's equipment (Studio › Libraries) and
 * for each connected device, with what is common to them: the state, the cycle running (live for a simulated one),
 * its readings and progress, what is in it, how it connects, and the last cycle. «Λεπτομέρειες» opens its card
 * with the load, the Sets and instruments inside, and the device's own actions and cycles.
 */
export default function EquipmentPage() {
  const {organizationId, role, can, sterilizationCycles, processLoads, addToBin, currentUser} = useSurgi();
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const withDevices = useHasModule('DEVICES');
  const devicesEnabled = withDevices && !!organizationId;
  const isAdmin = role === 'ADMIN';
  const canRecord = can('sterilization.workspace');
  // In the Demo, a load with no simulation can be given one (in its card, with the scenarios).
  const canSimulate = getRuntimeDataMode() === 'DEMO' && can('sterilization.cycle');
  const {sterilizers, washers, updateEquipment} = useLibraries();
  // Taking a sterilizer out of use and back is the supervisor's (the same permission as the hospital's set-up).
  const canConfigure = can('asset.usage.configure');
  const [outFor, setOutFor] = useState<EquipmentRow>();
  const [testFor, setTestFor] = useState<{row: EquipmentRow; kind: EquipmentTest['kind']}>();
  const [devices, setDevices] = useState<Device[]>([]);
  const [readings, setReadings] = useState<DeviceReading[]>([]);
  const [loading, setLoading] = useState(devicesEnabled);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // The piece of equipment whose page is open is in the address, so «Πίσω» of the browser returns to the list.
  const [searchParams, setSearchParams] = useSearchParams();
  const openKey = searchParams.get('equipment') || '';
  const setOpenKey = (key: string) => setSearchParams(key ? {equipment: key} : {});
  const [editor, setEditor] = useState<{id?: string; value: DeviceInput}>();
  const [removing, setRemoving] = useState<Device>();
  const [keyFor, setKeyFor] = useState<{device: Device; key?: string; busy?: boolean}>();
  const [fileFor, setFileFor] = useState<Device>();
  const [serialFor, setSerialFor] = useState<Device>();

  const load = useCallback(async () => {
    if (!organizationId || !withDevices) return;
    setLoading(true);
    setError('');
    try {
      const [list, latest] = await Promise.all([
        listDevices(organizationId),
        listReadings(organizationId, {limit: 500}),
      ]);
      setDevices(list);
      setReadings(latest);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, [organizationId, withDevices]);
  useEffect(() => {
    void load();
  }, [load]);

  const sterilizerLoads = processLoads.filter(l => l.kind === 'STERILIZATION');
  const running = sterilizerLoads.filter(l => l.status === 'OPEN');
  const now = useNow(running.some(l => !!l.simulation));
  const usedNumbers = useMemo(
    () =>
      new Set(
        [...sterilizationCycles.map(c => c.cycleNumber), ...processLoads.map(l => l.cycleNumber)].map(n =>
          String(n || '')
            .trim()
            .toUpperCase(),
        ),
      ),
    [sterilizationCycles, processLoads],
  );

  // The hospital's equipment first (as Libraries lists it), then the devices that match none of it.
  const rows = useMemo<EquipmentRow[]>(() => {
    const library = [
      ...sterilizers.map(item => ({
        name: item.el,
        kind: 'STERILIZER' as DeviceKind,
        libraryKey: 'sterilizers' as const,
        libraryId: item.id,
        outOfService: item.outOfService,
        tests: item.tests,
      })),
      ...washers.map(item => ({
        name: item.el,
        kind: 'WASHER' as DeviceKind,
        libraryKey: 'washers' as const,
        libraryId: item.id,
        outOfService: item.outOfService,
      })),
    ];
    const matched = new Set<string>();
    const list: EquipmentRow[] = library.map(item => {
      // The device of that name; or, for a sterilizer with none, the simulated one that sends its simulated cycles.
      const device =
        devices.find(d => d.name.trim() === item.name && !matched.has(d.id)) ??
        devices.find(d => isSimulatedDevice(d) && d.name === simulatedDeviceName(item.name) && !matched.has(d.id));
      if (device) matched.add(device.id);
      return {key: `lib:${item.kind}:${item.name}`, device, ...item};
    });
    for (const device of devices)
      if (!matched.has(device.id)) list.push({key: `dev:${device.id}`, name: device.name, kind: device.kind, device});
    // A load that runs in a sterilizer the library does not list still shows.
    for (const l of running)
      if (!list.some(r => r.kind === 'STERILIZER' && r.name === l.equipment))
        list.push({key: `load:${l.equipment}`, name: l.equipment, kind: 'STERILIZER'});
    return list.map(row =>
      row.kind === 'STERILIZER'
        ? {
            ...row,
            load: running.find(l => l.equipment === row.name),
            lastLoad: sterilizerLoads.find(l => l.equipment === row.name && l.status !== 'OPEN'),
            trouble: equipmentTrouble(row.name, sterilizerLoads),
          }
        : row,
    );
  }, [sterilizers, washers, devices, running, sterilizerLoads]);
  // The results a sterilizer's test devices sent become its tests (once each, as a person's own record would).
  const importedTests = useRef(new Set<string>());
  useEffect(() => {
    if (!canRecord || loading) return;
    for (const row of rows) {
      if (row.kind !== 'STERILIZER' || !row.libraryKey || !row.libraryId) continue;
      const linked = devices.filter(d => d.kind === 'TEST' && d.testsEquipment === row.name);
      if (!linked.length) continue;
      const known = new Set((row.tests || []).map(test => test.id));
      const fresh = readings
        .filter(r => linked.some(d => d.id === r.deviceId) && r.result !== 'UNKNOWN')
        .map(r => ({reading: r, kind: testKindOfProgram(r.program), id: `dev-${r.id}`}))
        .filter(item => item.kind && !known.has(item.id) && !importedTests.current.has(item.id))
        .sort((a, b) =>
          (a.reading.startedAt || a.reading.createdAt).localeCompare(b.reading.startedAt || b.reading.createdAt),
        );
      if (!fresh.length) continue;
      fresh.forEach(item => importedTests.current.add(item.id));
      let next = row.tests;
      for (const item of fresh) {
        next = withTest(next, {
          id: item.id,
          kind: item.kind!,
          result: item.reading.result === 'PASS' ? 'PASS' : 'FAIL',
          at: formatDateTime(item.reading.startedAt || item.reading.endedAt || item.reading.createdAt),
          by: linked.find(d => d.id === item.reading.deviceId)?.name || '',
          note: item.reading.program,
        });
      }
      void updateEquipment(row.libraryKey, row.libraryId, {tests: next}).catch(() => {
        // Tried again the next time the page is opened.
        fresh.forEach(item => importedTests.current.delete(item.id));
      });
    }
  }, [rows, devices, readings, canRecord, loading, updateEquipment]);

  const lastReading = (id: string) => readings.find(r => r.deviceId === id);
  const when = (iso?: string) => (iso ? formatDateTime(iso) : '—');
  const opened = rows.find(r => r.key === openKey);
  const busy = rows.filter(r => r.load).length;
  const outCount = rows.filter(r => r.outOfService).length;
  // Missing tests are pointed out only where the hospital records tests at all; a failed one always is.
  const withTests = testsInUse(sterilizers);
  const testStateOf = (row: EquipmentRow) =>
    row.kind === 'STERILIZER' && row.libraryId && (withTests || row.tests?.length) ? testsState(row.tests) : undefined;
  const attention = rows.filter(
    r => !r.outOfService && (r.trouble?.attention || (testStateOf(r) && testStateOf(r) !== 'OK')),
  ).length;
  const recordTest = async (
    row: EquipmentRow,
    kind: EquipmentTest['kind'],
    value: {result: EquipmentTest['result']; note?: string},
  ) => {
    if (!row.libraryKey || !row.libraryId) return;
    const test: EquipmentTest = {id: `t${Date.now()}`, kind, ...value, at: formatDateTime(), by: currentUser.name};
    try {
      await updateEquipment(row.libraryKey, row.libraryId, {tests: withTest(row.tests, test)});
    } catch (e) {
      setError(L('Η δοκιμή δεν αποθηκεύτηκε: ', 'The test was not saved: ') + messageOf(e));
      return;
    }
    const label = TEST_KINDS.find(item => item.id === kind);
    setNotice(
      value.result === 'FAIL'
        ? L(
            `${row.name}: αποτυχημένη δοκιμή (${label?.el}). Ο κλίβανος δεν φορτώνεται μέχρι επιτυχή δοκιμή.`,
            `${row.name}: test failed (${label?.en}). It is not loaded until a test passes.`,
          )
        : L(`${row.name}: καταγράφηκε η δοκιμή ${label?.el}.`, `${row.name}: ${label?.en} recorded.`),
    );
  };
  const setOutOfService = async (row: EquipmentRow, value?: {reason: 'BREAKDOWN' | 'MAINTENANCE'; note?: string}) => {
    if (!row.libraryKey || !row.libraryId) return;
    try {
      await updateEquipment(row.libraryKey, row.libraryId, {
        outOfService: value ? {...value, since: formatDateTime(), by: currentUser.name} : null,
      });
      setNotice(
        value
          ? L(`${row.name}: εκτός λειτουργίας.`, `${row.name}: out of service.`)
          : L(`${row.name}: ξανά σε λειτουργία.`, `${row.name}: back in service.`),
      );
    } catch (e) {
      setError(L('Η αλλαγή δεν αποθηκεύτηκε: ', 'The change was not saved: ') + messageOf(e));
    }
  };

  const save = async () => {
    if (!organizationId || !editor || !editor.value.name.trim()) return;
    try {
      await saveDevice(organizationId, editor.value, editor.id);
      setEditor(undefined);
      await load();
    } catch (e) {
      setError(messageOf(e));
    }
  };
  const remove = async (device: Device) => {
    if (!organizationId) return;
    setRemoving(undefined);
    try {
      // Kept in the recycle bin first (with its newest cycles), so it can be put back for 30 days.
      const snapshot = await snapshotDevice(organizationId, device);
      addToBin(
        binEntryForDevice(
          snapshot.device as unknown as Record<string, unknown>,
          snapshot.readings as unknown as Record<string, unknown>[],
          snapshot.readingsTotal,
          currentUser.name,
        ),
      );
      await deleteDevice(organizationId, device.id);
      setOpenKey('');
      await load();
    } catch (e) {
      setError(messageOf(e));
    }
  };
  const makeKey = async (device: Device) => {
    setKeyFor({device, busy: true});
    try {
      const key = await issueDeviceKey(device.id);
      setKeyFor({device, key});
      await load();
    } catch (e) {
      setKeyFor(undefined);
      setError(L('Το κλειδί δεν δημιουργήθηκε: ', 'The key was not created: ') + messageOf(e));
    }
  };
  const stored = async (device: Device, source: 'FILE' | 'SERIAL', drafts: ReadingDraft[]) => {
    if (!organizationId) return;
    const added = await storeReadings(organizationId, device.id, source, drafts);
    setNotice(
      L(
        `${device.name}: ${added} νέοι κύκλοι αποθηκεύτηκαν${drafts.length - added ? `, ${drafts.length - added} υπήρχαν ήδη` : ''}.`,
        `${device.name}: ${added} new cycles stored${drafts.length - added ? `, ${drafts.length - added} were already there` : ''}.`,
      ),
    );
    await load();
  };

  return (
    <div className="devices-page equipment-page">
      {!opened && (
        <PageHeader
          eyebrow={L('ΚΕΝΤΡΙΚΗ ΑΠΟΣΤΕΙΡΩΣΗ', 'CENTRAL STERILE SERVICES')}
          title={L('Κλίβανοι & Συσκευές', 'Sterilizers & Devices')}
          description={
            rows.length === 0
              ? L('Δεν έχουν οριστεί κλίβανοι ή συσκευές.', 'No sterilizers or devices are set.')
              : busy
                ? L(
                    `${busy} σε λειτουργία · ${rows.length - busy} ελεύθεροι`,
                    `${busy} running · ${rows.length - busy} free`,
                  )
                : L('Όλος ο εξοπλισμός είναι ελεύθερος.', 'All the equipment is free.')
          }
          actions={
            <div className="devices-head-actions">
              {devicesEnabled && (
                <AppButton onClick={() => void load()} disabled={loading}>
                  <RefreshCcw size={15} />
                  {L('Ανανέωση', 'Refresh')}
                </AppButton>
              )}
              {devicesEnabled && isAdmin && (
                <AppButton variant="primary" onClick={() => setEditor({value: {...emptyDevice}})}>
                  <Plus size={16} />
                  {L('Νέα συσκευή', 'New device')}
                </AppButton>
              )}
            </div>
          }
        />
      )}
      {error && (
        <div className="devices-alert" role="alert">
          <XCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label={L('Κλείσιμο', 'Close')}>
            <X size={14} />
          </button>
        </div>
      )}
      {notice && (
        <div className="devices-notice" role="status">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label={L('Κλείσιμο', 'Close')}>
            <X size={14} />
          </button>
        </div>
      )}
      {!opened && rows.length > 0 && (
        <KpiStrip
          className="equipment-kpis"
          compact
          items={[
            {label: L('Σε λειτουργία', 'Running'), value: busy, icon: <Flame size={16} aria-hidden="true" />},
            {
              label: L('Ελεύθεροι', 'Free'),
              value: rows.length - busy - outCount,
              icon: <Power size={16} aria-hidden="true" />,
            },
            {
              label: L('Εκτός λειτουργίας', 'Out of service'),
              value: outCount,
              icon: <Wrench size={16} aria-hidden="true" />,
              hint: L(
                'Βλάβη ή συντήρηση: δεν επιλέγονται για φορτία.',
                'Breakdown or maintenance: not chosen for loads.',
              ),
            },
            {
              label: L('Θέλουν έλεγχο', 'Need a check'),
              value: attention,
              icon: <TriangleAlert size={16} aria-hidden="true" />,
              hint: L(
                '3 ή περισσότερες αποτυχίες σε 30 ημέρες, ή δοκιμή που απέτυχε ή εκκρεμεί.',
                '3 or more failures in 30 days, or a test that failed or is due.',
              ),
            },
          ]}
        />
      )}
      {opened ? null : rows.length === 0 ? (
        <div className="devices-empty">
          <Cable size={26} />
          <b>{L('Δεν υπάρχει εξοπλισμός ακόμη.', 'No equipment yet.')}</b>
          <span>
            {L(
              'Οι κλίβανοι και τα πλυντήρια ορίζονται στις Βιβλιοθήκες· οι συσκευές που στέλνουν δεδομένα προστίθενται εδώ.',
              'Sterilizers and washers are set in Libraries; devices that send data are added here.',
            )}
          </span>
        </div>
      ) : (
        <div className="sterilizer-rows-wrap">
          <table className="sterilizer-rows equipment-rows">
            <thead>
              <tr>
                <th>{L('Εξοπλισμός', 'Equipment')}</th>
                <th>{L('Κατάσταση', 'State')}</th>
                <th>{L('Κύκλος', 'Cycle')}</th>
                <th>{L('Ενδείξεις', 'Readings')}</th>
                <th>{L('Πρόοδος', 'Progress')}</th>
                <th>{L('Αντικείμενα', 'Items')}</th>
                {devicesEnabled && <th>{L('Σύνδεση', 'Connection')}</th>}
                <th>{L('Δοκιμές', 'Tests')}</th>
                <th>{L('Αποτυχίες 30 ημ.', 'Failures, 30 days')}</th>
                <th>{L('Τελευταίος κύκλος', 'Last cycle')}</th>
                <th>
                  <span className="sr-only">{L('Ενέργειες', 'Actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const {device} = row;
                const live = row.load ? liveOf(row.load, now) : undefined;
                const last = device ? lastReading(device.id) : undefined;
                const ConnectionIcon =
                  device?.connection === 'API' ? Wifi : device?.connection === 'SERIAL' ? Cable : Upload;
                const stateText = row.load
                  ? live
                    ? phaseText(live.sample.phase)
                    : L('Σε εξέλιξη', 'Running')
                  : row.outOfService
                    ? row.outOfService.reason === 'BREAKDOWN'
                      ? L('Βλάβη', 'Breakdown')
                      : L('Συντήρηση', 'Maintenance')
                    : device && !device.active
                      ? L('Ανενεργή', 'Inactive')
                      : L('Ελεύθερος', 'Free');
                return (
                  <tr
                    key={row.key}
                    className={row.load ? (live?.done ? 'done' : 'busy') : row.outOfService ? 'out' : 'free'}
                  >
                    <td data-label={L('Εξοπλισμός', 'Equipment')}>
                      <span className="row-name">
                        {row.load ? (
                          live?.done ? (
                            <Hourglass size={16} aria-hidden="true" />
                          ) : (
                            <Flame size={16} aria-hidden="true" />
                          )
                        ) : (
                          <Power size={16} aria-hidden="true" />
                        )}
                        <b>{row.name}</b>
                        {device && isSimulatedDevice(device) && (
                          <span className="device-sim-badge">{L('Προσομοίωση', 'Simulation')}</span>
                        )}
                      </span>
                      <small>
                        {L(deviceKindLabel[row.kind].el, deviceKindLabel[row.kind].en)}
                        {device
                          ? ` · ${[device.manufacturer, device.model].filter(Boolean).join(' ')}`.replace(/ · $/, '')
                          : ''}
                      </small>
                    </td>
                    <td data-label={L('Κατάσταση', 'State')}>
                      <span
                        className={`row-phase${row.load ? (live?.done ? ' done' : '') : row.outOfService ? ' out' : ' idle'}`}
                      >
                        {stateText}
                      </span>
                      {row.load?.simulation && <small>{L('Προσομοίωση', 'Simulation')}</small>}
                    </td>
                    <td data-label={L('Κύκλος', 'Cycle')}>
                      {row.load ? (
                        <>
                          <b>{row.load.cycleNumber}</b>
                          <small>{row.load.program}</small>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td data-label={L('Ενδείξεις', 'Readings')} className="num">
                      {live ? (
                        <>
                          {live.sample.temperature.toFixed(1)} °C
                          <span
                            className={
                              live.sample.phase === 'HOLDING' && live.sample.pressure < MIN_HOLD_PRESSURE ? 'bad' : ''
                            }
                          >
                            {live.sample.pressure.toFixed(2)} bar
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td data-label={L('Πρόοδος', 'Progress')}>
                      {live ? (
                        <>
                          <div
                            className="tile-progress"
                            role="progressbar"
                            aria-valuenow={live.progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={L('Πρόοδος κύκλου', 'Cycle progress')}
                          >
                            <i style={{width: `${live.progress}%`}} />
                          </div>
                          <small>
                            {Math.floor(live.minute)} / {Math.ceil(live.end)} {L('λεπτά', 'min')}
                          </small>
                        </>
                      ) : row.load ? (
                        <small>{L('Χωρίς ζωντανά δεδομένα', 'No live data')}</small>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td data-label={L('Αντικείμενα', 'Items')} className="num">
                      {row.load ? row.load.items.length : '—'}
                    </td>
                    {devicesEnabled && (
                      <td data-label={L('Σύνδεση', 'Connection')}>
                        {device ? (
                          <span className="row-connection">
                            <ConnectionIcon size={14} />
                            {L(connectionShort[device.connection].el, connectionShort[device.connection].en)}
                            {device.connection === 'API' && device.keyHint ? ` …${device.keyHint}` : ''}
                          </span>
                        ) : (
                          <span className="muted">{L('Χωρίς σύνδεση', 'Not connected')}</span>
                        )}
                      </td>
                    )}
                    <td data-label={L('Δοκιμές', 'Tests')}>
                      {testStateOf(row) === 'FAILED' ? (
                        <span className="row-test bad">{L('Απέτυχε', 'Failed')}</span>
                      ) : testStateOf(row) === 'DUE' ? (
                        <span className="row-test due">{L('Εκκρεμεί', 'Due')}</span>
                      ) : testStateOf(row) === 'OK' ? (
                        <span className="row-test ok">{L('Εντάξει', 'Up to date')}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td data-label={L('Αποτυχίες 30 ημ.', 'Failures, 30 days')} className="num">
                      {row.kind !== 'STERILIZER' ? (
                        '—'
                      ) : row.trouble?.recent ? (
                        <span className={`row-trouble${row.trouble.attention ? ' attention' : ''}`}>
                          {row.trouble.attention && <TriangleAlert size={13} aria-hidden="true" />}
                          {row.trouble.recent}
                        </span>
                      ) : (
                        <span className="muted">0</span>
                      )}
                    </td>
                    <td data-label={L('Τελευταίος κύκλος', 'Last cycle')}>
                      {last ? (
                        <>
                          <b>{last.cycleNumber}</b>
                          <small>
                            {when(last.startedAt || last.createdAt)}
                            {last.result === 'FAIL' ? ` · ${L('Αποτυχία', 'Fail')}` : ''}
                          </small>
                        </>
                      ) : row.lastLoad ? (
                        <>
                          <b>{row.lastLoad.cycleNumber}</b>
                          <small>{row.lastLoad.completedAt || row.lastLoad.createdAt}</small>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="row-actions">
                      <div className="row-actions-inner">
                        {canSimulate && row.load && !row.load.simulation && (
                          <button className="row-details" onClick={() => setOpenKey(row.key)}>
                            <FlaskConical size={15} /> {L('Προσομοίωση', 'Simulation')}
                          </button>
                        )}
                        <button className="row-details" onClick={() => setOpenKey(row.key)}>
                          <ListTree size={15} /> {L('Λεπτομέρειες', 'Details')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {testFor && (
        <TestDialog
          L={L}
          sterilizer={testFor.row.name}
          test={L(
            TEST_KINDS.find(item => item.id === testFor.kind)?.el || '',
            TEST_KINDS.find(item => item.id === testFor.kind)?.en || '',
          )}
          onClose={() => setTestFor(undefined)}
          onSave={value => {
            recordTest(testFor.row, testFor.kind, value);
            setTestFor(undefined);
          }}
        />
      )}
      {outFor && (
        <OutOfServiceDialog
          L={L}
          name={outFor.name}
          onClose={() => setOutFor(undefined)}
          onSave={value => {
            setOutOfService(outFor, value);
            setOutFor(undefined);
          }}
        />
      )}
      {opened && (
        <EquipmentDetails
          L={L}
          row={opened}
          readings={opened.device ? readings.filter(r => r.deviceId === opened.device?.id) : []}
          usedNumbers={usedNumbers}
          devicesEnabled={devicesEnabled}
          isAdmin={isAdmin}
          canRecord={canRecord}
          canConfigure={canConfigure}
          onOutOfService={() => setOutFor(opened)}
          onBackInService={() => setOutOfService(opened)}
          onRecordTest={kind => setTestFor({row: opened, kind})}
          testDevices={devices.filter(d => d.kind === 'TEST' && d.testsEquipment === opened.name)}
          onConnectTestDevice={() =>
            setEditor({value: {...emptyDevice, kind: 'TEST', connection: 'API', testsEquipment: opened.name}})
          }
          onConnect={() => setEditor({value: {...emptyDevice, name: opened.name, kind: opened.kind}})}
          onEdit={() => opened.device && setEditor({id: opened.device.id, value: {...opened.device}})}
          onRemove={() => setRemoving(opened.device)}
          onKey={() => opened.device && setKeyFor({device: opened.device})}
          onFile={() => setFileFor(opened.device)}
          onSerial={() => setSerialFor(opened.device)}
        />
      )}
      {editor && (
        <DeviceEditor
          L={L}
          value={editor.value}
          isNew={!editor.id}
          onChange={value => setEditor(current => current && {...current, value})}
          onSave={() => void save()}
          onClose={() => setEditor(undefined)}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={L('Διαγραφή συσκευής', 'Delete device')}
          message={L(
            `Θα διαγραφεί η «${removing.name}» μαζί με τους κύκλους που έχει στείλει. Θα μείνει στον Κάδο για 30 ημέρες (το κλειδί δικτύου δεν επανέρχεται). Οι καταγραφές της Αποστείρωσης μένουν. Συνέχεια;`,
            `“${removing.name}” will be deleted with the cycles it sent. It stays in the bin for 30 days (its network key does not come back). Sterilization records stay. Continue?`,
          )}
          confirmLabel={L('Διαγραφή', 'Delete')}
          danger
          onConfirm={() => void remove(removing)}
          onClose={() => setRemoving(undefined)}
        />
      )}
      {keyFor && (
        <KeyDialog
          L={L}
          device={keyFor.device}
          deviceKey={keyFor.key}
          busy={keyFor.busy}
          onIssue={() => void makeKey(keyFor.device)}
          onClose={() => setKeyFor(undefined)}
        />
      )}
      {fileFor && (
        <FileDialog
          L={L}
          device={fileFor}
          onStore={drafts => stored(fileFor, 'FILE', drafts)}
          onClose={() => setFileFor(undefined)}
        />
      )}
      {serialFor && (
        <SerialDialog
          L={L}
          device={serialFor}
          onStore={drafts => stored(serialFor, 'SERIAL', drafts)}
          onClose={() => setSerialFor(undefined)}
        />
      )}
    </div>
  );
}
