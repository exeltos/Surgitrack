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

  it('sends an instrument marked not used without taking a life, and without asking for a patient code', () => {
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const tool = result.current.tools.find(
      t => t.maxUses && t.mode !== 'SET_MEMBER' && t.uses < t.maxUses && t.state === 'IN_DEPARTMENT',
    )!;
    expect(tool).toBeTruthy();
    let sent = false;
    act(() => {
      sent = result.current.sendToSterilization('TOOL', tool.id, undefined, undefined, [tool.id]);
    });
    expect(sent).toBe(true);
    const after = result.current.tools.find(t => t.id === tool.id)!;
    expect(after.uses).toBe(tool.uses);
    expect(after.state).toBe('PENDING_STERILIZATION');
  });

  it('keeps lives read-only for users without the usage permission', () => {
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const tool = result.current.tools.find(t => t.maxUses)!;
    act(() => result.current.updateTool(tool.id, {maxUses: 999}));
    expect(result.current.tools.find(t => t.id === tool.id)!.maxUses).toBe(tool.maxUses);
  });

  it('lets a usage-limit manager correct the uses by one, recorded, and nobody else', () => {
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const tool = result.current.tools.find(t => t.maxUses && t.uses > 0 && t.state !== 'RETIRED')!;
    act(() => result.current.correctUses('TOOL', tool.id, -1));
    expect(result.current.tools.find(t => t.id === tool.id)!.uses).toBe(tool.uses);

    sessionStorage.setItem('surgitrack-demo-role', 'ADMIN');
    const admin = renderHook(() => useSurgi(), {wrapper}).result;
    act(() => admin.current.correctUses('TOOL', tool.id, -1));
    expect(admin.current.tools.find(t => t.id === tool.id)!.uses).toBe(tool.uses - 1);
    expect(admin.current.movements[0].status).toContain(`Διόρθωση χρήσεων · ${tool.uses} → ${tool.uses - 1}`);
  });

  it('counts the uses of an instrument with a wear check without a limit, never takes it out of use, and lets the admin add uses', () => {
    sessionStorage.setItem('surgitrack-demo-role', 'ADMIN');
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const tool = result.current.tools.find(t => !t.maxUses && t.mode !== 'SET_MEMBER' && t.state === 'IN_DEPARTMENT')!;
    expect(tool).toBeTruthy();
    // Set to a wear check (no limit): the uses may now be added by hand, with no upper limit.
    act(() => result.current.configureUsageLimit('TOOL', tool.id, undefined, true));
    expect(result.current.tools.find(t => t.id === tool.id)!.wearCheck).toBe(true);
    act(() => result.current.recordUsage('TOOL', tool.id, {uses: 120}));
    expect(result.current.tools.find(t => t.id === tool.id)!.uses).toBe(120);

    // A use is counted on dispatch (with a patient code), and the instrument stays in use however high it goes.
    expect(result.current.sendToSterilization('TOOL', tool.id)).toBe(false);
    act(() => {
      result.current.sendToSterilization('TOOL', tool.id, 'PT-9');
    });
    const after = result.current.tools.find(t => t.id === tool.id)!;
    expect(after.uses).toBe(121);
    expect(after.state).toBe('PENDING_STERILIZATION');
    expect(result.current.retiredTools.some(t => t.id === tool.id)).toBe(false);

    // A limit replaces the wear check.
    act(() => result.current.configureUsageLimit('TOOL', tool.id, 200, true));
    const limited = result.current.tools.find(t => t.id === tool.id)!;
    expect(limited.maxUses).toBe(200);
    expect(limited.wearCheck).toBeUndefined();
  });
});
