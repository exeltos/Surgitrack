import {useEffect, useMemo, useState} from 'react';
import {Cable} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import {useAppPreferences} from '../../core/AppPreferences';
import {unusedReadings, type Device, type DeviceKind, type DeviceReading} from '../../core/deviceData';
import {listDevices, listReadings} from '../../data/cloud/devices';
import {formatDateTime} from '../../core/displayDate';

const SHOWN = 5;

/**
 * Inside a cycle or load form: the newest cycles connected devices reported that no record uses
 * yet. «Χρήση» fills the form with the device's own values; the person still confirms.
 */
export default function DeviceCyclePicker({
  kind,
  equipment,
  onPick,
}: {
  kind: DeviceKind;
  /** The equipment already chosen in the form: its device's cycles come first. */
  equipment?: string;
  onPick: (reading: DeviceReading, device: Device) => void;
}) {
  const {organizationId, sterilizationCycles, processLoads} = useSurgi();
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const [devices, setDevices] = useState<Device[]>([]);
  const [readings, setReadings] = useState<DeviceReading[]>([]);

  useEffect(() => {
    if (!organizationId) return;
    let alive = true;
    Promise.all([listDevices(organizationId), listReadings(organizationId, {limit: 100})])
      .then(([list, latest]) => {
        if (!alive) return;
        setDevices(list.filter(d => d.kind === kind && d.active));
        setReadings(latest);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [organizationId, kind]);

  const candidates = useMemo(() => {
    const ids = new Set(devices.map(d => d.id));
    const used = [...sterilizationCycles.map(c => c.cycleNumber), ...processLoads.map(l => l.cycleNumber)];
    const free = unusedReadings(
      readings.filter(r => ids.has(r.deviceId)),
      used.map(n => String(n || '')),
    );
    const chosen = devices.find(d => d.name.trim().toLowerCase() === (equipment || '').trim().toLowerCase());
    return chosen
      ? [...free.filter(r => r.deviceId === chosen.id), ...free.filter(r => r.deviceId !== chosen.id)]
      : free;
  }, [devices, readings, sterilizationCycles, processLoads, equipment]);

  if (!devices.length) return null;
  const deviceOf = (r: DeviceReading) => devices.find(d => d.id === r.deviceId)!;
  const time = (iso?: string) => (iso ? formatDateTime(iso) : '');

  return (
    <div className="device-cycle-picker">
      <b>
        <Cable size={15} />
        {L('Κύκλοι από συνδεδεμένες συσκευές', 'Cycles from connected devices')}
      </b>
      {candidates.length === 0 ? (
        <small>{L('Δεν υπάρχουν νέοι κύκλοι από τις συσκευές.', 'No new cycles from the devices.')}</small>
      ) : (
        <ul>
          {candidates.slice(0, SHOWN).map(r => (
            <li key={r.id}>
              <span>
                <strong>
                  {deviceOf(r).name} · {r.cycleNumber}
                </strong>
                <small>
                  {[
                    r.program,
                    time(r.startedAt || r.createdAt),
                    r.maxTemperature !== undefined && `${r.maxTemperature}°C`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </span>
              <span className={`device-result ${r.result.toLowerCase()}`}>
                {r.result === 'PASS'
                  ? L('Επιτυχία', 'Pass')
                  : r.result === 'FAIL'
                    ? L('Αποτυχία', 'Fail')
                    : L('Άγνωστο', 'Unknown')}
              </span>
              <button type="button" onClick={() => onPick(r, deviceOf(r))}>
                {L('Χρήση', 'Use')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
