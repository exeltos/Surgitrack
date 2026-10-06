// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {answerTables, eqValue, loadFunction, resetFake} from './harness';
import {fake, type DbCall} from './fakes/supabase';

type Handler = (req: Request) => Response | Promise<Response>;
type Row = Record<string, unknown> | null;

const KEY = `stk_${'ab12'.repeat(12)}`;
const DEVICE = {id: 'device-1', organization_id: 'org-1', active: true};
const ORG = {plan: 'PAID', trial_ends_at: null};
const DAY = 86_400_000;

type World = {found?: Row; device?: Row; org?: Row; stored?: number};
/** A known key, an active device, a paying hospital; every cycle sent is new unless `stored` says fewer were. */
const world = (w: World = {}) => {
  answerTables({
    'device_keys:select': 'found' in w ? w.found : {device_id: 'device-1'},
    'devices:select': 'device' in w ? w.device : DEVICE,
    'organizations:select': 'org' in w ? w.org : ORG,
    'device_readings:upsert': (call: DbCall) => {
      const rows = call.values as unknown[];
      return Array.from({length: w.stored ?? rows.length}, (_, i) => ({id: `reading-${i}`}));
    },
  });
};
const sha256 = async (text: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');
const send = (body: unknown, headers: Record<string, string> = {'x-device-key': KEY}) =>
  new Request('http://localhost/fn', {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: typeof body === 'string' ? body : JSON.stringify(body)});
const readings = () => fake.dbCalls('upsert').filter(c => c.table === 'device_readings');
const storedRows = () => readings().flatMap(c => c.values as Array<Record<string, unknown>>);
const nothingWritten = () => expect(fake.dbCalls().filter(c => c.op !== 'select')).toHaveLength(0);
const noDatabase = () => expect(fake.dbCalls()).toHaveLength(0);

let handle: Handler;
const ingest = (body: unknown, headers?: Record<string, string>) => handle(send(body, headers));
const one = async (cycle: Record<string, unknown>) => {
  await ingest(cycle);
  return storedRows().at(-1)!;
};
beforeEach(async () => {
  resetFake();
  world();
  handle = await loadFunction('device-ingest');
});

describe('device-ingest: the request', () => {
  it('answers the preflight, open to any origin because devices are not browsers, and refuses other methods', async () => {
    const preflight = await handle(new Request('http://localhost/fn', {method: 'OPTIONS'}));
    expect(preflight.status).toBe(200);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect((await handle(new Request('http://localhost/fn', {method: 'GET'}))).status).toBe(405);
  });

  it.each<[string, Record<string, string>]>([
    ['no key', {}],
    ['a key without the stk_ prefix', {'x-device-key': 'ab12'.repeat(12)}],
    ['a key that is too short', {'x-device-key': `stk_${'ab12'.repeat(11)}`}],
    ['a key that is too long', {'x-device-key': `${KEY}0`}],
    ['a key in capitals', {'x-device-key': KEY.toUpperCase()}],
    ['a key that is not hex', {'x-device-key': `stk_${'zz12'.repeat(12)}`}],
    ['a bearer token that is not a device key', {Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.e30.x'}],
  ])('answers 401 for %s, before reading the body or the database', async (_label, headers) => {
    const response = await ingest({cycle_number: '1'}, headers);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({error: 'device_key_required'});
    noDatabase();
  });

  it('takes the key from x-device-key or from a bearer token (any letter case of "Bearer")', async () => {
    for (const headers of [{'x-device-key': KEY}, {Authorization: `Bearer ${KEY}`}, {Authorization: `bearer ${KEY}`}]) {
      expect((await ingest({cycle_number: '1'}, headers)).status).toBe(200);
    }
  });

  it('checks the key shape before the size of the body', async () => {
    const response = await ingest('x'.repeat(512 * 1024 + 1), {});
    expect(response.status).toBe(401);
  });

  it('answers 413 for a body over 512 kB, 400 for invalid JSON', async () => {
    expect((await ingest('x'.repeat(512 * 1024 + 1))).status).toBe(413);
    const bad = await ingest('{not json');
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({error: 'invalid_json'});
    noDatabase();
  });

  it('accepts one cycle, a list, or {cycles: [...]}', async () => {
    await ingest({cycle_number: 'A'});
    await ingest([{cycle_number: 'B'}, {cycle_number: 'C'}]);
    await ingest({cycles: [{cycle_number: 'D'}]});
    expect(storedRows().map(r => r.cycle_number)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('answers 400 for an empty list, and 413 above 200 cycles (200 is fine)', async () => {
    for (const empty of [[], {cycles: []}]) {
      const response = await ingest(empty);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({error: 'no_cycles'});
    }
    const cycles = (n: number) => Array.from({length: n}, (_, i) => ({cycle_number: String(i)}));
    expect((await ingest(cycles(200))).status).toBe(200);
    const tooMany = await ingest(cycles(201));
    expect(tooMany.status).toBe(413);
    expect(await tooMany.json()).toEqual({error: 'too_many_cycles', max: 200});
  });
});

describe('device-ingest: the device', () => {
  it('looks the device up by the SHA-256 of its key, never by the key itself', async () => {
    await ingest({cycle_number: '1'});
    const lookup = fake.dbCalls().find(c => c.table === 'device_keys')!;
    expect(eqValue(lookup, 'key_hash')).toBe(await sha256(KEY));
    expect(JSON.stringify(fake.dbCalls())).not.toContain(KEY);
  });

  it('answers 401 for a key no device has, writing nothing', async () => {
    world({found: null});
    const response = await ingest({cycle_number: '1'});
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({error: 'unknown_device_key'});
    nothingWritten();
  });

  it.each([
    ['an inactive device', {device: {...DEVICE, active: false}}],
    ['a key whose device is gone', {device: null}],
  ])('answers 403 for %s, writing nothing', async (_label, setup) => {
    world(setup);
    const response = await ingest({cycle_number: '1'});
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({error: 'device_inactive'});
    nothingWritten();
  });

  it('locks a hospital whose trial has ended, but only then', async () => {
    world({org: {plan: 'TRIAL', trial_ends_at: new Date(Date.now() - DAY).toISOString()}});
    const locked = await ingest({cycle_number: '1'});
    expect(locked.status).toBe(403);
    expect(await locked.json()).toEqual({error: 'hospital_locked'});
    nothingWritten();

    for (const org of [
      {plan: 'TRIAL', trial_ends_at: new Date(Date.now() + DAY).toISOString()},
      {plan: 'TRIAL', trial_ends_at: null},
      {plan: 'PAID', trial_ends_at: new Date(Date.now() - DAY).toISOString()},
    ]) {
      world({org});
      expect((await ingest({cycle_number: '1'})).status).toBe(200);
    }
  });

  it('takes the hospital and the device from the key, whatever the cycle says', async () => {
    const row = await one({cycle_number: '1', organization_id: 'org-2', device_id: 'device-9'});
    expect(row).toMatchObject({organization_id: 'org-1', device_id: 'device-1'});
  });

  it('notes when the device was last seen', async () => {
    await ingest({cycle_number: '1'});
    const update = fake.dbCalls('update').find(c => c.table === 'devices')!;
    expect(update.values).toEqual({last_seen_at: expect.any(String)});
    expect(eqValue(update, 'id')).toBe('device-1');
  });
});

describe('device-ingest: storing cycles', () => {
  it('skips cycles already received, and says how many were new', async () => {
    world({stored: 2});
    const body = await (await ingest([{cycle_number: 'A'}, {cycle_number: 'B'}, {cycle_number: 'C'}])).json();
    expect(body).toEqual({ok: true, received: 3, stored: 2, skipped: 1, rejected: []});
    expect(readings()[0].options).toEqual({onConflict: 'device_id,cycle_number', ignoreDuplicates: true});
  });

  it('rejects cycles with no number, by position, and stores the rest', async () => {
    const body = await (await ingest([{cycle_number: 'A'}, {program: 'x'}, 'text', null, {cycle_number: '  '}, {load: 'B'}])).json();
    expect(body).toMatchObject({received: 6, stored: 2, rejected: [1, 2, 3, 4]});
    expect(storedRows().map(r => r.cycle_number)).toEqual(['A', 'B']);
  });

  it('writes nothing when every cycle is rejected, but still notes the device', async () => {
    const body = await (await ingest([{program: 'x'}, {}])).json();
    expect(body).toEqual({ok: true, received: 2, stored: 0, skipped: 0, rejected: [0, 1]});
    expect(readings()).toHaveLength(0);
    expect(fake.dbCalls('update').filter(c => c.table === 'devices')).toHaveLength(1);
  });

  it('reports a failed write as failed, and does not note the device', async () => {
    const answers = fake.db;
    fake.db = call => (call.op === 'upsert' ? {data: null, error: {message: 'db down'}} : answers(call));
    const response = await ingest({cycle_number: '1'});
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({error: 'failed'});
    expect(fake.dbCalls('update')).toHaveLength(0);
  });

  it('reports an unexpected error as failed', async () => {
    fake.db = () => {
      throw new Error('boom');
    };
    expect((await ingest({cycle_number: '1'})).status).toBe(500);
  });
});

describe('device-ingest: reading what devices send', () => {
  it.each(['cycle_number', 'cycleNumber', 'cycle', 'cycle_no', 'batch', 'load'])('finds the cycle number under "%s"', async name => {
    expect((await one({[name]: 'C-7'})).cycle_number).toBe('C-7');
  });

  it('keeps a cycle number of 0, trims it, and cuts it at 200 characters', async () => {
    expect((await one({cycle_number: 0})).cycle_number).toBe('0');
    expect((await one({cycle_number: '  12  '})).cycle_number).toBe('12');
    expect(String((await one({cycle_number: 'x'.repeat(300)})).cycle_number)).toHaveLength(200);
  });

  it('reads the other fields under their usual names', async () => {
    const row = await one({
      cycleNumber: '2026-0412',
      programme: '134°C 5 min',
      start: '2026-10-04T08:12:00Z',
      endedAt: '2026-10-04T09:01:00Z',
      outcome: 'PASS',
      maxTemperature: 134.6,
      pressure: 3.1,
      durationMinutes: 49,
    });
    expect(row).toMatchObject({
      cycle_number: '2026-0412',
      program: '134°C 5 min',
      started_at: '2026-10-04T08:12:00.000Z',
      ended_at: '2026-10-04T09:01:00.000Z',
      result: 'PASS',
      max_temperature: 134.6,
      max_pressure: 3.1,
      duration_minutes: 49,
      source: 'API',
    });
  });

  it('keeps what was sent, as received', async () => {
    const sent = {cycle_number: '1', extra: {nested: true}};
    expect((await one(sent)).raw).toEqual(sent);
  });

  it.each([
    ['PASS', 'PASS'],
    ['ok', 'PASS'],
    ['Success', 'PASS'],
    ['ΕΠΙΤΥΧΙΑ', 'PASS'],
    ['1', 'PASS'],
    [true, 'PASS'],
    ['fail', 'FAIL'],
    ['aborted', 'FAIL'],
    ['ΑΠΟΤΥΧΙΑ', 'FAIL'],
    ['0', 'FAIL'],
    [false, 'FAIL'],
    ['maybe', 'UNKNOWN'],
    ['', 'UNKNOWN'],
  ])('reads the result %j as %s', async (value, expected) => {
    expect((await one({cycle_number: '1', result: value})).result).toBe(expected);
  });

  it('has no result of UNKNOWN to guess from when none is sent', async () => {
    expect((await one({cycle_number: '1'})).result).toBe('UNKNOWN');
  });

  it.each([
    ['134,6', 134.6],
    ['134.6 °C', 134.6],
    ['-3', -3],
    ['abc', null],
    ['N/A', null],
    ['°C', null],
  ])('reads the number %j as %j', async (value, expected) => {
    expect((await one({cycle_number: '1', max_temperature: value})).max_temperature).toBe(expected);
  });

  it('reads an unreadable time as nothing, and a readable one as ISO time', async () => {
    const row = await one({cycle_number: '1', started_at: 'yesterday-ish', ended_at: '2026-10-04 09:01:00Z'});
    expect(row.started_at).toBeNull();
    expect(row.ended_at).toBe('2026-10-04T09:01:00.000Z');
  });

  it('leaves out what was not sent', async () => {
    const row = await one({cycle_number: '1'});
    expect(row).toMatchObject({program: null, started_at: null, ended_at: null, max_temperature: null, max_pressure: null, duration_minutes: null});
  });
});
