import {supabase, supabaseUrl} from '../../lib/supabase';
import type {Device, DeviceConnection, DeviceReading, ReadingDraft} from '../../core/deviceData';

/** Connected devices of a hospital and the cycle data they sent (tables devices / device_readings). */

type DeviceRow = {
  id: string;
  name: string;
  kind: Device['kind'];
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  connection: DeviceConnection;
  active: boolean;
  key_hint: string | null;
  last_seen_at: string | null;
};
type ReadingRow = {
  id: string;
  device_id: string;
  cycle_number: string;
  program: string | null;
  started_at: string | null;
  ended_at: string | null;
  result: DeviceReading['result'];
  max_temperature: number | string | null;
  max_pressure: number | string | null;
  duration_minutes: number | string | null;
  source: DeviceConnection;
  created_at: string;
};

const DEVICE_COLUMNS = 'id,name,kind,manufacturer,model,serial_number,location,connection,active,key_hint,last_seen_at';
const READING_COLUMNS =
  'id,device_id,cycle_number,program,started_at,ended_at,result,max_temperature,max_pressure,duration_minutes,source,created_at';

const opt = <T>(value: T | null) => (value === null ? undefined : value);
const num = (value: number | string | null) => (value === null ? undefined : Number(value));

const deviceFromRow = (row: DeviceRow): Device => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  manufacturer: opt(row.manufacturer),
  model: opt(row.model),
  serialNumber: opt(row.serial_number),
  location: opt(row.location),
  connection: row.connection,
  active: row.active,
  keyHint: opt(row.key_hint),
  lastSeenAt: opt(row.last_seen_at),
});

const readingFromRow = (row: ReadingRow): DeviceReading => ({
  id: row.id,
  deviceId: row.device_id,
  cycleNumber: row.cycle_number,
  program: opt(row.program),
  startedAt: opt(row.started_at),
  endedAt: opt(row.ended_at),
  result: row.result,
  maxTemperature: num(row.max_temperature),
  maxPressure: num(row.max_pressure),
  durationMinutes: num(row.duration_minutes),
  source: row.source,
  createdAt: row.created_at,
});

export async function listDevices(organizationId: string) {
  const {data, error} = await supabase
    .from('devices')
    .select(DEVICE_COLUMNS)
    .eq('organization_id', organizationId)
    .order('name');
  if (error) throw error;
  return (data as DeviceRow[]).map(deviceFromRow);
}

export type DeviceInput = Omit<Device, 'id' | 'keyHint' | 'lastSeenAt'>;

export async function saveDevice(organizationId: string, input: DeviceInput, id?: string) {
  const row = {
    name: input.name.trim(),
    kind: input.kind,
    manufacturer: input.manufacturer?.trim() || null,
    model: input.model?.trim() || null,
    serial_number: input.serialNumber?.trim() || null,
    location: input.location?.trim() || null,
    connection: input.connection,
    active: input.active,
  };
  const {error} = id
    ? await supabase.from('devices').update(row).eq('organization_id', organizationId).eq('id', id)
    : await supabase.from('devices').insert({...row, organization_id: organizationId});
  if (error) throw error;
}

export async function deleteDevice(organizationId: string, id: string) {
  const {error} = await supabase.from('devices').delete().eq('organization_id', organizationId).eq('id', id);
  if (error) throw error;
}

/** A new network key for the device, shown once (the server keeps only its hash). */
export async function issueDeviceKey(deviceId: string) {
  const {data, error} = await supabase.functions.invoke<{ok?: boolean; key?: string}>('device-key', {
    body: {device_id: deviceId},
  });
  if (error || !data?.key) throw error || new Error('device-key failed');
  return data.key;
}

/** The newest readings of the hospital (or of one device), newest first. */
export async function listReadings(organizationId: string, options: {deviceId?: string; limit?: number} = {}) {
  let query = supabase
    .from('device_readings')
    .select(READING_COLUMNS)
    .eq('organization_id', organizationId)
    .order('created_at', {ascending: false})
    .limit(options.limit ?? 200);
  if (options.deviceId) query = query.eq('device_id', options.deviceId);
  const {data, error} = await query;
  if (error) throw error;
  return (data as ReadingRow[]).map(readingFromRow);
}

/** Stores readings from a file or a cable; a cycle the device already reported is skipped. Returns how many were new. */
export async function storeReadings(
  organizationId: string,
  deviceId: string,
  source: Exclude<DeviceConnection, 'API'>,
  readings: ReadingDraft[],
) {
  let stored = 0;
  for (let i = 0; i < readings.length; i += 200) {
    const rows = readings.slice(i, i + 200).map(r => ({
      organization_id: organizationId,
      device_id: deviceId,
      cycle_number: r.cycleNumber,
      program: r.program ?? null,
      started_at: r.startedAt ?? null,
      ended_at: r.endedAt ?? null,
      result: r.result,
      max_temperature: r.maxTemperature ?? null,
      max_pressure: r.maxPressure ?? null,
      duration_minutes: r.durationMinutes ?? null,
      source,
      raw: r.raw,
    }));
    const {data, error} = await supabase
      .from('device_readings')
      .upsert(rows, {onConflict: 'device_id,cycle_number', ignoreDuplicates: true})
      .select('id');
    if (error) throw error;
    stored += data?.length || 0;
  }
  return stored;
}

/** Where a device sends its data over the network. */
export const deviceIngestUrl = () => `${supabaseUrl}/functions/v1/device-ingest`;

/** The rows a device is kept as in the recycle bin, and what it takes to put them back. */
export type DeviceSnapshot = {device: Device; readings: DeviceReading[]; readingsTotal: number};

/** A device with its newest readings (up to `limit`) and how many it had in all, before it is deleted. */
export async function snapshotDevice(organizationId: string, device: Device, limit = 500): Promise<DeviceSnapshot> {
  const readings = await listReadings(organizationId, {deviceId: device.id, limit});
  const {count, error} = await supabase
    .from('device_readings')
    .select('id', {count: 'exact', head: true})
    .eq('organization_id', organizationId)
    .eq('device_id', device.id);
  if (error) throw error;
  return {device, readings, readingsTotal: count ?? readings.length};
}

/** Puts a deleted device back with the same id and its kept readings. Its network key is gone: issue a new one. */
export async function restoreDevice(organizationId: string, snapshot: DeviceSnapshot) {
  const d = snapshot.device;
  const {error} = await supabase.from('devices').insert({
    organization_id: organizationId,
    id: d.id,
    name: d.name,
    kind: d.kind,
    manufacturer: d.manufacturer ?? null,
    model: d.model ?? null,
    serial_number: d.serialNumber ?? null,
    location: d.location ?? null,
    connection: d.connection,
    active: d.active,
    last_seen_at: d.lastSeenAt ?? null,
  });
  if (error) throw error;
  for (let i = 0; i < snapshot.readings.length; i += 200) {
    const rows = snapshot.readings.slice(i, i + 200).map(r => ({
      organization_id: organizationId,
      id: r.id,
      device_id: d.id,
      cycle_number: r.cycleNumber,
      program: r.program ?? null,
      started_at: r.startedAt ?? null,
      ended_at: r.endedAt ?? null,
      result: r.result,
      max_temperature: r.maxTemperature ?? null,
      max_pressure: r.maxPressure ?? null,
      duration_minutes: r.durationMinutes ?? null,
      source: r.source,
      created_at: r.createdAt,
    }));
    const {error: readingsError} = await supabase
      .from('device_readings')
      .upsert(rows, {onConflict: 'device_id,cycle_number', ignoreDuplicates: true});
    if (readingsError) throw readingsError;
  }
}
