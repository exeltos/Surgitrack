// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {answerTables, eqValue, loadFunction, post, resetFake} from './harness';
import {fake, type DbCall} from './fakes/supabase';

type Handler = (req: Request) => Response | Promise<Response>;
type Row = Record<string, unknown> | null;

const ME = {role: 'ADMIN', active: true, organization_id: 'org-1'};
const DEVICE = {id: 'device-1', organization_id: 'org-1'};

/** The caller's own profile and the device they name. */
const world = (w: {me?: Row; device?: Row} = {}) => {
  answerTables({
    'profiles:select': 'me' in w ? w.me : ME,
    'devices:select': 'device' in w ? w.device : DEVICE,
  });
};
const sha256 = async (text: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');
const keyWrites = () => fake.dbCalls('upsert').filter(c => c.table === 'device_keys');
const deviceUpdates = () => fake.dbCalls('update').filter(c => c.table === 'devices');
const nothingWritten = () => expect(fake.dbCalls().filter(c => c.op !== 'select')).toHaveLength(0);

let handle: Handler;
const newKey = (device_id = 'device-1') => handle(post({device_id}));
beforeEach(async () => {
  resetFake();
  fake.user = {id: 'admin-1'};
  world();
  handle = await loadFunction('device-key');
});

describe('device-key: who may issue a key', () => {
  it('answers the browser preflight and refuses other methods', async () => {
    expect((await handle(new Request('http://localhost/fn', {method: 'OPTIONS'}))).status).toBe(200);
    expect((await handle(new Request('http://localhost/fn', {method: 'GET'}))).status).toBe(405);
  });

  it('refuses a caller who is not signed in', async () => {
    fake.user = null;
    expect((await newKey()).status).toBe(401);
    nothingWritten();
  });

  it.each([
    ['a department user', {...ME, role: 'DEPARTMENT'}],
    ['a sterilization user', {...ME, role: 'STERILIZATION'}],
    ['a viewer', {...ME, role: 'VIEWER'}],
    ['an inactive admin', {...ME, active: false}],
    ['no profile at all', null],
  ])('refuses %s, writing nothing and returning no key', async (_label, me) => {
    world({me});
    const response = await newKey();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({error: 'forbidden'});
    nothingWritten();
  });

  it('answers 404 for a device that does not exist, or none named', async () => {
    world({device: null});
    expect((await newKey()).status).toBe(404);
    expect((await handle(post({}))).status).toBe(404);
    nothingWritten();
  });

  it("refuses a hospital admin for another hospital's device, writing nothing", async () => {
    world({device: {...DEVICE, organization_id: 'org-2'}});
    const response = await newKey();
    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).not.toContain('stk_');
    nothingWritten();
  });

  it('lets the platform admin (no hospital) issue a key for any hospital', async () => {
    world({me: {...ME, organization_id: null}, device: {...DEVICE, organization_id: 'org-2'}});
    const response = await newKey();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ok: true});
  });

  it('looks the device up by the id in the request', async () => {
    await newKey('device-7');
    const lookup = fake.dbCalls().find((c: DbCall) => c.table === 'devices');
    expect(eqValue(lookup!, 'id')).toBe('device-7');
  });
});

describe('device-key: the key', () => {
  it('hashes with SHA-256 (checked against a known answer)', async () => {
    expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('returns a key like stk_ plus 48 hex characters, once', async () => {
    const body = await (await newKey()).json();
    expect(body.ok).toBe(true);
    expect(body.key).toMatch(/^stk_[0-9a-f]{48}$/);
  });

  it('makes a different key every time', async () => {
    const keys = new Set<string>();
    for (let i = 0; i < 20; i++) keys.add((await (await newKey()).json()).key);
    expect(keys.size).toBe(20);
  });

  it('stores only the SHA-256 of the key, never the key itself', async () => {
    const {key} = await (await newKey()).json();
    expect(keyWrites()).toHaveLength(1);
    const stored = keyWrites()[0].values as Record<string, unknown>;
    expect(stored.key_hash).toBe(await sha256(key));
    expect(JSON.stringify(fake.dbCalls())).not.toContain(key);
  });

  it('replaces the previous key: one row per device, keyed by the device', async () => {
    await newKey();
    await newKey();
    const rows = keyWrites().map(c => c.values as Record<string, unknown>);
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row).toMatchObject({device_id: 'device-1', key_hash: expect.stringMatching(/^[0-9a-f]{64}$/)});
    expect(rows[0].key_hash).not.toBe(rows[1].key_hash);
  });

  it('notes only the last four characters on the device, and marks it as connected by API', async () => {
    const {key} = await (await newKey()).json();
    expect(deviceUpdates()).toHaveLength(1);
    expect(deviceUpdates()[0].values).toEqual({key_hint: key.slice(-4), connection: 'API'});
    expect(eqValue(deviceUpdates()[0], 'id')).toBe('device-1');
  });

  it('does not touch the device, or return a key, when the key could not be stored', async () => {
    const answers = fake.db;
    fake.db = call => (call.op === 'upsert' ? {data: null, error: {message: 'db down'}} : answers(call));
    const response = await newKey();
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({error: 'failed'});
    expect(text).not.toContain('stk_');
    expect(deviceUpdates()).toHaveLength(0);
  });

  it('reports an unexpected error as failed, with no key', async () => {
    fake.db = () => {
      throw new Error('boom');
    };
    const response = await newKey();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('stk_');
  });
});
