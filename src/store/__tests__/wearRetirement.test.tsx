import type {ReactNode} from 'react';
import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import {LibraryStoreProvider} from '../../core/LibraryStore';
import {SurgiProvider, useSurgi} from '../SurgiStore';

const wrapper = ({children}: {children: ReactNode}) => (
  <LibraryStoreProvider>
    <SurgiProvider dataMode="DEMO">{children}</SurgiProvider>
  </LibraryStoreProvider>
);

describe('an instrument counted until wear, reported worn', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-demo-role', 'STERILIZATION');
  });

  it('Sterilization retires it after the check: out of use and out of its Set, its reports closed', () => {
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const tool = result.current.tools.find(t => t.setId && t.state !== 'IN_WASHING' && t.state !== 'IN_STERILIZATION')!;
    const setBefore = result.current.sets.find(s => s.id === tool.setId)!.actual;
    act(() => result.current.reportIssue(tool.id, 'Φθορά', 'Δεν κόβει'));
    act(() => result.current.retireForWear(tool.id, 'Φθαρμένη λάμα'));
    const after = result.current.retiredTools.find(t => t.id === tool.id)!;
    expect(after.state).toBe('RETIRED');
    expect(after.setId).toBeUndefined();
    expect(after.retiredReason).toContain('Φθαρμένη λάμα');
    expect(result.current.sets.find(s => s.id === tool.setId)!.actual).toBe(Math.max(0, setBefore - 1));
    expect(result.current.issues.some(i => i.status === 'OPEN' && i.asset.startsWith(tool.barcode))).toBe(false);
  });
});
