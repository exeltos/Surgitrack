import {describe, expect, it} from 'vitest';
import {
  readingFromValues,
  readingsFromPrintout,
  readingsFromSheet,
  unusedReadings,
  type DeviceReading,
} from '../deviceData';

describe('device data', () => {
  it('reads a network message with the documented names', () => {
    expect(
      readingFromValues({
        cycle_number: '2026-0412',
        program: '134°C 5 min',
        started_at: '2026-10-04T08:12:00Z',
        result: 'PASS',
        max_temperature: 134.6,
        max_pressure: '3,1',
        duration_minutes: 49,
      }),
    ).toMatchObject({
      cycleNumber: '2026-0412',
      program: '134°C 5 min',
      startedAt: '2026-10-04T08:12:00.000Z',
      result: 'PASS',
      maxTemperature: 134.6,
      maxPressure: 3.1,
      durationMinutes: 49,
    });
    expect(readingFromValues({program: 'x'})).toBeUndefined();
  });

  it('reads an exported file in Greek, skipping a title line and rows without a cycle', () => {
    const {readings, skipped, headerFound} = readingsFromSheet([
      ['Αναφορά κύκλων κλιβάνου'],
      ['Κύκλος', 'Πρόγραμμα', 'Έναρξη', 'Αποτέλεσμα', 'Θερμοκρασία (°C)', 'Πίεση'],
      ['1201', 'Prion 18′', '04/10/2026 08:30', 'Επιτυχία', '134,2', '3.05'],
      ['', 'Test', '', '', '', ''],
      ['1202', 'Bowie-Dick', '04/10/2026 09:15', 'ΑΠΟΤΥΧΙΑ', '', ''],
    ]);
    expect(headerFound).toBe(true);
    expect(skipped).toBe(1);
    expect(readings.map(r => [r.cycleNumber, r.result, r.maxTemperature])).toEqual([
      ['1201', 'PASS', 134.2],
      ['1202', 'FAIL', undefined],
    ]);
    expect(new Date(readings[0].startedAt!).getDate()).toBe(4);
  });

  it('reads a serial printout of tickets and JSON lines', () => {
    const printout = [
      'MELAG Vacuklav',
      'Cycle: 0815',
      'Program: 134C Universal',
      'Max temp: 135.1 C',
      'Result: OK',
      '----------',
      '{"cycle":"0816","result":"FAIL","temperature":121}',
      'Cycle = 0817',
      'Status = passed',
    ].join('\r\n');
    expect(readingsFromPrintout(printout).map(r => [r.cycleNumber, r.result, r.maxTemperature])).toEqual([
      ['0815', 'PASS', 135.1],
      ['0816', 'FAIL', 121],
      ['0817', 'PASS', undefined],
    ]);
  });

  it('leaves out cycles already used by a record', () => {
    const r = (cycleNumber: string) => ({id: cycleNumber, cycleNumber}) as DeviceReading;
    expect(unusedReadings([r('A-1'), r('a-2 '), r('B')], ['a-1', 'A-2']).map(x => x.id)).toEqual(['B']);
  });
});
