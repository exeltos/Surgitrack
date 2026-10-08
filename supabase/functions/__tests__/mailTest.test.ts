// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {env, loadFunction, mailState, post, resetFake} from './harness';
import {fake} from './fakes/supabase';

type Handler = (req: Request) => Response | Promise<Response>;
const OWNER = {id: 'owner-1', role: 'ADMIN', active: true, organization_id: null, email: 'info@exeltos.com', name: 'Platform Admin'};

const as = (profile: Record<string, unknown> | null) => {
  fake.db = call => ({data: call.table === 'profiles' ? profile : null, error: null});
};
const mailOn = () =>
  Object.assign(env, {SMTP_HOST: 'smtp.example', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'SurgiTrack <no-reply@example.gr>'});

let handle: Handler;
beforeEach(async () => {
  resetFake();
  fake.user = {id: 'owner-1'};
  as(OWNER);
  handle = await loadFunction('mail-test');
});

describe('mail-test: the platform owner checks that emails go out', () => {
  it('refuses a caller who is not signed in', async () => {
    fake.user = null;
    expect((await handle(post({}))).status).toBe(401);
  });

  it.each([
    {organization_id: 'org-1'},
    {role: 'STERILIZATION'},
    {active: false},
  ])('refuses anyone but the platform owner (%j), sending nothing', async patch => {
    mailOn();
    as({...OWNER, ...patch});
    expect((await handle(post({}))).status).toBe(403);
    expect(mailState.outbox).toHaveLength(0);
  });

  it('says when no way of sending email is set up', async () => {
    const body = await (await handle(post({origin: 'https://surgitrack.eu'}))).json();
    expect(body).toMatchObject({configured: false, ok: false, to: 'info@exeltos.com'});
    expect(mailState.outbox).toHaveLength(0);
  });

  it('sends one message to the owner, with links to the app domain it was asked from', async () => {
    mailOn();
    const body = await (await handle(post({origin: 'https://surgitrack.eu'}))).json();
    expect(body).toMatchObject({configured: true, ok: true, via: 'smtp', to: 'info@exeltos.com', site: 'https://surgitrack.eu'});
    expect(mailState.outbox).toHaveLength(1);
    const mail = mailState.outbox[0] as {to: string; subject: string; html: string};
    expect(mail.to).toBe('info@exeltos.com');
    expect(mail.subject).toContain('Δοκιμαστικό email');
    expect(mail.html).toContain('href="https://surgitrack.eu"');
  });

  it('never links to another site', async () => {
    mailOn();
    const body = await (await handle(post({origin: 'https://evil.example'}))).json();
    expect(body.site).toBe('https://surgitrack.eu');
  });

  it('reports why sending failed', async () => {
    mailOn();
    mailState.fail = true;
    const body = await (await handle(post({}))).json();
    expect(body).toMatchObject({configured: true, ok: false, via: 'smtp', error: 'smtp down'});
  });
});
