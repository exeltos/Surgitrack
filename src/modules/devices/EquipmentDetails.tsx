import {SortTh} from '../../components/ui/SortHeader';
import {useTableSort} from '../../components/ui/useTableSort';
import {useHasModule} from '../../data/cloud/modulesContext';
import {
  ArrowLeft,
  Cable,
  FlaskConical,
  KeyRound,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  Upload,
  Wrench,
} from 'lucide-react';
import {Link} from 'react-router-dom';
import AppButton from '../../components/ui/AppButton';
import BackLink from '../../components/ui/BackLink';
import DownloadMenu from '../../components/ui/DownloadMenu';
import {
  connectionLabel,
  deviceKindLabel,
  type Device,
  type DeviceReading,
  type DeviceKind,
} from '../../core/deviceData';
import type {ExportTable} from '../../core/exportTable';
import {formatDateTime} from '../../core/displayDate';
import type {EquipmentTest, OutOfService} from '../../core/libraries';
import {TEST_KINDS, testStandings} from '../../core/equipmentTests';
import type {EquipmentTrouble} from '../../core/equipmentHealth';
import type {ProcessLoadRecord} from '../../types/domain';
import LoadContents from '../sterilization/parts/LoadContents';
import {isSimulatedDevice} from '../../data/cloud/simulatedDevice';
import type {Lang} from './deviceUi';

/** One piece of equipment as the unified screen lists it: a sterilizer or washer of the hospital, with its device. */
export type EquipmentRow = {
  key: string;
  name: string;
  kind: DeviceKind;
  device?: Device;
  /** The load running in it now (sterilizers) and the last one that ran. */
  load?: ProcessLoadRecord;
  lastLoad?: ProcessLoadRecord;
  /** The hospital's list (Studio › Libraries) this row comes from, and whether it is out of service. */
  libraryKey?: 'sterilizers' | 'washers';
  libraryId?: string;
  outOfService?: OutOfService;
  /** A sterilizer's tests (newest first). */
  tests?: EquipmentTest[];
  /** The failures of a sterilizer (newest first), the ones in the last 30 days, and whether they call for attention. */
  trouble?: {items: EquipmentTrouble[]; recent: number; attention: boolean};
};

const resultLabel = (L: Lang, result: DeviceReading['result']) =>
  result === 'PASS' ? L('Επιτυχία', 'Pass') : result === 'FAIL' ? L('Αποτυχία', 'Fail') : L('Άγνωστο', 'Unknown');

/**
 * The card of a piece of equipment, opened from «Λεπτομέρειες» of its row: the load in it with the Sets and
 * instruments inside, how it is connected and what the admin may do with it, and the cycles it sent.
 */
export default function EquipmentDetails({
  L,
  row,
  readings,
  usedNumbers,
  devicesEnabled,
  isAdmin,
  canRecord,
  canConfigure,
  onOutOfService,
  onBackInService,
  onRecordTest,
  testDevices,
  onConnectTestDevice,
  onConnect,
  onEdit,
  onRemove,
  onKey,
  onFile,
  onSerial,
}: {
  L: Lang;
  row: EquipmentRow;
  readings: DeviceReading[];
  usedNumbers: Set<string>;
  devicesEnabled: boolean;
  isAdmin: boolean;
  canRecord: boolean;
  /** The supervisor's: take it out of service, put it back. */
  canConfigure: boolean;
  onOutOfService: () => void;
  onBackInService: () => void;
  /** Records a test of the sterilizer (the page asks for the result). */
  onRecordTest: (kind: EquipmentTest['kind']) => void;
  /** The test devices (Bowie-Dick tester, spore reader…) connected to this sterilizer. */
  testDevices: Device[];
  onConnectTestDevice: () => void;
  onConnect: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onKey: () => void;
  onFile: () => void;
  onSerial: () => void;
}) {
  const withTests = useHasModule('EQUIPMENT_TESTS');
  const cycles = useTableSort(readings, {
    start: r => Date.parse(r.startedAt || r.createdAt),
    cycle: r => r.cycleNumber,
    program: r => r.program,
    result: r => resultLabel(L, r.result),
    temperature: r => r.maxTemperature,
    pressure: r => r.maxPressure,
    duration: r => r.durationMinutes,
    source: r => L(connectionLabel[r.source].el, connectionLabel[r.source].en),
    load: r => usedNumbers.has(r.cycleNumber.trim().toUpperCase()),
  });
  const {device} = row;
  const when = (iso?: string) => (iso ? formatDateTime(iso) : '—');
  const table = (): ExportTable => ({
    title: L(`Κύκλοι ${row.name}`, `${row.name} cycles`),
    subtitle: `${L(deviceKindLabel[row.kind].el, deviceKindLabel[row.kind].en)} · ${readings.length}`,
    headers: [
      L('Έναρξη', 'Start'),
      L('Λήξη', 'End'),
      L('Κύκλος', 'Cycle'),
      L('Πρόγραμμα', 'Program'),
      L('Αποτέλεσμα', 'Result'),
      L('Μέγ. θερμοκρασία (°C)', 'Max temperature (°C)'),
      L('Μέγ. πίεση (bar)', 'Max pressure (bar)'),
      L('Διάρκεια (λεπτά)', 'Duration (min)'),
      L('Πηγή', 'Source'),
    ],
    rows: readings.map(r => [
      when(r.startedAt),
      when(r.endedAt),
      r.cycleNumber,
      r.program || '',
      resultLabel(L, r.result),
      r.maxTemperature ?? '',
      r.maxPressure ?? '',
      r.durationMinutes ?? '',
      L(connectionLabel[r.source].el, connectionLabel[r.source].en),
    ]),
  });
  const shownLoad = row.load ?? row.lastLoad;
  const stateOf = row.load
    ? L('Σε λειτουργία', 'Running')
    : row.outOfService
      ? row.outOfService.reason === 'BREAKDOWN'
        ? L('Εκτός λειτουργίας · βλάβη', 'Out of service · breakdown')
        : L('Εκτός λειτουργίας · συντήρηση', 'Out of service · maintenance')
      : device && !device.active
        ? L('Ανενεργή', 'Inactive')
        : L('Ελεύθερος', 'Free');
  const facts: Array<[string, string | undefined]> = [
    [L('Είδος', 'Kind'), L(deviceKindLabel[row.kind].el, deviceKindLabel[row.kind].en)],
    [L('Κατάσταση', 'State'), stateOf],
    [L('Κατασκευαστής', 'Manufacturer'), device?.manufacturer],
    [L('Μοντέλο', 'Model'), device?.model],
    [L('Σειριακός αριθμός', 'Serial number'), device?.serialNumber],
    [L('Θέση', 'Location'), device && device.location !== row.name ? device.location : undefined],
    [
      L('Σύνδεση', 'Connection'),
      device ? L(connectionLabel[device.connection].el, connectionLabel[device.connection].en) : undefined,
    ],
  ];
  return (
    <section className="asset-detail-workspace equipment-detail-workspace" aria-label={row.name}>
      <div className="asset-workbench-actions">
        <div className="asset-action-group">
          <BackLink fallback="/sterilizers" className="asset-action-link">
            <ArrowLeft size={18} /> {L('Πίσω στη λίστα', 'Back to the list')}
          </BackLink>
        </div>
        <div className="asset-action-group">
          {row.libraryId && canConfigure && (
            <AppButton
              icon={<Wrench size={16} />}
              onClick={row.outOfService ? onBackInService : onOutOfService}
              disabled={!row.outOfService && !!row.load}
              title={
                !row.outOfService && row.load
                  ? L('Τρέχει κύκλος: περιμένετε να τελειώσει.', 'A cycle is running: wait for it to end.')
                  : undefined
              }
            >
              {row.outOfService
                ? L('Επαναφορά σε λειτουργία', 'Put back in service')
                : L('Εκτός λειτουργίας', 'Out of service')}
            </AppButton>
          )}
          {devicesEnabled && device && canRecord && device.active && (
            <AppButton icon={<Upload size={16} />} onClick={onFile}>
              {L('Αρχείο', 'File')}
            </AppButton>
          )}
          {devicesEnabled && device && canRecord && device.active && device.connection === 'SERIAL' && (
            <AppButton icon={<Cable size={16} />} onClick={onSerial}>
              {L('Καλώδιο', 'Cable')}
            </AppButton>
          )}
          {devicesEnabled && device && isAdmin && device.connection === 'API' && (
            <AppButton icon={<KeyRound size={16} />} onClick={onKey}>
              {L('Κλειδί δικτύου', 'Network key')}
            </AppButton>
          )}
          {devicesEnabled && device && isAdmin && (
            <>
              <AppButton icon={<Pencil size={16} />} onClick={onEdit}>
                {L('Επεξεργασία', 'Edit')}
              </AppButton>
              <AppButton variant="danger" icon={<Trash2 size={16} />} onClick={onRemove}>
                {L('Διαγραφή', 'Delete')}
              </AppButton>
            </>
          )}
          {devicesEnabled && !device && isAdmin && (
            <AppButton variant="primary" icon={<Plus size={16} />} onClick={onConnect}>
              {L('Σύνδεση συσκευής', 'Connect a device')}
            </AppButton>
          )}
        </div>
      </div>

      <div className="equipment-detail-page">
        <section className="asset-section equipment-facts-card">
          <div className="asset-section-head">
            <div>
              <h2>
                {row.name}
                {device && isSimulatedDevice(device) && (
                  <span className="device-sim-badge">{L('Προσομοίωση', 'Simulation')}</span>
                )}
              </h2>
              {/* What it is and its state on one line (the device's maker, serial number and connection with it). */}
              <p className="equipment-facts-line">
                {facts
                  .filter(([, value]) => value)
                  .map(([label, value]) => (label === L('Σειριακός αριθμός', 'Serial number') ? `S/N ${value}` : value))
                  .join(' · ')}
              </p>
            </div>
          </div>
          {/* Its body only says it is out of service (the facts are on the line under the name). */}
          {row.outOfService && (
            <div className="asset-section-body">
              <div className="equipment-out" role="status">
                <Wrench size={16} aria-hidden="true" />
                <div>
                  <b>{stateOf}</b>
                  <small>
                    {L('Από', 'Since')} {row.outOfService.since} · {row.outOfService.by}
                    {row.outOfService.note ? ` · ${row.outOfService.note}` : ''}
                  </small>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className={`asset-section equipment-top${row.trouble?.items.length ? '' : ' equipment-wide'}`}>
          <div className="asset-section-head">
            <div>
              <h2>
                {row.load ? L('Φορτίο στον κλίβανο', 'Load in the sterilizer') : L('Τελευταίο φορτίο', 'Last load')}
              </h2>
            </div>
          </div>
          <div className="asset-section-body">
            {shownLoad ? (
              <>
                <LoadContents load={shownLoad} />
                <p>
                  <Link
                    className="equipment-open-link"
                    to={row.kind === 'WASHER' ? '/sterilization?queue=WASHING' : '/sterilization?queue=IN_STERILIZER'}
                  >
                    {L('Άνοιγμα στην Αποστείρωση', 'Open in Sterilization')}
                  </Link>
                </p>
              </>
            ) : (
              <p className="muted">{L('Δεν έχει τρέξει φορτίο ακόμα.', 'No load has run yet.')}</p>
            )}
          </div>
        </section>

        {withTests && (row.kind === 'STERILIZER' || row.kind === 'WASHER') && row.libraryId && (
          <section className="asset-section equipment-wide">
            <div className="asset-section-head">
              <div>
                <h2>
                  {row.kind === 'WASHER'
                    ? L('Δοκιμές πλυντηρίου', 'Washer tests')
                    : L('Δοκιμές κλιβάνου', 'Sterilizer tests')}
                </h2>
              </div>
            </div>
            <div className="asset-section-body">
              {/* When each test is due, and how the results can come by themselves, on one line. */}
              <div className="equipment-test-devices">
                <FlaskConical size={15} aria-hidden="true" />
                <span>
                  {row.kind === 'WASHER'
                    ? L(
                        'Έλεγχος καθαρισμού κάθε μέρα πριν το πρώτο φορτίο, οι άλλες κάθε εβδομάδα.',
                        'Cleaning test every day before the first load, the others every week.',
                      )
                    : L(
                        'Bowie-Dick κάθε μέρα πριν το πρώτο φορτίο, οι άλλες κάθε εβδομάδα.',
                        'Bowie-Dick every day before the first load, the others every week.',
                      )}{' '}
                  {testDevices.length ? (
                    <>
                      {L('Συσκευή δοκιμών', 'Test device')}: <b>{testDevices.map(device => device.name).join(', ')}</b>{' '}
                      ({L('τα αποτελέσματα μπαίνουν αυτόματα', 'results are recorded automatically')}).
                    </>
                  ) : (
                    <span className="muted">
                      {L(
                        'Με συσκευή δοκιμών τα αποτελέσματα έρχονται μόνα τους.',
                        'With a test device the results come by themselves.',
                      )}
                    </span>
                  )}
                </span>
                {devicesEnabled && isAdmin && (
                  <AppButton size="sm" icon={<Plus size={14} />} onClick={onConnectTestDevice}>
                    {L('Σύνδεση συσκευής δοκιμών', 'Connect a test device')}
                  </AppButton>
                )}
              </div>
              <table className="equipment-tests">
                <thead>
                  <tr>
                    <th>{L('Δοκιμή', 'Test')}</th>
                    <th>{L('Τελευταία', 'Last')}</th>
                    <th>{L('Αποτέλεσμα', 'Result')}</th>
                    <th>{L('Από', 'By')}</th>
                    <th>{L('Επόμενη', 'Next')}</th>
                    <th>
                      <span className="sr-only">{L('Ενέργειες', 'Actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {testStandings(row.tests, Date.now(), row.kind === 'WASHER' ? 'WASHER' : 'STERILIZER').map(
                    standing => {
                      const kind = TEST_KINDS.find(item => item.id === standing.kind)!;
                      return (
                        <tr key={standing.kind}>
                          <td>
                            <b>{L(kind.el, kind.en)}</b>
                            <small>{L(kind.hint.el, kind.hint.en)}</small>
                          </td>
                          <td>{standing.last?.at || '—'}</td>
                          <td>
                            {standing.last ? (
                              <span className={`device-result ${standing.last.result === 'PASS' ? 'pass' : 'fail'}`}>
                                {standing.last.result === 'PASS' ? L('Επιτυχία', 'Pass') : L('Αποτυχία', 'Fail')}
                              </span>
                            ) : (
                              '—'
                            )}
                            {standing.last?.note && <small>{standing.last.note}</small>}
                          </td>
                          <td>
                            {standing.last?.id.startsWith('dev-')
                              ? L('Συσκευή: ', 'Device: ') + standing.last.by
                              : standing.last?.by || '—'}
                          </td>
                          <td>
                            {standing.failed ? (
                              <b className="equipment-test-bad">{L('Επανάληψη', 'Repeat')}</b>
                            ) : standing.due ? (
                              <b className="equipment-test-due">{L('Εκκρεμεί', 'Due')}</b>
                            ) : (
                              <span className="muted">{L('Εντάξει', 'Up to date')}</span>
                            )}
                          </td>
                          <td className="row-actions">
                            {canRecord && (
                              <AppButton size="sm" onClick={() => onRecordTest(standing.kind)}>
                                {L('Καταγραφή', 'Record')}
                              </AppButton>
                            )}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {row.trouble && row.trouble.items.length > 0 && (
          <section className="asset-section equipment-top">
            <div className="asset-section-head">
              <div>
                <h2>
                  {row.kind === 'WASHER'
                    ? L('Αποτυχημένες πλύσεις', 'Failed washes')
                    : L('Αποτυχίες και μη αποδεσμεύσεις', 'Failures and loads not released')}
                  {row.trouble.attention && (
                    <span className="equipment-attention">
                      <TriangleAlert size={13} aria-hidden="true" />
                      {L(
                        row.kind === 'WASHER'
                          ? `${row.trouble.recent} τις τελευταίες 30 ημέρες: ελέγξτε το πλυντήριο`
                          : `${row.trouble.recent} τις τελευταίες 30 ημέρες: ελέγξτε τον κλίβανο`,
                        row.kind === 'WASHER'
                          ? `${row.trouble.recent} in the last 30 days: have the washer checked`
                          : `${row.trouble.recent} in the last 30 days: have the sterilizer checked`,
                      )}
                    </span>
                  )}
                </h2>
              </div>
            </div>
            <div className="asset-section-body">
              <ul className="equipment-trouble">
                {row.trouble.items.slice(0, 10).map(item => (
                  <li key={item.loadId}>
                    <b>{item.cycleNumber}</b>
                    <span>{item.program}</span>
                    <span className={`device-result ${item.kind === 'CYCLE_FAILED' ? 'fail' : 'unknown'}`}>
                      {item.kind === 'CYCLE_FAILED'
                        ? row.kind === 'WASHER'
                          ? L('Αποτυχία πλύσης', 'Wash failed')
                          : L('Αποτυχία κύκλου', 'Cycle failed')
                        : L('Δεν αποδεσμεύτηκε', 'Not released')}
                    </span>
                    <small>
                      {item.at}
                      {item.note ? ` · ${item.note}` : ''}
                    </small>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {device && (
          <section className="asset-section equipment-wide equipment-cycles">
            <div className="asset-section-head">
              <div>
                <h2>{L('Κύκλοι που έστειλε η συσκευή', 'Cycles the device sent')}</h2>
              </div>
              <DownloadMenu table={table} disabled={!readings.length} />
            </div>
            <div className="asset-section-body">
              {readings.length === 0 ? (
                <p className="muted">
                  {L('Δεν υπάρχουν κύκλοι για αυτή τη συσκευή.', 'No cycles for this device.')}
                  {canRecord && device.active && device.connection !== 'API'
                    ? ` ${L('Ανεβάστε τους κύκλους με «Αρχείο».', 'Upload the cycles with “File”.')}`
                    : ''}
                </p>
              ) : (
                <div
                  className="devices-table-wrap"
                  role="region"
                  tabIndex={0}
                  aria-label={L('Τελευταίοι κύκλοι', 'Latest cycles')}
                >
                  <table className="devices-table">
                    <thead>
                      <tr>
                        <SortTh
                          label={L('Έναρξη', 'Start')}
                          sortKey="start"
                          sort={cycles.sort}
                          onSort={cycles.toggle}
                        />
                        <SortTh
                          label={L('Κύκλος', 'Cycle')}
                          sortKey="cycle"
                          sort={cycles.sort}
                          onSort={cycles.toggle}
                        />
                        <SortTh
                          label={L('Πρόγραμμα', 'Program')}
                          sortKey="program"
                          sort={cycles.sort}
                          onSort={cycles.toggle}
                        />
                        <SortTh
                          label={L('Αποτέλεσμα', 'Result')}
                          sortKey="result"
                          sort={cycles.sort}
                          onSort={cycles.toggle}
                        />
                        <SortTh
                          label={L('Θερμ. (°C)', 'Temp. (°C)')}
                          sortKey="temperature"
                          sort={cycles.sort}
                          onSort={cycles.toggle}
                        />
                        <SortTh
                          label={L('Πίεση (bar)', 'Pressure (bar)')}
                          sortKey="pressure"
                          sort={cycles.sort}
                          onSort={cycles.toggle}
                        />
                        <SortTh
                          label={L('Διάρκεια (λεπτά)', 'Duration (min)')}
                          sortKey="duration"
                          sort={cycles.sort}
                          onSort={cycles.toggle}
                        />
                        <SortTh
                          label={L('Πηγή', 'Source')}
                          sortKey="source"
                          sort={cycles.sort}
                          onSort={cycles.toggle}
                        />
                        <SortTh label={L('Φόρτωση', 'Load')} sortKey="load" sort={cycles.sort} onSort={cycles.toggle} />
                      </tr>
                    </thead>
                    <tbody>
                      {cycles.rows.map(r => (
                        <tr key={r.id}>
                          <td>{when(r.startedAt || r.createdAt)}</td>
                          <td className="mono">{r.cycleNumber}</td>
                          <td data-label={L('Πρόγραμμα', 'Program')}>{r.program || '—'}</td>
                          <td>
                            <span className={`device-result ${r.result.toLowerCase()}`}>
                              {resultLabel(L, r.result)}
                            </span>
                          </td>
                          <td data-label="°C">{r.maxTemperature ?? '—'}</td>
                          <td data-label="bar">{r.maxPressure ?? '—'}</td>
                          <td data-label={L('Λεπτά', 'Min')}>{r.durationMinutes ?? '—'}</td>
                          <td data-label={L('Πηγή', 'Source')}>
                            {L(connectionLabel[r.source].el, connectionLabel[r.source].en)}
                          </td>
                          <td>
                            {usedNumbers.has(r.cycleNumber.trim().toUpperCase()) ? (
                              <b className="device-cycle-used">{L('Σε φόρτωση', 'In a load')}</b>
                            ) : (
                              <span className="device-cycle-free">{L('Διαθέσιμος', 'Available')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
