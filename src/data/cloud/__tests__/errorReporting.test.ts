import {beforeEach, describe, expect, it, vi} from 'vitest';

const db = vi.hoisted(() => ({insert: vi.fn(), mode: 'PRODUCTION'}));
vi.mock('../../../lib/supabase', () => ({
  supabase: {from: () => ({insert: (row: unknown) => (db.insert(row), Promise.resolve({error: null}))})},
}));
vi.mock('../useAppRecordSync', () => ({onSyncNotice: () => () => undefined}));
vi.mock('../../../config/dataMode', async original => ({
  ...(await original<typeof import('../../../config/dataMode')>()),
  getRuntimeDataMode: () => db.mode,
}));

const load = async () => {
  vi.resetModules();
  return import('../errorReporting');
};

describe('error reporting', () => {
  beforeEach(() => {
    db.insert.mockReset();
    db.mode = 'PRODUCTION';
    window.location.hash = '#/sets/abc?tab=x';
  });

  it('sends the message, the screen and the version, with the hospital', async () => {
    const {reportError, setErrorReportingOrganization} = await load();
    setErrorReportingOrganization('org-1');
    reportError('error', new TypeError('x is undefined'));
    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({organization_id: 'org-1', kind: 'error', message: 'x is undefined', route: '/sets/abc'}),
    );
  });

  it('sends the same error once per 10 minutes, and at most 20 per tab', async () => {
    const {reportError} = await load();
    reportError('error', 'same');
    reportError('error', 'same');
    expect(db.insert).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 40; i++) reportError('error', `different ${i}`);
    expect(db.insert).toHaveBeenCalledTimes(20);
  });

  it('ignores browser noise, replaced page files and the Demo', async () => {
    const {reportError} = await load();
    reportError('error', 'ResizeObserver loop completed with undelivered notifications.');
    reportError('rejection', new TypeError('Failed to fetch'));
    reportError('rejection', new TypeError('Failed to fetch dynamically imported module: /assets/x.js'));
    db.mode = 'DEMO';
    reportError('error', 'real but in Demo');
    expect(db.insert).not.toHaveBeenCalled();
  });
});
