import type {ReactNode} from 'react';
import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import {LibraryStoreProvider} from '../../core/LibraryStore';
import {SurgiProvider, useSurgi} from '../SurgiStore';
import type {SessionUser} from '../types';

const wrapperFor =
  (dataMode: 'DEMO' | 'PRODUCTION') =>
  ({children}: {children: ReactNode}) => (
    <LibraryStoreProvider>
      <SurgiProvider dataMode={dataMode}>{children}</SurgiProvider>
    </LibraryStoreProvider>
  );

const real: SessionUser = {
  id: 'real-ster-3',
  name: 'Νίκος Γεωργίου',
  role: 'STERILIZATION',
  department: 'Κεντρική Αποστείρωση',
  supervisor: true,
};

describe('session user', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('outside Demo, nobody is signed in (and nothing is permitted) until the real user is set', () => {
    const {result} = renderHook(() => useSurgi(), {wrapper: wrapperFor('PRODUCTION')});
    expect(result.current.sessionReady).toBe(false);
    expect(result.current.currentUser.id).toBe('');
    expect(result.current.currentUser.name).not.toMatch(/Demo/);
    expect(result.current.permissions).toEqual([]);
    expect(result.current.can('sterilization.workspace')).toBe(false);
  });

  it('switches to the real user even when their role equals the starting role', () => {
    const {result} = renderHook(() => useSurgi(), {wrapper: wrapperFor('PRODUCTION')});
    expect(result.current.role).toBe('STERILIZATION');
    act(() => result.current.setSessionUser(real));
    expect(result.current.sessionReady).toBe(true);
    expect(result.current.currentUser).toEqual(real);
    expect(result.current.can('asset.create')).toBe(true);
  });

  it('stamps records with the real user, not a demo identity', () => {
    sessionStorage.setItem('surgitrack-demo-role', 'STERILIZATION');
    const {result} = renderHook(() => useSurgi(), {wrapper: wrapperFor('DEMO')});
    act(() => result.current.setSessionUser(real));
    const tool = result.current.tools.find(t => t.mode === 'STANDALONE' && t.state !== 'RETIRED')!;
    act(() => result.current.markLost('TOOL', tool.id, 'test'));
    const latest = result.current.movements[0];
    expect(latest.by).toBe(real.name);
  });

  it('starts from the user stored for this tab, so a reload keeps the identity', () => {
    sessionStorage.setItem('surgitrack-demo-role', 'STERILIZATION');
    sessionStorage.setItem('surgitrack-session-user', JSON.stringify(real));
    const {result} = renderHook(() => useSurgi(), {wrapper: wrapperFor('PRODUCTION')});
    expect(result.current.sessionReady).toBe(true);
    expect(result.current.currentUser.id).toBe(real.id);
  });

  it('keeps the built-in stand-in identities in Demo only', () => {
    const {result} = renderHook(() => useSurgi(), {wrapper: wrapperFor('DEMO')});
    expect(result.current.sessionReady).toBe(true);
    expect(result.current.currentUser.id).toBe('u-ster-01');
  });
});
