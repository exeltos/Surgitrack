import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Device} from '../../../core/deviceData';

const state = vi.hoisted(() => ({
  devices: [] as Device[],
  saved: [] as unknown[],
  keys: 0,
  fetch: vi.fn(),
}));
vi.mock('../devices', () => ({
  deviceIngestUrl: () => 'https://x.supabase.co/functions/v1/device-ingest',
  listDevices: async () => state.devices,
  saveDevice: async (_org: string, input: Omit<Device, 'id'>) => {
    state.saved.push(input);
    state.devices = [...state.devices, {...input, id: `d${state.devices.length + 1}`} as Device];
  },
  issueDeviceKey: async () => `stk_${String(++state.keys).padStart(48, '0')}`,
}));

import {SIMULATOR_MAKER, sendSimulatedCycle, simulatedDeviceName} from '../simulatedDevice';

const cycle = {
  cycleNumber: '2026-0932',
  program: '134°C · 5 min',
  startedAt: '2026-11-09T10:00:00.000Z',
  endedAt: '2026-11-09T10:20:00.000Z',
  result: 'PASS' as const,
  maxTemperature: 135,
  maxPressure: 2.18,
  durationMinutes: 20,
};

describe('sendSimulatedCycle', () => {
  beforeEach(() => {
    state.devices = [];
    state.saved = [];
    state.keys = 0;
    state.fetch = vi.fn(async () => new Response(JSON.stringify({ok: true, stored: 1}), {status: 200}));
    vi.stubGlobal('fetch', state.fetch);
  });

  it('makes the simulated device the first time and sends the cycle signed with its key', async () => {
    const result = await sendSimulatedCycle('org', 'Κλίβανος Ατμού 01', cycle);
    expect(result).toEqual({stored: 1});
    expect(state.saved).toHaveLength(1);
    expect(state.saved[0]).toMatchObject({
      name: simulatedDeviceName('Κλίβανος Ατμού 01'),
      kind: 'STERILIZER',
      manufacturer: SIMULATOR_MAKER,
      connection: 'API',
    });
    const [url, init] = state.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/functions/v1/device-ingest');
    expect((init.headers as Record<string, string>)['x-device-key']).toMatch(/^stk_[0-9]{48}$/);
    const body = JSON.parse(String(init.body)).cycles[0];
    expect(body).toMatchObject({cycle_number: '2026-0932', result: 'PASS', max_temperature: 135, simulated: true});
  });

  it('reuses the device the next time', async () => {
    await sendSimulatedCycle('org', 'Κλίβανος Ατμού 01', cycle);
    await sendSimulatedCycle('org', 'Κλίβανος Ατμού 01', {...cycle, cycleNumber: '2026-0933'});
    expect(state.saved).toHaveLength(1);
  });

  it('does not take a real device of the same name for the simulated one', async () => {
    state.devices = [
      {
        id: 'real',
        name: simulatedDeviceName('Κλίβανος Ατμού 01'),
        kind: 'STERILIZER',
        manufacturer: 'MATACHANA',
        connection: 'API',
        active: true,
      },
    ];
    await sendSimulatedCycle('org', 'Κλίβανος Ατμού 01', cycle);
    expect(state.saved).toHaveLength(1);
  });

  it('fails when the server refuses the cycle', async () => {
    state.fetch.mockResolvedValueOnce(new Response('{}', {status: 403}));
    await expect(sendSimulatedCycle('org', 'Κλίβανος', cycle)).rejects.toThrow('device-ingest 403');
  });
});
