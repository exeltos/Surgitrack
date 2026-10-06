import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Cable,
  CheckCircle2,
  FileSpreadsheet,
  KeyRound,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
  Upload,
  Wifi,
  X,
  XCircle,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import AppButton from '../../components/ui/AppButton';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {useSurgi} from '../../store/SurgiStore';
import {useAppPreferences} from '../../core/AppPreferences';
import {downloadXlsx} from '../../core/exportTable';
import {
  connectionLabel,
  deviceKindLabel,
  type Device,
  type DeviceReading,
  type ReadingDraft,
} from '../../core/deviceData';
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
import {DeviceEditor, FileDialog, KeyDialog, SerialDialog} from './DeviceDialogs';
import {binEntryForDevice} from '../../core/recycleBin';
import {messageOf} from './deviceUi';

const emptyDevice: DeviceInput = {name: '', kind: 'STERILIZER', connection: 'FILE', active: true};

/**
 * Connected devices: sterilizers, washers and other equipment whose cycle data comes into
 * SurgiTrack over the network, from a file the device exports, or through a serial cable. The data
 * is kept per device and fills in the cycle when Sterilization records it.
 */
export default function DevicesPage() {
  const {organizationId, role, can, sterilizationCycles, processLoads, addToBin, currentUser} = useSurgi();
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const locale = lang === 'el' ? 'el-GR' : 'en-GB';
  const isAdmin = role === 'ADMIN';
  const canRecord = can('sterilization.workspace');
  const [devices, setDevices] = useState<Device[]>([]);
  const [readings, setReadings] = useState<DeviceReading[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<{id?: string; value: DeviceInput}>();
  const [removing, setRemoving] = useState<Device>();
  const [keyFor, setKeyFor] = useState<{device: Device; key?: string; busy?: boolean}>();
  const [fileFor, setFileFor] = useState<Device>();
  const [serialFor, setSerialFor] = useState<Device>();

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError('');
    try {
      const [list, latest] = await Promise.all([
        listDevices(organizationId),
        listReadings(organizationId, {limit: 500}),
      ]);
      setDevices(list);
      setReadings(latest);
      setSelectedId(current => (list.some(d => d.id === current) ? current : list[0]?.id || ''));
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, [organizationId]);
  useEffect(() => {
    void load();
  }, [load]);

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
  const selected = devices.find(d => d.id === selectedId);
  const selectedReadings = readings.filter(r => r.deviceId === selectedId);
  const lastReading = (id: string) => readings.find(r => r.deviceId === id);
  const when = (iso?: string) =>
    iso ? new Date(iso).toLocaleString(locale, {dateStyle: 'short', timeStyle: 'short'}) : '—';

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
    setSelectedId(device.id);
    await load();
  };
  const exportReadings = () => {
    if (!selected) return;
    downloadXlsx({
      title: L(`Κύκλοι ${selected.name}`, `${selected.name} cycles`),
      subtitle: `${L(deviceKindLabel[selected.kind].el, deviceKindLabel[selected.kind].en)} · ${selectedReadings.length}`,
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
      rows: selectedReadings.map(r => [
        when(r.startedAt),
        when(r.endedAt),
        r.cycleNumber,
        r.program || '',
        resultLabel(r.result),
        r.maxTemperature ?? '',
        r.maxPressure ?? '',
        r.durationMinutes ?? '',
        L(connectionLabel[r.source].el, connectionLabel[r.source].en),
      ]),
    });
  };
  const resultLabel = (result: DeviceReading['result']) =>
    result === 'PASS' ? L('Επιτυχία', 'Pass') : result === 'FAIL' ? L('Αποτυχία', 'Fail') : L('Άγνωστο', 'Unknown');

  if (!organizationId)
    return (
      <div className="devices-page">
        <PageHeader eyebrow={L('ΕΞΟΠΛΙΣΜΟΣ', 'EQUIPMENT')} title={L('Συνδεδεμένες συσκευές', 'Connected devices')} />
        <div className="devices-empty">
          {L(
            'Οι συνδεδεμένες συσκευές λειτουργούν μέσα σε νοσοκομείο. Επιλέξτε νοσοκομείο από την πάνω μπάρα.',
            'Connected devices work inside a hospital. Choose a hospital in the top bar.',
          )}
        </div>
      </div>
    );

  return (
    <div className="devices-page">
      <PageHeader
        eyebrow={L('ΕΞΟΠΛΙΣΜΟΣ', 'EQUIPMENT')}
        title={L('Συνδεδεμένες συσκευές', 'Connected devices')}
        description={L(
          'Κλίβανοι, πλυντήρια και άλλες συσκευές που στέλνουν δεδομένα κύκλων στην Αποστείρωση.',
          'Sterilizers, washers and other devices that send cycle data to Sterilization.',
        )}
        actions={
          <div className="devices-head-actions">
            <AppButton onClick={() => void load()} disabled={loading}>
              <RefreshCcw size={15} />
              {L('Ανανέωση', 'Refresh')}
            </AppButton>
            {isAdmin && (
              <AppButton variant="primary" onClick={() => setEditor({value: {...emptyDevice}})}>
                <Plus size={16} />
                {L('Νέα συσκευή', 'New device')}
              </AppButton>
            )}
          </div>
        }
      />
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

      {!loading && devices.length === 0 ? (
        <div className="devices-empty">
          <Cable size={26} />
          <b>{L('Δεν υπάρχουν συσκευές ακόμη.', 'No devices yet.')}</b>
          <span>
            {isAdmin
              ? L(
                  'Πατήστε «Νέα συσκευή» και διαλέξτε πώς συνδέεται: δίκτυο, αρχείο ή καλώδιο.',
                  'Press “New device” and choose how it connects: network, file or cable.',
                )
              : L('Ο διαχειριστής του νοσοκομείου προσθέτει τις συσκευές.', 'The hospital admin adds the devices.')}
          </span>
        </div>
      ) : (
        <div className="devices-grid">
          {devices.map(device => {
            const last = lastReading(device.id);
            const ConnectionIcon = device.connection === 'API' ? Wifi : device.connection === 'SERIAL' ? Cable : Upload;
            return (
              <article
                key={device.id}
                className={`device-card${device.id === selectedId ? ' selected' : ''}${device.active ? '' : ' inactive'}`}
              >
                <button className="device-card-main" onClick={() => setSelectedId(device.id)}>
                  <span className="device-card-kind">
                    {L(deviceKindLabel[device.kind].el, deviceKindLabel[device.kind].en)}
                  </span>
                  <b>{device.name}</b>
                  <small>
                    {[device.manufacturer, device.model, device.serialNumber && `S/N ${device.serialNumber}`]
                      .filter(Boolean)
                      .join(' · ') || L('Χωρίς στοιχεία κατασκευαστή', 'No manufacturer details')}
                  </small>
                  <span className="device-card-connection">
                    <ConnectionIcon size={14} />
                    {L(connectionLabel[device.connection].el, connectionLabel[device.connection].en)}
                    {device.connection === 'API' && device.keyHint ? ` · …${device.keyHint}` : ''}
                  </span>
                  <span className={`device-card-last ${last ? (last.result === 'FAIL' ? 'bad' : 'good') : ''}`}>
                    {last
                      ? L(
                          `Τελευταίος κύκλος ${last.cycleNumber} · ${when(last.startedAt || last.createdAt)}`,
                          `Last cycle ${last.cycleNumber} · ${when(last.startedAt || last.createdAt)}`,
                        )
                      : L('Δεν έχουν έρθει δεδομένα ακόμη', 'No data received yet')}
                  </span>
                  {!device.active && <span className="device-card-off">{L('Ανενεργή', 'Inactive')}</span>}
                </button>
                <div className="device-card-actions">
                  {canRecord && device.active && (
                    <AppButton size="sm" onClick={() => setFileFor(device)}>
                      <Upload size={14} />
                      {L('Αρχείο', 'File')}
                    </AppButton>
                  )}
                  {canRecord && device.active && device.connection === 'SERIAL' && (
                    <AppButton size="sm" onClick={() => setSerialFor(device)}>
                      <Cable size={14} />
                      {L('Καλώδιο', 'Cable')}
                    </AppButton>
                  )}
                  {isAdmin && device.connection === 'API' && (
                    <AppButton size="sm" onClick={() => setKeyFor({device})}>
                      <KeyRound size={14} />
                      {L('Κλειδί δικτύου', 'Network key')}
                    </AppButton>
                  )}
                  {isAdmin && (
                    <span className="device-card-tools">
                      <button
                        className="icon-button"
                        title={L('Επεξεργασία', 'Edit')}
                        aria-label={L('Επεξεργασία', 'Edit')}
                        onClick={() => setEditor({id: device.id, value: {...device}})}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-button"
                        title={L('Διαγραφή', 'Delete')}
                        aria-label={L('Διαγραφή', 'Delete')}
                        onClick={() => setRemoving(device)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selected && (
        <section className="devices-readings panel">
          <header>
            <div>
              <h2>{L(`Κύκλοι · ${selected.name}`, `Cycles · ${selected.name}`)}</h2>
              <small>
                {L(
                  '«Καταχωρήθηκε» σημαίνει ότι ο κύκλος έχει ήδη χρησιμοποιηθεί σε καταγραφή της Αποστείρωσης.',
                  '“Recorded” means the cycle is already used in a Sterilization record.',
                )}
              </small>
            </div>
            <AppButton onClick={exportReadings} disabled={!selectedReadings.length}>
              <FileSpreadsheet size={15} />
              {L('Εξαγωγή Excel', 'Export Excel')}
            </AppButton>
          </header>
          {selectedReadings.length === 0 ? (
            <div className="devices-empty small">
              {L('Δεν υπάρχουν κύκλοι για αυτή τη συσκευή.', 'No cycles for this device.')}
            </div>
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
                    <th>°C</th>
                    <th>bar</th>
                    <th>{L('Λεπτά', 'Min')}</th>
                    <th>{L('Πηγή', 'Source')}</th>
                    <th>{L('Χρήση', 'Use')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReadings.map(r => (
                    <tr key={r.id}>
                      <td>{when(r.startedAt || r.createdAt)}</td>
                      <td className="mono">{r.cycleNumber}</td>
                      <td>{r.program || '—'}</td>
                      <td>
                        <span className={`device-result ${r.result.toLowerCase()}`}>{resultLabel(r.result)}</span>
                      </td>
                      <td>{r.maxTemperature ?? '—'}</td>
                      <td>{r.maxPressure ?? '—'}</td>
                      <td>{r.durationMinutes ?? '—'}</td>
                      <td>{L(connectionLabel[r.source].el, connectionLabel[r.source].en)}</td>
                      <td>
                        {usedNumbers.has(r.cycleNumber.trim().toUpperCase())
                          ? L('Καταχωρήθηκε', 'Recorded')
                          : L('Ελεύθερος', 'Unused')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
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
