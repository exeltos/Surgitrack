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
const deliverer = {deliveredByUserId: 'u-dept', deliveredByName: 'ΝΟΣΗΛΕΥΤΗΣ ΤΕΣΤ', deliveredByDepartment: 'Τμήμα'};
const receiver = {receivedByUserId: 'u-dept', receivedByName: 'ΝΟΣΗΛΕΥΤΗΣ ΤΕΣΤ', receivedByDepartment: 'Τμήμα'};

const asRole = (role: string) => {
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem('surgitrack-demo-role', role);
  const {result} = renderHook(() => useSurgi(), {wrapper});
  return () => result.current;
};

describe('undoing a movement made by mistake', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('lets the department cancel its own dispatch, putting it back as it was, sterile dates included', () => {
    const s = asRole('DEPARTMENT');
    const dept = s().currentUser.department;
    const tool = s().tools.find(t => t.department === dept && t.mode === 'STANDALONE' && t.state === 'IN_DEPARTMENT')!;
    expect(tool).toBeTruthy();
    // Marked not used: no use is counted.
    act(() => void s().sendToSterilization('TOOL', tool.id, undefined, undefined, [tool.id]));
    expect(s().tools.find(t => t.id === tool.id)!.state).toBe('PENDING_STERILIZATION');
    expect(s().tools.find(t => t.id === tool.id)!.sterileUntil).toBeUndefined();

    const info = s().undoInfo('TOOL', tool.id)!;
    expect(info.ok).toBe(true);
    expect(info.movement.undo?.action).toBe('DISPATCH');
    expect(s().undoMovement('TOOL', tool.id, '')).toBe(false);

    act(() => void s().undoMovement('TOOL', tool.id, 'λάθος σάρωση'));
    const back = s().tools.find(t => t.id === tool.id)!;
    expect(back.state).toBe('IN_DEPARTMENT');
    expect(back.sterileUntil).toBe(tool.sterileUntil);
    const undoEntry = s().movements.find(m => m.undoes === info.movement.id)!;
    expect(undoEntry.note).toBe('λάθος σάρωση');
    expect(undoEntry.status).toMatch(/^Αναίρεση: /);
    // The dispatch stays in the history; it cannot be undone twice.
    expect(s().movements.some(m => m.id === info.movement.id)).toBe(true);
    expect(s().undoInfo('TOOL', tool.id)?.movement.id).not.toBe(info.movement.id);
  });

  it('cancels a Set sent with its limited-use instruments marked not used', () => {
    const s = asRole('ADMIN');
    const set = s().sets.find(x => x.state === 'IN_DEPARTMENT' && !x.maxUses)!;
    expect(set).toBeTruthy();
    const limited = s()
      .tools.filter(t => t.setId === set.id && t.maxUses)
      .map(t => t.id);
    act(() => void s().sendToSterilization('SET', set.id, undefined, undefined, limited));
    expect(s().undoInfo('SET', set.id)?.movement.undo?.usesCounted).toBe(false);
    act(() => void s().undoMovement('SET', set.id, 'λάθος σάρωση'));
    expect(s().sets.find(x => x.id === set.id)!.state).toBe('IN_DEPARTMENT');
    expect(
      s()
        .tools.filter(t => t.setId === set.id)
        .every(t => t.state === 'IN_DEPARTMENT'),
    ).toBe(true);
  });

  it('keeps a dispatch that counted a use for the supervisor or the admin', () => {
    const s = asRole('DEPARTMENT');
    const dept = s().currentUser.department;
    const tool = s().tools.find(
      t => t.department === dept && t.mode === 'STANDALONE' && t.state === 'IN_DEPARTMENT' && t.maxUses,
    );
    if (!tool) return;
    act(() => void s().sendToSterilization('TOOL', tool.id, 'PT-1'));
    const info = s().undoInfo('TOOL', tool.id)!;
    expect(info.ok).toBe(false);
    expect(!info.ok && info.reason).toBe('USE_COUNTED');
  });

  it('lets the admin undo a dispatch that took an instrument out of use at its limit', () => {
    const s = asRole('ADMIN');
    const tool = s().tools.find(t => t.mode === 'STANDALONE' && t.state === 'IN_DEPARTMENT' && t.maxUses)!;
    expect(tool).toBeTruthy();
    // One use left: this dispatch reaches the limit.
    for (let i = tool.uses; i < tool.maxUses! - 1; i++) act(() => s().correctUses('TOOL', tool.id, 1));
    expect(s().tools.find(t => t.id === tool.id)!.uses).toBe(tool.maxUses! - 1);
    act(() => void s().sendToSterilization('TOOL', tool.id, 'PT-1'));
    expect(s().retiredTools.some(t => t.id === tool.id)).toBe(true);

    act(() => void s().undoMovement('TOOL', tool.id, 'λάθος εργαλείο'));
    const back = s().tools.find(t => t.id === tool.id)!;
    expect(back.state).toBe('IN_DEPARTMENT');
    expect(back.uses).toBe(tool.maxUses! - 1);
    expect(back.retiredAt).toBeUndefined();
  });

  it('lets Sterilization undo its own receipt and delivery of the day, one step at a time', () => {
    const s = asRole('STERILIZATION');
    const tool = s().tools.find(t => t.mode === 'STANDALONE' && t.state === 'IN_DEPARTMENT' && !t.maxUses)!;
    act(() => void s().sendToSterilization('TOOL', tool.id));
    act(() => void s().receiveAtSterilization('TOOL', tool.id, deliverer));
    expect(s().tools.find(t => t.id === tool.id)!.state).toBe('IN_WASHING');

    const info = s().undoInfo('TOOL', tool.id)!;
    expect(info.movement.undo?.action).toBe('RECEIPT');
    expect(info.ok).toBe(true);
    const receiptId = info.movement.undo?.recordId;
    expect(s().receipts.some(r => r.id === receiptId)).toBe(true);
    act(() => void s().undoMovement('TOOL', tool.id, 'λάθος παραλαβή'));
    expect(s().tools.find(t => t.id === tool.id)!.state).toBe('PENDING_STERILIZATION');
    // The receipt stays recorded but no longer counts as done.
    expect(s().receipts.some(r => r.id === receiptId)).toBe(false);
    // The dispatch before it was the department's.
    const dispatch = s().undoInfo('TOOL', tool.id)!;
    expect(dispatch.movement.undo?.action).toBe('DISPATCH');
    expect(!dispatch.ok && dispatch.reason).toBe('NOT_OWN');

    const ready = s().tools.find(t => t.mode === 'STANDALONE' && t.state === 'READY_FOR_PICKUP');
    if (!ready) return;
    act(() => void s().completeDeliveryToDepartment('TOOL', ready.id, receiver));
    expect(s().tools.find(t => t.id === ready.id)!.state).toBe('IN_DEPARTMENT');
    act(() => void s().undoMovement('TOOL', ready.id, 'λάθος τμήμα'));
    const back = s().tools.find(t => t.id === ready.id)!;
    expect(back.state).toBe('READY_FOR_PICKUP');
    expect(back.sterileUntil).toBe(ready.sterileUntil);
  });

  it('does not undo a movement once the Set or instrument has moved on', () => {
    const s = asRole('ADMIN');
    const tool = s().tools.find(t => t.mode === 'STANDALONE' && t.state === 'IN_DEPARTMENT' && !t.maxUses)!;
    act(() => void s().sendToSterilization('TOOL', tool.id));
    // Moved on without a movement of its own (e.g. a stage changed elsewhere).
    act(() => s().updateTool(tool.id, {state: 'IN_WASHING'}));
    const info = s().undoInfo('TOOL', tool.id);
    expect(!info || (!info.ok && info.reason === 'MOVED_ON')).toBe(true);
    expect(s().undoMovement('TOOL', tool.id, 'λάθος')).toBe(false);
  });
});
