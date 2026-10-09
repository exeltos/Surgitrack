import type {SheetRows} from './sheetImport';

/**
 * Cycle data from connected devices (sterilizers, washers…). The same rules turn a network message,
 * a row of an exported file or a printout read from a serial cable into one reading. The server's
 * device-ingest function applies the same names and values to what devices send over the network.
 */

export type DeviceKind = 'STERILIZER' | 'WASHER' | 'SEALER' | 'OTHER';
export type DeviceConnection = 'API' | 'FILE' | 'SERIAL';
export type ReadingResult = 'PASS' | 'FAIL' | 'UNKNOWN';

export type Device = {
  id: string;
  name: string;
  kind: DeviceKind;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  location?: string;
  connection: DeviceConnection;
  active: boolean;
  keyHint?: string;
  lastSeenAt?: string;
};

export type DeviceReading = {
  id: string;
  deviceId: string;
  cycleNumber: string;
  program?: string;
  startedAt?: string;
  endedAt?: string;
  result: ReadingResult;
  maxTemperature?: number;
  maxPressure?: number;
  durationMinutes?: number;
  source: DeviceConnection;
  createdAt: string;
};

/** A reading before it is stored: what the device said, ready for the readings table. */
export type ReadingDraft = Omit<DeviceReading, 'id' | 'deviceId' | 'source' | 'createdAt'> & {
  raw: Record<string, unknown>;
};

type Field =
  'cycleNumber' | 'program' | 'startedAt' | 'endedAt' | 'result' | 'maxTemperature' | 'maxPressure' | 'durationMinutes';

/** Names a device, its software or a person may give each value (compared lower case, letters and digits only). */
const NAMES: Record<Field, string[]> = {
  cycleNumber: [
    'cyclenumber',
    'cycle',
    'cycleno',
    'batch',
    'batchno',
    'load',
    'loadno',
    'κυκλοσ',
    'αριθμοσκυκλου',
    'φορτιο',
  ],
  program: ['program', 'programme', 'programname', 'προγραμμα'],
  startedAt: ['startedat', 'start', 'starttime', 'begin', 'εναρξη', 'ωραεναρξησ'],
  endedAt: ['endedat', 'end', 'endtime', 'finish', 'ληξη', 'τελοσ', 'ωραληξησ'],
  result: ['result', 'status', 'outcome', 'passed', 'αποτελεσμα', 'κατασταση'],
  maxTemperature: ['maxtemperature', 'temperature', 'temp', 'maxtemp', 'θερμοκρασια', 'μεγιστηθερμοκρασια'],
  maxPressure: ['maxpressure', 'pressure', 'maxpress', 'πιεση', 'μεγιστηπιεση'],
  durationMinutes: ['durationminutes', 'duration', 'minutes', 'διαρκεια'],
};

const key = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ς/g, 'σ')
    .replace(/[^\p{L}\p{N}]+/gu, '');

const fieldOf = (name: string) => {
  // A unit in brackets is not part of the name: «Θερμοκρασία (°C)», «Pressure [bar]».
  const k = key(name.replace(/[([][^)\]]*[)\]]/g, ''));
  return (Object.keys(NAMES) as Field[]).find(field => NAMES[field].includes(k));
};

const readingResult = (value: unknown): ReadingResult => {
  if (value === true) return 'PASS';
  if (value === false) return 'FAIL';
  const v = key(String(value ?? ''));
  if (['pass', 'ok', 'passed', 'success', 'good', 'επιτυχια', 'επιτυχησ', '1'].includes(v)) return 'PASS';
  if (['fail', 'failed', 'error', 'abort', 'aborted', 'nok', 'αποτυχια', '0'].includes(v)) return 'FAIL';
  return 'UNKNOWN';
};

const toNumber = (value: unknown) => {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  // Text with no digits at all ("N/A") is unknown, not 0: Number('') is 0.
  const digits = String(value)
    .replace(',', '.')
    .replace(/[^\d.+-]/g, '');
  const n = digits ? Number(digits) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

/** Dates as devices write them: ISO, or day/month/year with an optional time (Greek and European order). */
const toTime = (value: unknown) => {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const text = String(value).trim();
  const dmy = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  const date = dmy
    ? new Date(
        Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]),
        Number(dmy[2]) - 1,
        Number(dmy[1]),
        Number(dmy[4] || 0),
        Number(dmy[5] || 0),
        Number(dmy[6] || 0),
      )
    : new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/** One reading from named values (a JSON message, a file row, a printout); none without a cycle number. */
export function readingFromValues(values: Record<string, unknown>): ReadingDraft | undefined {
  const found: Partial<Record<Field, unknown>> = {};
  for (const [name, value] of Object.entries(values)) {
    const field = fieldOf(name);
    if (field && found[field] === undefined && value !== null && String(value).trim() !== '') found[field] = value;
  }
  const cycleNumber = found.cycleNumber === undefined ? '' : String(found.cycleNumber).trim().slice(0, 200);
  if (!cycleNumber) return undefined;
  return {
    cycleNumber,
    program: found.program === undefined ? undefined : String(found.program).trim().slice(0, 200),
    startedAt: toTime(found.startedAt),
    endedAt: toTime(found.endedAt),
    result: readingResult(found.result),
    maxTemperature: toNumber(found.maxTemperature),
    maxPressure: toNumber(found.maxPressure),
    durationMinutes: toNumber(found.durationMinutes),
    raw: values,
  };
}

/** Readings from an exported file: the first row naming a cycle column is the header. */
export function readingsFromSheet(rows: SheetRows) {
  const headerIndex = rows.findIndex(row => row.some(cell => fieldOf(cell) === 'cycleNumber'));
  if (headerIndex < 0) return {readings: [] as ReadingDraft[], skipped: 0, headerFound: false};
  const header = rows[headerIndex];
  const readings: ReadingDraft[] = [];
  let skipped = 0;
  for (const row of rows.slice(headerIndex + 1)) {
    if (!row.some(Boolean)) continue;
    const reading = readingFromValues(
      Object.fromEntries(header.map((name, i) => [name || `col${i + 1}`, row[i] ?? ''])),
    );
    if (reading) readings.push(reading);
    else skipped++;
  }
  return {readings, skipped, headerFound: true};
}

/**
 * Readings from what a serial cable printed. A device prints either one JSON object per line, or a
 * ticket of `Name: value` lines; a ticket ends at a blank line or a line of dashes / `END`.
 */
export function readingsFromPrintout(text: string) {
  const readings: ReadingDraft[] = [];
  let ticket: Record<string, string> = {};
  const close = () => {
    const reading = Object.keys(ticket).length ? readingFromValues(ticket) : undefined;
    if (reading) readings.push(reading);
    ticket = {};
  };
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('{') && line.endsWith('}')) {
      close();
      try {
        const reading = readingFromValues(JSON.parse(line));
        if (reading) readings.push(reading);
      } catch {
        // not JSON after all: ignored
      }
      continue;
    }
    if (!line || /^[-=*_]{3,}$/.test(line) || /^end$/i.test(line)) {
      close();
      continue;
    }
    const pair = line.match(/^([^:=]{1,40})[:=]\s*(.*)$/);
    if (pair) ticket[pair[1].trim()] = pair[2].trim();
  }
  close();
  return readings;
}

/** Readings of a device not yet used by a recorded cycle or load (matched by cycle number). */
export const unusedReadings = (readings: DeviceReading[], usedCycleNumbers: Iterable<string>) => {
  const used = new Set([...usedCycleNumbers].map(n => n.trim().toUpperCase()));
  return readings.filter(r => !used.has(r.cycleNumber.trim().toUpperCase()));
};

export const deviceKindLabel: Record<DeviceKind, {el: string; en: string}> = {
  STERILIZER: {el: 'Κλίβανος', en: 'Sterilizer'},
  WASHER: {el: 'Πλυντήριο-απολυμαντής', en: 'Washer-disinfector'},
  SEALER: {el: 'Θερμοσυγκολλητικό', en: 'Heat sealer'},
  OTHER: {el: 'Άλλη συσκευή', en: 'Other device'},
};

export const connectionLabel: Record<DeviceConnection, {el: string; en: string}> = {
  API: {el: 'Δίκτυο (αυτόματα)', en: 'Network (automatic)'},
  FILE: {el: 'Αρχείο (USB)', en: 'File (USB)'},
  SERIAL: {el: 'Καλώδιο (σειριακή θύρα)', en: 'Cable (serial port)'},
};
