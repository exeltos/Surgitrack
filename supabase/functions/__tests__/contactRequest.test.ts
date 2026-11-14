// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {env, loadFunction, mailState, post, resetFake} from './harness';
import {fake, type DbCall} from './fakes/supabase';

type Handler = (req: Request) => Response | Promise<Response>;
type Mail = {to: string; subject: string; html: string};

const FORM = {
  name: 'Μαρία Παπαδάκη',
  organization: 'Γενικό Νοσοκομείο <Test>',
  role: 'Προϊσταμένη ΚΑ',
  email: 'Maria@Example.test',
  phone: '210 000 0000',
  message: 'Θα θέλαμε μια παρουσίαση.\nΕυχαριστούμε.',
};
let sent = {fromAddress: 0, all: 0};
const answer = () => {
  fake.db = (call: DbCall) => {
    if (call.table === 'contact_requests' && call.op === 'select')
      return {count: call.filters.some(([, column]) => column === 'ip_hash') ? sent.fromAddress : sent.all, error: null} as never;
    if (call.table === 'platform_settings')
      return {data: {public_email: 'info@exeltos.com', contact_email: 'support@example.test'}, error: null};
    return {data: null, error: null};
  };
};
const outbox = () => mailState.outbox as Mail[];

let handle: Handler;
beforeEach(async () => {
  resetFake();
  sent = {fromAddress: 0, all: 0};
  answer();
  Object.assign(env, {SMTP_HOST: 'smtp.example', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'SurgiTrack <no-reply@example.gr>'});
  handle = await loadFunction('contact-request');
});

describe('contact-request', () => {
  it('stores the request with only a hash of the address, and emails the company', async () => {
    const response = await handle(post(FORM, {'cf-connecting-ip': '203.0.113.9'}));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ok: true, emailed: true});
    const row = fake.dbCalls('insert').find(c => c.table === 'contact_requests')!.values as Record<string, string>;
    expect(row).toMatchObject({name: 'Μαρία Παπαδάκη', email: 'maria@example.test', role: 'Προϊσταμένη ΚΑ'});
    expect(row.message).toContain('\n');
    expect(row.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain('203.0.113.9');
    expect(outbox()).toHaveLength(1);
    expect(outbox()[0].to).toBe('info@exeltos.com');
    expect(outbox()[0].subject).toContain('Γενικό Νοσοκομείο');
    // What the visitor typed is escaped in the email.
    expect(outbox()[0].html).toContain('&#60;Test&#62;');
    expect(outbox()[0].html).not.toContain('<Test>');
  });

  it('pretends to accept what a bot fills in the hidden field, and keeps nothing', async () => {
    const response = await handle(post({...FORM, website: 'http://spam.example'}));
    expect(await response.json()).toEqual({ok: true});
    expect(fake.dbCalls('insert')).toHaveLength(0);
    expect(outbox()).toHaveLength(0);
  });

  it.each([
    ['no name', {name: ' '}],
    ['a wrong email', {email: 'not-an-email'}],
    ['no message', {message: 'γεια'}],
  ])('refuses a request with %s', async (_label, change) => {
    expect((await handle(post({...FORM, ...change}))).status).toBe(400);
    expect(fake.dbCalls('insert')).toHaveLength(0);
  });

  it('limits one address to 3 requests an hour, and the whole form to 30', async () => {
    sent = {fromAddress: 3, all: 3};
    expect((await handle(post(FORM))).status).toBe(429);
    sent = {fromAddress: 0, all: 30};
    expect((await handle(post(FORM))).status).toBe(429);
    expect(fake.dbCalls('insert')).toHaveLength(0);
  });

  it('keeps the request even when no email can be sent', async () => {
    for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM']) delete env[key];
    const response = await handle(post(FORM));
    expect(await response.json()).toEqual({ok: true, emailed: false});
    expect(fake.dbCalls('insert')).toHaveLength(1);
  });
});
