import type {Device} from '../../core/deviceData';
import {deviceIngestUrl, issueDeviceKey, listDevices, saveDevice} from './devices';

/**
 * The simulated sterilizer's link to the connected devices: a cycle the simulation ended is sent to the
 * device-ingest function exactly as a real device (or the gateway in front of it) sends one, signed with the
 * device's own key. The device it is sent as is a normal row of the Devices page, marked as a simulation.
 */

/** What marks a device row as the simulator's (shown as «Προσομοίωση» on the Devices page). */
export const SIMULATOR_MAKER = 'SurgiTrack Simulator';

export const isSimulatedDevice = (device: Pick<Device, 'manufacturer'>) => device.manufacturer === SIMULATOR_MAKER;

/** The device a sterilizer's simulated cycles come from. */
export const simulatedDeviceName = (equipment: string) => `${equipment} (προσομοίωση)`;

/** A cycle as the device reports it. */
export type SimulatedCycle = {
  cycleNumber: string;
  program: string;
  startedAt: string;
  endedAt: string;
  result: 'PASS' | 'FAIL';
  maxTemperature: number;
  maxPressure: number;
  durationMinutes: number;
};

/** The simulated device of this sterilizer (made the first time, then reused). */
async function simulatedDevice(organizationId: string, equipment: string): Promise<Device> {
  const name = simulatedDeviceName(equipment);
  const find = (list: Device[]) => list.find(d => isSimulatedDevice(d) && d.name === name);
  const existing = find(await listDevices(organizationId));
  if (existing) return existing;
  await saveDevice(organizationId, {
    name,
    kind: 'STERILIZER',
    manufacturer: SIMULATOR_MAKER,
    model: 'Εικονικός κλίβανος',
    location: equipment,
    connection: 'API',
    active: true,
  });
  const created = find(await listDevices(organizationId));
  if (!created) throw new Error('simulated device missing');
  return created;
}

/**
 * Sends the cycle to device-ingest as the simulated device and says how many readings were new (0: the device had
 * reported that cycle number already). A new key is issued for the call and kept nowhere: only a hospital admin
 * may issue it, so for anyone else this fails (and the caller says so).
 */
export async function sendSimulatedCycle(
  organizationId: string,
  equipment: string,
  cycle: SimulatedCycle,
): Promise<{stored: number}> {
  const device = await simulatedDevice(organizationId, equipment);
  const key = await issueDeviceKey(device.id);
  const response = await fetch(deviceIngestUrl(), {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-device-key': key},
    body: JSON.stringify({
      cycles: [
        {
          cycle_number: cycle.cycleNumber,
          program: cycle.program,
          started_at: cycle.startedAt,
          ended_at: cycle.endedAt,
          result: cycle.result,
          max_temperature: cycle.maxTemperature,
          max_pressure: cycle.maxPressure,
          duration_minutes: cycle.durationMinutes,
          simulated: true,
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`device-ingest ${response.status}`);
  const body = (await response.json().catch(() => ({}))) as {stored?: number};
  return {stored: body.stored ?? 0};
}
