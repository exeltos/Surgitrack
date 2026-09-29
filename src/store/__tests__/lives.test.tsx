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

describe('instrument lives', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-demo-role', 'DEPARTMENT');
  });

  it('needs a patient code, takes one life per dispatch and takes the tool out of use at zero', () => {
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const tool = result.current.tools.find(t => t.maxUses && t.mode !== 'SET_MEMBER' && t.uses < t.maxUses)!;
    expect(tool).toBeTruthy();

    act(() => result.current.sendToSterilization('TOOL', tool.id));
    expect(result.current.tools.find(t => t.id === tool.id)!.uses).toBe(tool.uses);

    const left = tool.maxUses! - tool.uses;
    for (let i = 0; i < left; i++) act(() => result.current.sendToSterilization('TOOL', tool.id, 'PT-1'));

    expect(result.current.tools.some(t => t.id === tool.id)).toBe(false);
    const retired = result.current.retiredTools.find(t => t.id === tool.id)!;
    expect(retired.state).toBe('RETIRED');
    expect(retired.uses).toBe(tool.maxUses);
    expect(retired.retiredReason).toBe('Συμπλήρωση ορίου χρήσεων');

    act(() => result.current.acknowledgeOutOfUse(tool.id));
    expect(result.current.retiredTools.find(t => t.id === tool.id)!.retiredNoticeSeenAt).toBeTruthy();
  });

  it('keeps lives read-only for users without the usage permission', () => {
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const tool = result.current.tools.find(t => t.maxUses)!;
    act(() => result.current.updateTool(tool.id, {maxUses: 999}));
    expect(result.current.tools.find(t => t.id === tool.id)!.maxUses).toBe(tool.maxUses);
  });
});
