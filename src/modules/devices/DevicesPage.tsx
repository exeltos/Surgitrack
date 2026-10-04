import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Cable,
  CheckCircle2,
  Copy,
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
import {readSheetFile} from '../../core/sheetImport';
import {
  connectionLabel,
  deviceKindLabel,
  readingsFromPrintout,
  readingsFromSheet,
  type Device,
  type DeviceConnection,
  type DeviceKind,
  type DeviceReading,
  type ReadingDraft,
} from '../../core/deviceData';
import {
  deleteDevice,
  deviceIngestUrl,
  issueDeviceKey,
  listDevices,
  listReadings,
  saveDevice,
  storeReadings,
  type DeviceInput,
} from '../../data/cloud/devices';
import {openSerialPort, serialSupported, type SerialSession} from './serialPort';

const KINDS: DeviceKind[] = ['STERILIZER', 'WASHER', 'SEALER', 'OTHER'];
const CONNECTIONS: DeviceConnection[] = ['API', 'FILE', 'SERIAL'];
const BAUD_RATES = [9600, 19200, 38400, 57600, 115200];
const emptyDevice: DeviceInput = {name: '', kind: 'STERILIZER', connection: 'FILE', active: true};

const messageOf = (e: unknown) =>
  e instanceof Error ? e.message : String((e as {message?: string} | null)?.message || e);

/**
 * Connected devices: sterilizers, washers and other equipment whose cycle data comes into
 * SurgiTrack over the network, from a file the device exports, or through a serial cable. The data
 * is kept per device and fills in the cycle when Sterilization records it.
 */
export default function DevicesPage() {
  const {organizationId, role, can, sterilizationCycles, processLoads} = useSurgi();
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
          'Κλίβανοι, πλυντήρια και άλλες συσκευές που στέλνουν τα δεδομένα των κύκλων τους στο SurgiTrack. Τα δεδομένα συμπληρώνουν αυτόματα τον κύκλο στην Αποστείρωση και μένουν ως αρχείο.',
          'Sterilizers, washers and other devices that send their cycle data to SurgiTrack. The data fills in the cycle in Sterilization and is kept on record.',
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
            <div className="devices-table-wrap">
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
            `Θα διαγραφεί η «${removing.name}» μαζί με τους κύκλους που έχει στείλει. Οι καταγραφές της Αποστείρωσης μένουν. Συνέχεια;`,
            `“${removing.name}” will be deleted with the cycles it sent. Sterilization records stay. Continue?`,
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

type Lang = (el: string, en: string) => string;

function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <div className="asset-modal devices-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="×">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

function DeviceEditor({
  L,
  value,
  isNew,
  onChange,
  onSave,
  onClose,
}: {
  L: Lang;
  value: DeviceInput;
  isNew: boolean;
  onChange: (value: DeviceInput) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const set = <K extends keyof DeviceInput>(key: K, v: DeviceInput[K]) => onChange({...value, [key]: v});
  return (
    <Modal
      title={isNew ? L('Νέα συσκευή', 'New device') : L('Επεξεργασία συσκευής', 'Edit device')}
      onClose={onClose}
      footer={
        <>
          <AppButton onClick={onClose}>{L('Ακύρωση', 'Cancel')}</AppButton>
          <AppButton variant="primary" disabled={!value.name.trim()} onClick={onSave}>
            {L('Αποθήκευση', 'Save')}
          </AppButton>
        </>
      }
    >
      <div className="form-grid devices-form">
        <label className="span-2">
          {L('Όνομα', 'Name')} *
          <input
            autoFocus
            value={value.name}
            onChange={e => set('name', e.target.value)}
            placeholder={L('π.χ. Κλίβανος 1', 'e.g. Sterilizer 1')}
          />
          <small>
            {L(
              'Το ίδιο όνομα εμφανίζεται στην επιλογή κλιβάνου κατά την καταγραφή κύκλου.',
              'The same name appears in the sterilizer choice when a cycle is recorded.',
            )}
          </small>
        </label>
        <label>
          {L('Τύπος', 'Type')}
          <select value={value.kind} onChange={e => set('kind', e.target.value as DeviceKind)}>
            {KINDS.map(k => (
              <option key={k} value={k}>
                {L(deviceKindLabel[k].el, deviceKindLabel[k].en)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {L('Σύνδεση', 'Connection')}
          <select value={value.connection} onChange={e => set('connection', e.target.value as DeviceConnection)}>
            {CONNECTIONS.map(c => (
              <option key={c} value={c}>
                {L(connectionLabel[c].el, connectionLabel[c].en)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {L('Κατασκευαστής', 'Manufacturer')}
          <input value={value.manufacturer || ''} onChange={e => set('manufacturer', e.target.value)} />
        </label>
        <label>
          {L('Μοντέλο', 'Model')}
          <input value={value.model || ''} onChange={e => set('model', e.target.value)} />
        </label>
        <label>
          {L('Σειριακός αριθμός', 'Serial number')}
          <input value={value.serialNumber || ''} onChange={e => set('serialNumber', e.target.value)} />
        </label>
        <label>
          {L('Θέση', 'Location')}
          <input value={value.location || ''} onChange={e => set('location', e.target.value)} />
        </label>
        <label className="span-2 devices-check">
          <input type="checkbox" checked={value.active} onChange={e => set('active', e.target.checked)} />
          {L('Ενεργή (δέχεται δεδομένα)', 'Active (accepts data)')}
        </label>
        <p className="span-2 devices-hint">
          {value.connection === 'API'
            ? L(
                'Δίκτυο: μετά την αποθήκευση πατήστε «Κλειδί δικτύου». Ο τεχνικός του κατασκευαστή ρυθμίζει τη συσκευή ή το λογισμικό της να στέλνει κάθε κύκλο με αυτό το κλειδί.',
                'Network: after saving press “Network key”. The manufacturer’s technician sets the device or its software to send every cycle with that key.',
              )
            : value.connection === 'SERIAL'
              ? L(
                  'Καλώδιο: συνδέστε τη συσκευή σε υπολογιστή της Αποστείρωσης (Chrome ή Edge) και πατήστε «Καλώδιο» στην κάρτα της.',
                  'Cable: connect the device to a Sterilization computer (Chrome or Edge) and press “Cable” on its card.',
                )
              : L(
                  'Αρχείο: εξάγετε τους κύκλους από τη συσκευή σε USB (CSV ή Excel) και ανεβάστε το αρχείο με «Αρχείο».',
                  'File: export the cycles from the device to USB (CSV or Excel) and upload the file with “File”.',
                )}
        </p>
      </div>
    </Modal>
  );
}

function KeyDialog({
  L,
  device,
  deviceKey,
  busy,
  onIssue,
  onClose,
}: {
  L: Lang;
  device: Device;
  deviceKey?: string;
  busy?: boolean;
  onIssue: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState('');
  const copy = (label: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => setCopied(label));
  };
  const example = `POST ${deviceIngestUrl()}
x-device-key: ${deviceKey || 'stk_…'}
Content-Type: application/json

{"cycle_number": "2026-0412", "program": "134°C 5 min",
 "started_at": "2026-10-04T08:12:00Z", "ended_at": "2026-10-04T09:01:00Z",
 "result": "PASS", "max_temperature": 134.6, "max_pressure": 3.1, "duration_minutes": 49}`;
  return (
    <Modal
      title={L('Κλειδί δικτύου', 'Network key')}
      subtitle={device.name}
      onClose={onClose}
      footer={<AppButton onClick={onClose}>{L('Κλείσιμο', 'Close')}</AppButton>}
    >
      <div className="devices-key">
        {deviceKey ? (
          <>
            <p className="devices-key-warning">
              {L(
                'Αντιγράψτε το κλειδί τώρα: δεν θα ξαναφανεί. Αν χαθεί, δημιουργήστε νέο (το παλιό σταματά να ισχύει).',
                'Copy the key now: it will not be shown again. If it is lost, create a new one (the old one stops working).',
              )}
            </p>
            <label>
              {L('Κλειδί', 'Key')}
              <span className="devices-copy">
                <code>{deviceKey}</code>
                <button onClick={() => copy('key', deviceKey)}>
                  <Copy size={14} />
                  {copied === 'key' ? L('Αντιγράφηκε', 'Copied') : L('Αντιγραφή', 'Copy')}
                </button>
              </span>
            </label>
          </>
        ) : (
          <>
            <p>
              {device.keyHint
                ? L(
                    `Η συσκευή έχει κλειδί που τελειώνει σε …${device.keyHint}. Ένα νέο κλειδί αντικαθιστά το παλιό, που σταματά να ισχύει αμέσως.`,
                    `The device has a key ending in …${device.keyHint}. A new key replaces it, and the old one stops working at once.`,
                  )
                : L(
                    'Η συσκευή δεν έχει ακόμη κλειδί. Δημιουργήστε ένα και δώστε το στον τεχνικό που ρυθμίζει τη συσκευή.',
                    'The device has no key yet. Create one and give it to the technician who sets up the device.',
                  )}
            </p>
            <AppButton variant="primary" disabled={busy} onClick={onIssue}>
              <KeyRound size={15} />
              {busy ? L('Δημιουργία…', 'Creating…') : L('Δημιουργία κλειδιού', 'Create key')}
            </AppButton>
          </>
        )}
        <label>
          {L('Διεύθυνση αποστολής', 'Address to send to')}
          <span className="devices-copy">
            <code>{deviceIngestUrl()}</code>
            <button onClick={() => copy('url', deviceIngestUrl())}>
              <Copy size={14} />
              {copied === 'url' ? L('Αντιγράφηκε', 'Copied') : L('Αντιγραφή', 'Copy')}
            </button>
          </span>
        </label>
        <label>
          {L('Παράδειγμα για τον τεχνικό', 'Example for the technician')}
          <pre>{example}</pre>
        </label>
        <small>
          {L(
            'Δέχεται έναν κύκλο, λίστα κύκλων ή {"cycles": [...]}. Υποχρεωτικός μόνο ο αριθμός κύκλου· ένας κύκλος που έχει ήδη έρθει αγνοείται.',
            'Accepts one cycle, a list, or {"cycles": [...]}. Only the cycle number is required; a cycle already received is skipped.',
          )}
        </small>
      </div>
    </Modal>
  );
}

function ReadingPreview({L, drafts}: {L: Lang; drafts: ReadingDraft[]}) {
  return (
    <div className="devices-table-wrap small">
      <table className="devices-table">
        <thead>
          <tr>
            <th>{L('Κύκλος', 'Cycle')}</th>
            <th>{L('Πρόγραμμα', 'Program')}</th>
            <th>{L('Αποτέλεσμα', 'Result')}</th>
            <th>°C</th>
            <th>bar</th>
          </tr>
        </thead>
        <tbody>
          {drafts.slice(0, 8).map((d, i) => (
            <tr key={`${d.cycleNumber}-${i}`}>
              <td className="mono">{d.cycleNumber}</td>
              <td>{d.program || '—'}</td>
              <td>
                <span className={`device-result ${d.result.toLowerCase()}`}>
                  {d.result === 'PASS'
                    ? L('Επιτυχία', 'Pass')
                    : d.result === 'FAIL'
                      ? L('Αποτυχία', 'Fail')
                      : L('Άγνωστο', 'Unknown')}
                </span>
              </td>
              <td>{d.maxTemperature ?? '—'}</td>
              <td>{d.maxPressure ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {drafts.length > 8 && <small>{L(`…και ${drafts.length - 8} ακόμη.`, `…and ${drafts.length - 8} more.`)}</small>}
    </div>
  );
}

function FileDialog({
  L,
  device,
  onStore,
  onClose,
}: {
  L: Lang;
  device: Device;
  onStore: (drafts: ReadingDraft[]) => Promise<void>;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<ReadingDraft[]>();
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const open = async (file: File) => {
    setInfo('');
    try {
      const rows = await readSheetFile(file);
      const {readings, skipped, headerFound} = readingsFromSheet(rows);
      if (!headerFound) {
        setDrafts(undefined);
        setInfo(
          L(
            'Δεν βρέθηκε στήλη με αριθμό κύκλου (π.χ. «Κύκλος», «Cycle», «Batch»).',
            'No cycle number column found (e.g. “Cycle”, “Batch”).',
          ),
        );
        return;
      }
      setDrafts(readings);
      setInfo(
        L(
          `${readings.length} κύκλοι στο «${file.name}»${skipped ? ` · ${skipped} γραμμές χωρίς αριθμό κύκλου αγνοήθηκαν` : ''}.`,
          `${readings.length} cycles in “${file.name}”${skipped ? ` · ${skipped} rows without a cycle number skipped` : ''}.`,
        ),
      );
    } catch {
      setInfo(
        L('Το αρχείο δεν διαβάστηκε. Χρησιμοποιήστε CSV ή .xlsx.', 'The file could not be read. Use CSV or .xlsx.'),
      );
    }
  };
  const save = async () => {
    if (!drafts?.length) return;
    setBusy(true);
    try {
      await onStore(drafts);
      onClose();
    } catch (e) {
      setInfo(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={L('Κύκλοι από αρχείο', 'Cycles from a file')}
      subtitle={device.name}
      onClose={onClose}
      footer={
        <>
          <AppButton onClick={onClose}>{L('Ακύρωση', 'Cancel')}</AppButton>
          <AppButton variant="primary" disabled={!drafts?.length || busy} onClick={() => void save()}>
            {busy
              ? L('Αποθήκευση…', 'Saving…')
              : L(`Αποθήκευση ${drafts?.length || 0} κύκλων`, `Store ${drafts?.length || 0} cycles`)}
          </AppButton>
        </>
      }
    >
      <p className="devices-hint">
        {L(
          'Εξάγετε τους κύκλους από τη συσκευή σε USB (CSV ή Excel). Αναγνωρίζονται στήλες όπως Κύκλος, Πρόγραμμα, Έναρξη, Λήξη, Αποτέλεσμα, Θερμοκρασία, Πίεση, Διάρκεια.',
          'Export the cycles from the device to USB (CSV or Excel). Columns such as Cycle, Program, Start, End, Result, Temperature, Pressure, Duration are recognized.',
        )}
      </p>
      <label className="asset-import-drop">
        <Upload size={20} />
        <b>{L('Επιλέξτε αρχείο', 'Choose a file')}</b>
        <small>.csv · .txt · .xlsx</small>
        <input
          type="file"
          hidden
          accept=".csv,.txt,.xlsx,text/csv,text/plain"
          onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void open(file);
          }}
        />
      </label>
      {info && <p className="devices-info">{info}</p>}
      {drafts && drafts.length > 0 && <ReadingPreview L={L} drafts={drafts} />}
    </Modal>
  );
}

function SerialDialog({
  L,
  device,
  onStore,
  onClose,
}: {
  L: Lang;
  device: Device;
  onStore: (drafts: ReadingDraft[]) => Promise<void>;
  onClose: () => void;
}) {
  const [baudRate, setBaudRate] = useState(9600);
  const [log, setLog] = useState('');
  const [state, setState] = useState<'idle' | 'open' | 'closed'>('idle');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const session = useRef<SerialSession>();
  const drafts = useMemo(() => readingsFromPrintout(log), [log]);
  useEffect(() => () => void session.current?.close(), []);

  const connect = async () => {
    setInfo('');
    try {
      session.current = await openSerialPort(baudRate, chunk => setLog(current => (current + chunk).slice(-200_000)));
      setState('open');
      void session.current.done.then(() => setState('closed'));
    } catch (e) {
      setInfo(
        (e as {name?: string})?.name === 'NotFoundError'
          ? L('Δεν επιλέχθηκε θύρα.', 'No port was chosen.')
          : L('Η θύρα δεν άνοιξε: ', 'The port did not open: ') + messageOf(e),
      );
    }
  };
  const disconnect = async () => {
    await session.current?.close();
    session.current = undefined;
    setState('closed');
  };
  const save = async () => {
    if (!drafts.length) return;
    setBusy(true);
    try {
      await onStore(drafts);
      setLog('');
      setInfo(
        L(
          'Αποθηκεύτηκαν. Η σύνδεση μένει ανοιχτή για τους επόμενους κύκλους.',
          'Stored. The connection stays open for the next cycles.',
        ),
      );
    } catch (e) {
      setInfo(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    void disconnect();
    onClose();
  };
  return (
    <Modal
      title={L('Σύνδεση με καλώδιο', 'Cable connection')}
      subtitle={device.name}
      onClose={close}
      footer={
        <>
          <AppButton onClick={close}>{L('Κλείσιμο', 'Close')}</AppButton>
          <AppButton variant="primary" disabled={!drafts.length || busy} onClick={() => void save()}>
            {busy
              ? L('Αποθήκευση…', 'Saving…')
              : L(`Αποθήκευση ${drafts.length} κύκλων`, `Store ${drafts.length} cycles`)}
          </AppButton>
        </>
      }
    >
      {!serialSupported() ? (
        <p className="devices-info">
          {L(
            'Αυτός ο browser δεν υποστηρίζει σειριακή θύρα. Ανοίξτε το SurgiTrack σε Chrome ή Edge σε υπολογιστή.',
            'This browser does not support serial ports. Open SurgiTrack in Chrome or Edge on a computer.',
          )}
        </p>
      ) : (
        <>
          <p className="devices-hint">
            {L(
              'Συνδέστε το καλώδιο της συσκευής (RS-232 ή USB) σε αυτόν τον υπολογιστή, διαλέξτε ταχύτητα όπως στο εγχειρίδιο της συσκευής και πατήστε «Σύνδεση». Ό,τι τυπώνει η συσκευή εμφανίζεται εδώ και οι κύκλοι αναγνωρίζονται αυτόματα.',
              'Connect the device cable (RS-232 or USB) to this computer, choose the speed from the device manual and press “Connect”. What the device prints shows here and cycles are recognized automatically.',
            )}
          </p>
          <div className="devices-serial-bar">
            <label>
              {L('Ταχύτητα (baud)', 'Speed (baud)')}
              <select value={baudRate} disabled={state === 'open'} onChange={e => setBaudRate(Number(e.target.value))}>
                {BAUD_RATES.map(b => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            {state === 'open' ? (
              <AppButton onClick={() => void disconnect()}>{L('Αποσύνδεση', 'Disconnect')}</AppButton>
            ) : (
              <AppButton variant="primary" onClick={() => void connect()}>
                <Cable size={15} />
                {L('Σύνδεση', 'Connect')}
              </AppButton>
            )}
            <span className={`devices-serial-state ${state}`}>
              {state === 'open'
                ? L('Συνδεδεμένο · αναμονή δεδομένων', 'Connected · waiting for data')
                : state === 'closed'
                  ? L('Αποσυνδεδεμένο', 'Disconnected')
                  : ''}
            </span>
          </div>
          <pre className="devices-serial-log">{log || L('Δεν έχουν έρθει δεδομένα ακόμη.', 'No data yet.')}</pre>
          {drafts.length > 0 && <ReadingPreview L={L} drafts={drafts} />}
        </>
      )}
      {info && <p className="devices-info">{info}</p>}
    </Modal>
  );
}
