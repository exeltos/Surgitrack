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

describe('recycle bin', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-demo-role', 'STERILIZATION');
  });

  it('keeps a deleted instrument and puts it back into its Set', () => {
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const tool = result.current.tools.find(t => t.setId)!;
    const set = result.current.sets.find(s => s.id === tool.setId)!;
    act(() => result.current.deleteTool(tool.id));
    expect(result.current.tools.some(t => t.id === tool.id)).toBe(false);
    expect(result.current.recycleBin).toHaveLength(1);
    const after = result.current.sets.find(s => s.id === set.id)!;
    expect(after.actual).toBe(set.actual - 1);

    let ok = false;
    act(() => {
      ok = result.current.restoreFromBin(result.current.recycleBin[0].id);
    });
    expect(ok).toBe(true);
    expect(result.current.recycleBin).toHaveLength(0);
    const back = result.current.tools.find(t => t.id === tool.id)!;
    expect(back.setId).toBe(set.id);
    expect(result.current.sets.find(s => s.id === set.id)!.actual).toBe(set.actual);
  });

  it('restores a deleted Set with the instruments deleted with it', () => {
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const set = result.current.sets.find(s => result.current.tools.some(t => t.setId === s.id))!;
    const members = result.current.tools.filter(t => t.setId === set.id).map(t => t.id);
    act(() => result.current.deleteSet(set.id, true));
    expect(result.current.sets.some(s => s.id === set.id)).toBe(false);
    expect(result.current.tools.some(t => members.includes(t.id))).toBe(false);

    act(() => {
      result.current.restoreFromBin(result.current.recycleBin[0].id);
    });
    expect(result.current.sets.some(s => s.id === set.id)).toBe(true);
    expect(members.every(id => result.current.tools.some(t => t.id === id && t.setId === set.id))).toBe(true);
    expect(result.current.sets.find(s => s.id === set.id)!.actual).toBe(members.length);
    expect(result.current.recycleBin).toHaveLength(0);
  });

  it('deletes an entry for good', () => {
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const tool = result.current.tools[0];
    act(() => result.current.deleteTool(tool.id));
    act(() => result.current.purgeFromBin(result.current.recycleBin[0].id));
    expect(result.current.recycleBin).toHaveLength(0);
  });
});
