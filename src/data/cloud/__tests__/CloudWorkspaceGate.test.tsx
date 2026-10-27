import {describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import type {CloudRecords} from '../appRecords';
import type {CloudWorkspace} from '../CloudWorkspaceGate';

const mocks = vi.hoisted(() => ({
  readCache: vi.fn(),
  setRestored: vi.fn(),
  loadAppRecords: vi.fn(),
  seedDemoOrganization: vi.fn(),
  org: {name: 'Test Hospital', is_demo: false, evaluation: false, plan: 'STANDARD', trial_ends_at: null},
  dataMode: 'PRODUCTION',
}));

vi.mock('../../../lib/supabase', () => {
  const result = (data: unknown) => Promise.resolve({data, error: null});
  return {
    supabase: {
      auth: {onAuthStateChange: () => undefined},
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            single: () => result(mocks.org),
            order: () => result(table === 'departments' ? [] : null),
          }),
        }),
      }),
    },
  };
});
vi.mock('../identity', () => ({
  resolveIdentity: async () => ({status: 'ok', identity: {id: 'u1', platform: false}}),
  productionOrganizationFor: () => 'org-1',
}));
vi.mock('../appRecords', async importOriginal => ({
  ...(await importOriginal<typeof import('../appRecords')>()),
  loadAppRecords: mocks.loadAppRecords,
  getCloudOrganizationId: () => 'org-1',
}));
vi.mock('../demoSeed', () => ({seedDemoOrganization: mocks.seedDemoOrganization}));
vi.mock('../../../config/dataMode', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../config/dataMode')>()),
  getRuntimeDataMode: () => mocks.dataMode,
}));
vi.mock('../localCache', async importOriginal => ({
  ...(await importOriginal<typeof import('../localCache')>()),
  readCache: mocks.readCache,
  setRestored: mocks.setRestored,
  setCacheOwner: () => undefined,
}));

const {default: CloudWorkspaceGate} = await import('../CloudWorkspaceGate');
const {STORE_COLLECTIONS} = await import('../appRecords');
const {useHasModule} = await import('../modulesContext');

const serverRecords = () => {
  const records = Object.fromEntries([...STORE_COLLECTIONS, 'library'].map(c => [c, []])) as unknown as CloudRecords;
  records.library = [{id: 'settings'}];
  records.sets = [{id: 's1', name: 'Server set'} as never];
  records.tools = [{id: 't1', name: 'Server tool'} as never];
  return records;
};

describe('opening the hospital', () => {
  it("loads from the server when the copy is partial, and still restores the copied collections' unsaved changes", async () => {
    mocks.loadAppRecords.mockResolvedValue(serverRecords());
    // Only the instruments have a copy (with an edit not yet saved); the rest have none.
    mocks.readCache.mockResolvedValue({
      tools: {
        items: [{id: 't1', name: 'Edited here'}],
        changed: ['t1'],
        removed: [],
        since: '2026-10-01T08:00:00.000Z',
        deletedSince: '2026-10-01T08:00:00.000Z',
        savedAt: Date.now(),
        version: 1,
        expired: false,
      },
    });
    let workspace: CloudWorkspace | null = null;
    render(
      <CloudWorkspaceGate>
        {ws => {
          workspace = ws;
          return null;
        }}
      </CloudWorkspaceGate>,
    );
    await waitFor(() => expect(workspace).not.toBeNull());
    const records = workspace!.records as unknown as Record<string, Array<{id: string; name?: string}>>;
    expect(mocks.loadAppRecords).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({onProgress: expect.any(Function)}),
    );
    expect(records.tools).toEqual([{id: 't1', name: 'Edited here'}]);
    expect(records.sets).toEqual([{id: 's1', name: 'Server set'}]);
    const [organizationId, restored] = mocks.setRestored.mock.calls[0];
    expect(organizationId).toBe('org-1');
    expect(Object.keys(restored)).toEqual(['tools']);
    expect(restored.tools).toMatchObject({changed: ['t1'], items: [{id: 't1', name: 'Edited here'}]});
  });

  it('opens a reset Demo from the server and fills it, whatever this device kept from before the reset', async () => {
    mocks.org = {name: 'SurgiTrack Demo', is_demo: true, evaluation: false, plan: 'STANDARD', trial_ends_at: null};
    mocks.dataMode = 'DEMO';
    mocks.setRestored.mockClear();
    // A full copy from before the reset (settings and all), while the server is empty.
    const fresh = {
      changed: [],
      removed: [],
      since: '',
      deletedSince: '',
      savedAt: Date.now(),
      version: 1,
      expired: false,
    };
    mocks.readCache.mockResolvedValue(
      Object.fromEntries([...STORE_COLLECTIONS, 'library'].map(c => [c, {...fresh, items: [{id: `old-${c}`}]}])),
    );
    const empty = Object.fromEntries([...STORE_COLLECTIONS, 'library'].map(c => [c, []]));
    mocks.loadAppRecords.mockReset();
    mocks.loadAppRecords.mockResolvedValueOnce(empty).mockResolvedValue(serverRecords());
    let workspace: CloudWorkspace | null = null;
    render(
      <CloudWorkspaceGate>
        {ws => {
          workspace = ws;
          return null;
        }}
      </CloudWorkspaceGate>,
    );
    await waitFor(() => expect(workspace).not.toBeNull());
    expect(mocks.seedDemoOrganization).toHaveBeenCalledWith('org-1', expect.anything());
    const records = workspace!.records as unknown as Record<string, Array<{id: string}>>;
    expect(records.sets).toEqual([{id: 's1', name: 'Server set'}]);
  });

  describe('the modules the platform owner gave the hospital', () => {
    const Probe = () => {
      const replacements = useHasModule('REPLACEMENTS');
      const minimums = useHasModule('STOCK_MINIMUMS');
      return <p data-testid="modules">{`${replacements}|${minimums}`}</p>;
    };
    const open = async (org: Record<string, unknown>) => {
      mocks.org = {
        name: 'Test Hospital',
        is_demo: false,
        evaluation: false,
        plan: 'STANDARD',
        trial_ends_at: null,
        ...org,
      };
      mocks.dataMode = 'PRODUCTION';
      mocks.readCache.mockResolvedValue({});
      mocks.loadAppRecords.mockReset();
      mocks.loadAppRecords.mockResolvedValue(serverRecords());
      render(<CloudWorkspaceGate>{() => <Probe />}</CloudWorkspaceGate>);
      return (await screen.findByTestId('modules')).textContent;
    };

    it('shows only the ones it was given', async () => {
      expect(await open({modules: ['STOCK_MINIMUMS']})).toBe('false|true');
    });

    it('shows none when none were given, and every one when the hospital does not say', async () => {
      expect(await open({modules: []})).toBe('false|false');
      cleanup();
      expect(await open({})).toBe('true|true');
    });
  });
});
