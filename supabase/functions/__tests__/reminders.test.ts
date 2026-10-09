// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {env, eqValue, loadFunction, mailState, post, resetFake} from './harness';
import {fake, type DbCall} from './fakes/supabase';

type Handler = (req: Request) => Response | Promise<Response>;
type Mail = {to: string; subject: string; html: string};

const DAY = 864e5;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const dateIn = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

let setting: string | undefined = 'ADMINS';
let caller: Record<string, unknown> | null = {role: 'ADMIN', active: true, organization_id: null};
let sets: unknown[] = [];
let nothingWaits = false;
const people = [
  {email: 'admin@hospital.gr', role: 'ADMIN', supervisor: false},
  {email: 'boss@hospital.gr', role: 'STERILIZATION', supervisor: true},
  {email: 'staff@hospital.gr', role: 'STERILIZATION', supervisor: false},
];
const routes = () => {
  fake.db = (call: DbCall) => {
    const answer = (data: unknown) => ({data, error: null});
    if (nothingWaits && ['issues', 'devices', 'instrument_sets', 'instruments'].includes(call.table)) return answer([]);
    if (call.table === 'organizations' && call.op === 'select')
      return answer(
        eqValue(call, 'id')
          ? {name: 'Γ.Ν. Λάρισας'}
          : [
              {id: 'org-1', name: 'Γ.Ν. Λάρισας', is_demo: false, active: true},
              {id: 'org-demo', name: 'Demo', is_demo: true, active: true},
            ],
      );
    if (call.table === 'hospital_settings') return answer([{system_settings: setting ? {reminderEmails: setting} : {}}]);
    if (call.table === 'profiles') return answer(eqValue(call, 'id') ? caller : people);
    if (call.table === 'instrument_sets') return answer(sets);
    if (call.table === 'instruments') return answer([]);
    if (call.table === 'issues')
      return answer([
        {asset: 'S000001', type: 'Έλλειψη', department: 'ΜΕΘ', created_at: ago(9)},
        {asset: 'S000002', type: 'Φθορά', department: 'ΜΕΘ', created_at: ago(1)},
      ]);
    if (call.table === 'devices') return answer([{name: 'Κλίβανος Α', location: 'ΚΑ', last_seen_at: ago(2)}]);
    return answer(null);
  };
};
const run = (body: unknown = {}, headers: Record<string, string> = {'x-cron-secret': 'cron-secret-123'}) =>
  handle(post(body, headers));
const outbox = () => mailState.outbox as Mail[];

let handle: Handler;
beforeEach(async () => {
  resetFake();
  fake.user = null;
  setting = 'ADMINS';
  nothingWaits = false;
  caller = {role: 'ADMIN', active: true, organization_id: null};
  sets = [
    {barcode: 'S000010', name: 'ΣΕΤ ΛΑΠΑΡΟΣΚΟΠΗΣΗΣ', department: 'Χειρουργείο', state: 'IN_STORAGE', updated_at: ago(40), extra: {sterileUntil: dateIn(-2)}},
    {barcode: 'S000011', name: 'ΣΕΤ ΚΑΙΣΑΡΙΚΗΣ', department: 'Μαιευτική', state: 'IN_DEPARTMENT', updated_at: ago(10), extra: {sterileUntil: dateIn(12)}},
    {barcode: 'S000012', name: 'ΣΕΤ ΟΡΘΟΠΕΔΙΚΟ', department: 'Ορθοπεδική', state: 'IN_STORAGE', updated_at: ago(3), extra: {sterileUntil: dateIn(120)}},
    {barcode: 'S000013', name: 'ΣΕΤ ΩΡΛ', department: 'ΩΡΛ', state: 'READY_FOR_PICKUP', updated_at: ago(3), extra: {sterileUntil: dateIn(150)}},
    {barcode: 'S000014', name: 'ΣΕΤ ΜΑΤΙΟΥ', department: 'Οφθαλμολογική', state: 'PENDING_STERILIZATION', updated_at: ago(0.2), extra: null},
  ];
  routes();
  Object.assign(env, {SMTP_HOST: 'smtp.example', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'SurgiTrack <no-reply@example.gr>'});
  fake.rpc = (name, args) => ({
    data: name === 'demo_cron_secret_ok' && (args as {p_secret: string}).p_secret === 'cron-secret-123',
    error: null,
  });
  handle = await loadFunction('reminders');
});

describe('reminders: who may run it', () => {
  it('sends for the scheduler with the secret', async () => {
    expect(await (await run()).json()).toMatchObject({ok: true, hospitals: 1, emails: 1});
  });

  it('refuses a wrong secret, a hospital admin, and a send by the platform owner', async () => {
    expect((await run({}, {'x-cron-secret': 'wrong'})).status).toBe(401);
    fake.user = {id: 'someone'};
    caller = {role: 'ADMIN', active: true, organization_id: 'org-1'};
    expect((await run({preview: true, organizationId: 'org-1'}, {})).status).toBe(403);
    caller = {role: 'ADMIN', active: true, organization_id: null};
    expect((await run({}, {})).status).toBe(400);
    expect(outbox()).toHaveLength(0);
  });

  it('shows the platform owner a preview without sending', async () => {
    fake.user = {id: 'owner'};
    const body = await (await run({preview: true, organizationId: 'org-1'}, {})).json();
    expect(body.subject).toContain('Γ.Ν. Λάρισας');
    expect(body.groups.map((g: {key: string}) => g.key)).toEqual(['expired', 'expiring', 'ready', 'issues', 'devices']);
    expect(outbox()).toHaveLength(0);
  });
});

describe('reminders: the email', () => {
  it('says what waits, without patient data, to the administrators only', async () => {
    await run();
    expect(outbox().map(m => m.to)).toEqual(['admin@hospital.gr']);
    const html = outbox()[0].html;
    expect(html).toContain('S000010 · ΣΕΤ ΛΑΠΑΡΟΣΚΟΠΗΣΗΣ');
    expect(html).toContain('S000011');
    expect(html).not.toContain('S000012');
    expect(html).toContain('S000013');
    expect(html).not.toContain('S000014');
    expect(html).toContain('S000001');
    expect(html).not.toContain('S000002');
    expect(html).toContain('Κλίβανος Α');
  });

  it('also to the Sterilization supervisor when chosen', async () => {
    setting = 'ADMINS_SUPERVISORS';
    await run();
    expect(outbox().map(m => m.to)).toEqual(['admin@hospital.gr', 'boss@hospital.gr']);
  });

  it('sends nothing when turned off, for Demos, or when nothing waits', async () => {
    setting = undefined;
    expect(await (await run()).json()).toMatchObject({hospitals: 0, emails: 0});
    setting = 'ADMINS';
    nothingWaits = true;
    expect(await (await run()).json()).toMatchObject({hospitals: 0, emails: 0});
    expect(outbox()).toHaveLength(0);
    expect(fake.dbCalls('select').some(c => eqValue(c, 'organization_id') === 'org-demo')).toBe(false);
  });
});
