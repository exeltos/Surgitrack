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
let outcome = 'ok';
const submitted = () => fake.calls.filter(c => c.what === 'rpc' && c.args[0] === 'submit_contact_request');
const answer = () => {
  fake.rpc = name => (name === 'submit_contact_request' ? {data: outcome, error: null} : {data: null, error: null});
  fake.db = (call: DbCall) => {
    if (call.table === 'platform_settings')
      return {data: {public_email: 'info@exeltos.com', contact_email: 'support@example.test'}, error: null};
    return {data: null, error: null};
  };
};
const outbox = () => mailState.outbox as Mail[];

let handle: Handler;
beforeEach(async () => {
  resetFake();
  outcome = 'ok';
  answer();
  Object.assign(env, {SMTP_HOST: 'smtp.example', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'SurgiTrack <no-reply@example.gr>'});
  handle = await loadFunction('contact-request');
});

describe('contact-request', () => {
  it('stores the request with only a hash of the address, and emails the company', async () => {
    const response = await handle(post(FORM, {'cf-connecting-ip': '203.0.113.9'}));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ok: true, emailed: true});
    const row = submitted()[0].args[1] as Record<string, string | number>;
    expect(row).toMatchObject({p_name: 'Μαρία Παπαδάκη', p_email: 'maria@example.test', p_role: 'Προϊσταμένη ΚΑ'});
    expect(row.p_message).toContain('\n');
    expect(row.p_ip_hash).toMatch(/^[0-9a-f]{64}$/);
    // The limits travel with the request: the database checks them and stores it in one step.
    expect(row).toMatchObject({p_per_address: 3, p_per_hour: 30});
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
    expect(submitted()).toHaveLength(0);
    expect(outbox()).toHaveLength(0);
  });

  it.each([
    ['no name', {name: ' '}],
    ['a wrong email', {email: 'not-an-email'}],
    ['no message', {message: 'γεια'}],
  ])('refuses a request with %s', async (_label, change) => {
    expect((await handle(post({...FORM, ...change}))).status).toBe(400);
    expect(submitted()).toHaveLength(0);
  });

  it('says so when the database refuses it over the hourly limits, and sends no email', async () => {
    outcome = 'too_many';
    const response = await handle(post(FORM));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({error: 'too_many'});
    expect(outbox()).toHaveLength(0);
  });

  it('keeps the request even when no email can be sent', async () => {
    for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM']) delete env[key];
    const response = await handle(post(FORM));
    expect(await response.json()).toEqual({ok: true, emailed: false});
    expect(submitted()).toHaveLength(1);
  });
});
