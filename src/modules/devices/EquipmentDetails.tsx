import {Cable, KeyRound, Pencil, Plus, Trash2, TriangleAlert, Upload, Wrench, X} from 'lucide-react';
import {Link} from 'react-router-dom';
import AppButton from '../../components/ui/AppButton';
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
import type {OutOfService} from '../../core/libraries';
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
  onClose,
  onOutOfService,
  onBackInService,
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
  onClose: () => void;
  onOutOfService: () => void;
  onBackInService: () => void;
  onConnect: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onKey: () => void;
  onFile: () => void;
  onSerial: () => void;
}) {
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
  return (
    <div className="modal-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <div className="load-details equipment-details" role="dialog" aria-modal="true" aria-label={row.name}>
        <header>
          <div>
            <h3>
              {row.name}
              {device && isSimulatedDevice(device) && (
                <span className="device-sim-badge">{L('Προσομοίωση', 'Simulation')}</span>
              )}
            </h3>
            <p>
              {L(deviceKindLabel[row.kind].el, deviceKindLabel[row.kind].en)}
              {device
                ? ` · ${[
                    device.manufacturer,
                    device.model,
                    device.serialNumber && `S/N ${device.serialNumber}`,
                    device.location,
                  ]
                    .filter(Boolean)
                    .join(' · ')}`
                : ''}
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={L('Κλείσιμο', 'Close')}>
            <X size={18} />
          </button>
        </header>
        <div className="load-details-body">
          {row.outOfService && (
            <div className="equipment-out" role="status">
              <Wrench size={16} aria-hidden="true" />
              <div>
                <b>
                  {row.outOfService.reason === 'BREAKDOWN'
                    ? L('Εκτός λειτουργίας · βλάβη', 'Out of service · breakdown')
                    : L('Εκτός λειτουργίας · συντήρηση', 'Out of service · maintenance')}
                </b>
                <small>
                  {L('Από', 'Since')} {row.outOfService.since} · {row.outOfService.by}
                  {row.outOfService.note ? ` · ${row.outOfService.note}` : ''}
                </small>
              </div>
            </div>
          )}
          {row.libraryId && canConfigure && (
            <div className="equipment-actions">
              {row.outOfService ? (
                <AppButton size="sm" variant="primary" onClick={onBackInService}>
                  {L('Επαναφορά σε λειτουργία', 'Put back in service')}
                </AppButton>
              ) : (
                <AppButton size="sm" onClick={onOutOfService} disabled={!!row.load}>
                  <Wrench size={14} />
                  {L('Εκτός λειτουργίας', 'Out of service')}
                </AppButton>
              )}
              {!row.outOfService && row.load && (
                <small className="muted">
                  {L('Τρέχει κύκλος: περιμένετε να τελειώσει.', 'A cycle is running: wait for it to end.')}
                </small>
              )}
            </div>
          )}
          {devicesEnabled && (
            <div className="equipment-actions">
              {device ? (
                <>
                  {canRecord && device.active && (
                    <AppButton size="sm" onClick={onFile}>
                      <Upload size={14} />
                      {L('Αρχείο', 'File')}
                    </AppButton>
                  )}
                  {canRecord && device.active && device.connection === 'SERIAL' && (
                    <AppButton size="sm" onClick={onSerial}>
                      <Cable size={14} />
                      {L('Καλώδιο', 'Cable')}
                    </AppButton>
                  )}
                  {isAdmin && device.connection === 'API' && (
                    <AppButton size="sm" onClick={onKey}>
                      <KeyRound size={14} />
                      {L('Κλειδί δικτύου', 'Network key')}
                    </AppButton>
                  )}
                  {isAdmin && (
                    <>
                      <AppButton size="sm" onClick={onEdit}>
                        <Pencil size={14} />
                        {L('Επεξεργασία', 'Edit')}
                      </AppButton>
                      <AppButton size="sm" variant="danger" onClick={onRemove}>
                        <Trash2 size={14} />
                        {L('Διαγραφή', 'Delete')}
                      </AppButton>
                    </>
                  )}
                </>
              ) : (
                isAdmin && (
                  <AppButton size="sm" variant="primary" onClick={onConnect}>
                    <Plus size={14} />
                    {L('Σύνδεση συσκευής', 'Connect a device')}
                  </AppButton>
                )
              )}
            </div>
          )}
          {shownLoad ? (
            <>
              <h4>
                {row.load ? L('Φορτίο στον κλίβανο', 'Load in the sterilizer') : L('Τελευταίο φορτίο', 'Last load')}
              </h4>
              <LoadContents load={shownLoad} />
              <p>
                <Link to="/sterilization?queue=IN_STERILIZER">
                  {L('Άνοιγμα στην Αποστείρωση', 'Open in Sterilization')}
                </Link>
              </p>
            </>
          ) : (
            <p className="muted">{L('Δεν έχει τρέξει φορτίο ακόμα.', 'No load has run yet.')}</p>
          )}
          {row.trouble && row.trouble.items.length > 0 && (
            <>
              <h4>
                {L('Αποτυχίες και μη αποδεσμεύσεις', 'Failures and loads not released')}
                {row.trouble.attention && (
                  <span className="equipment-attention">
                    <TriangleAlert size={13} aria-hidden="true" />
                    {L(
                      `${row.trouble.recent} τις τελευταίες 30 ημέρες: ελέγξτε τον κλίβανο`,
                      `${row.trouble.recent} in the last 30 days: have the sterilizer checked`,
                    )}
                  </span>
                )}
              </h4>
              <ul className="equipment-trouble">
                {row.trouble.items.slice(0, 10).map(item => (
                  <li key={item.loadId}>
                    <b>{item.cycleNumber}</b>
                    <span>{item.program}</span>
                    <span className={`device-result ${item.kind === 'CYCLE_FAILED' ? 'fail' : 'unknown'}`}>
                      {item.kind === 'CYCLE_FAILED'
                        ? L('Αποτυχία κύκλου', 'Cycle failed')
                        : L('Δεν αποδεσμεύτηκε', 'Not released')}
                    </span>
                    <small>
                      {item.at}
                      {item.note ? ` · ${item.note}` : ''}
                    </small>
                  </li>
                ))}
              </ul>
            </>
          )}
          {device && (
            <>
              <div className="equipment-cycles-head">
                <h4>{L('Κύκλοι που έστειλε η συσκευή', 'Cycles the device sent')}</h4>
                <DownloadMenu table={table} disabled={!readings.length} />
              </div>
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
                        <th>{L('Έναρξη', 'Start')}</th>
                        <th>{L('Κύκλος', 'Cycle')}</th>
                        <th>{L('Πρόγραμμα', 'Program')}</th>
                        <th>{L('Αποτέλεσμα', 'Result')}</th>
                        <th>{L('Θερμ. (°C)', 'Temp. (°C)')}</th>
                        <th>{L('Πίεση (bar)', 'Pressure (bar)')}</th>
                        <th>{L('Διάρκεια (λεπτά)', 'Duration (min)')}</th>
                        <th>{L('Πηγή', 'Source')}</th>
                        <th>{L('Φόρτωση', 'Load')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readings.map(r => (
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
            </>
          )}
        </div>
        <footer>
          <AppButton variant="primary" onClick={onClose}>
            {L('Κλείσιμο', 'Close')}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
