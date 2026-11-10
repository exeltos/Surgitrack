import type {ReactNode} from 'react';
import {act, renderHook, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {EquipmentStatus} from '../../data/cloud/equipmentStatus';
import type {CloudWorkspace} from '../../data/cloud/CloudWorkspaceGate';

const db = vi.hoisted(() => ({
  rows: [] as EquipmentStatus[],
  saved: [] as Array<{organizationId: string; name: string; patch: unknown}>,
  fail: false,
}));
vi.mock('../../data/cloud/equipmentStatus', () => ({
  loadEquipmentStatus: async () => db.rows,
  saveEquipmentStatus: async (organizationId: string, name: string, patch: unknown) => {
    if (db.fail) throw new Error('refused');
    db.saved.push({organizationId, name, patch});
  },
}));
// The library itself is not synced here.
vi.mock('../../data/cloud/useAppRecordSync', () => ({useAppRecordSync: () => undefined}));
const {LibraryStoreProvider, useLibraries} = await import('../LibraryStore');

const cloud = {
  organizationId: 'org-1',
  organizationName: 'Νοσοκομείο',
  records: {library: []},
} as unknown as CloudWorkspace;
const wrapper = ({children}: {children: ReactNode}) => (
  <LibraryStoreProvider dataMode="DEMO" cloud={cloud}>
    {children}
  </LibraryStoreProvider>
);
const outOfService = {reason: 'BREAKDOWN' as const, since: '10/11/2026 08:00', by: 'Τ'};

describe('the equipment status of a hospital', () => {
  beforeEach(() => {
    db.rows = [];
    db.saved = [];
    db.fail = false;
    localStorage.clear();
  });

  it('is read from the equipment table and shown on the sterilizers by name', async () => {
    const {result} = renderHook(() => useLibraries(), {wrapper});
    const first = result.current.sterilizers[0];
    db.rows = [{name: first.el, outOfService, tests: []}];
    // Another refresh (focus back on the page) picks it up.
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(result.current.sterilizers[0].outOfService).toEqual(outOfService));
    expect(result.current.sterilizers[1].outOfService).toBeUndefined();
  });

  it('is saved to the equipment table, not the library, so Sterilization staff can write it', async () => {
    const {result} = renderHook(() => useLibraries(), {wrapper});
    const first = result.current.sterilizers[0];
    await act(() => result.current.updateEquipment('sterilizers', first.id, {outOfService}));
    expect(db.saved).toEqual([{organizationId: 'org-1', name: first.el, patch: {outOfService}}]);
    expect(result.current.sterilizers[0].outOfService).toEqual(outOfService);
    await act(() => result.current.updateEquipment('sterilizers', first.id, {outOfService: null}));
    expect(result.current.sterilizers[0].outOfService).toBeUndefined();
  });

  it('says so when it could not be saved, and changes nothing', async () => {
    const {result} = renderHook(() => useLibraries(), {wrapper});
    const first = result.current.sterilizers[0];
    db.fail = true;
    await expect(act(() => result.current.updateEquipment('sterilizers', first.id, {outOfService}))).rejects.toThrow(
      'refused',
    );
    expect(result.current.sterilizers[0].outOfService).toBeUndefined();
  });
});
