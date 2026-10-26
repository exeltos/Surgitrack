import {describe, expect, it} from 'vitest';
import {latestUndoable, membersUnchanged, undoneIds, undoPermission, type UndoSnapshot} from '../movementUndo';
import type {Tool} from '../../types/domain';
import type {Movement} from '../../types/domain';

const snapshot = (action: UndoSnapshot['action'], after: UndoSnapshot['after'], usesCounted = false): UndoSnapshot => ({
  action,
  kind: 'TOOL',
  id: 't1',
  after,
  usesCounted,
  assets: [{kind: 'TOOL', id: 't1', before: {state: 'IN_DEPARTMENT'}}],
});
const move = (over: Partial<Movement>): Movement => ({
  id: 'm1',
  asset: 'T001 · Λαβίδα',
  assetKind: 'TOOL',
  from: 'Χειρουργείο',
  to: 'Κεντρική Αποστείρωση',
  status: 'Φυσική παραλαβή',
  at: '26/10/2026 09:00',
  by: 'Άννα · παρέδωσε Νίκος',
  ...over,
});
const ster = {role: 'STERILIZATION', manager: false, userId: 'u-anna', name: 'Άννα', department: 'Αποστείρωση'};

describe('undoing a movement', () => {
  it('takes the latest movement, leaving out undo entries, undone ones and their consequences', () => {
    const dispatch = move({id: 'm1', at: '26/10/2026 09:00', undo: snapshot('DISPATCH', 'PENDING_STERILIZATION')});
    const outOfUse = move({id: 'm2', at: '26/10/2026 09:00', causedBy: 'm1'});
    expect(latestUndoable([outOfUse, dispatch], 'T001')?.id).toBe('m1');
    const undo = move({id: 'm3', at: '26/10/2026 09:05', undoes: 'm1'});
    expect(latestUndoable([undo, outOfUse, dispatch], 'T001')).toBeUndefined();
    expect([...undoneIds([undo, outOfUse, dispatch])].sort()).toEqual(['m1', 'm2']);
  });

  it('lets a Sterilization user undo only their own receipt of the same day', () => {
    const receipt = move({undo: snapshot('RECEIPT', 'IN_WASHING')});
    const asset = {state: 'IN_WASHING'};
    expect(undoPermission(receipt, asset, ster, new Date(2026, 9, 26, 12)).ok).toBe(true);
    expect(undoPermission(receipt, asset, ster, new Date(2026, 9, 27, 12))).toEqual({ok: false, reason: 'NOT_TODAY'});
    expect(undoPermission(receipt, asset, {...ster, userId: 'u-x', name: 'Μαρία'}, new Date(2026, 9, 26))).toEqual({
      ok: false,
      reason: 'NOT_OWN',
    });
    expect(undoPermission(receipt, asset, {...ster, manager: true}, new Date(2027, 0, 1)).ok).toBe(true);
    expect(undoPermission(receipt, {state: 'IN_PREPARATION'}, {...ster, manager: true})).toEqual({
      ok: false,
      reason: 'MOVED_ON',
    });
  });

  it('lets a department cancel only its own dispatch with no use counted', () => {
    const dept = {role: 'DEPARTMENT', manager: false, userId: 'u-d', name: 'Ελένη', department: 'Χειρουργείο'};
    const asset = {state: 'PENDING_STERILIZATION', department: 'Χειρουργείο'};
    expect(undoPermission(move({undo: snapshot('DISPATCH', 'PENDING_STERILIZATION')}), asset, dept).ok).toBe(true);
    expect(undoPermission(move({undo: snapshot('DISPATCH', 'PENDING_STERILIZATION', true)}), asset, dept)).toEqual({
      ok: false,
      reason: 'USE_COUNTED',
    });
    expect(
      undoPermission(move({undo: snapshot('DISPATCH', 'PENDING_STERILIZATION')}), {...asset, department: 'ΤΕΠ'}, dept),
    ).toEqual({ok: false, reason: 'NOT_OWN'});
  });

  it('refuses a Set whose instruments changed since the movement', () => {
    const set: UndoSnapshot = {
      action: 'RECEIPT',
      kind: 'SET',
      id: 's1',
      after: 'IN_WASHING',
      usesCounted: false,
      assets: [
        {kind: 'SET', id: 's1', before: {state: 'PENDING_STERILIZATION'}},
        {kind: 'TOOL', id: 'a', before: {state: 'PENDING_STERILIZATION', setId: 's1', mode: 'SET_MEMBER'}},
      ],
    };
    const tool = (over: Partial<Tool>) =>
      ({id: 'a', setId: 's1', mode: 'SET_MEMBER', state: 'IN_WASHING', ...over}) as Tool;
    expect(membersUnchanged(set, [tool({})])).toBe(true);
    // Replaced: the old one left for Service, a new one joined.
    expect(
      membersUnchanged(set, [tool({setId: undefined, mode: 'STANDALONE', state: 'SERVICE'}), tool({id: 'b'})]),
    ).toBe(false);
    expect(membersUnchanged(set, [tool({}), tool({id: 'b'})])).toBe(false);
  });

  it('lets a department cancel its own older dispatch, but no other older movement', () => {
    const dept = {role: 'DEPARTMENT', manager: false, userId: 'u-d', name: 'Ελένη', department: 'ΜΕΘ'};
    const asset = {state: 'PENDING_STERILIZATION', department: 'ΜΕΘ'};
    const legacy = (action: UndoSnapshot['action'], after: UndoSnapshot['after']) => ({
      ...snapshot(action, after),
      legacy: true,
    });
    const m = move({});
    expect(undoPermission(m, asset, dept, new Date(), legacy('DISPATCH', 'PENDING_STERILIZATION')).ok).toBe(true);
    expect(
      undoPermission(
        m,
        {state: 'IN_DEPARTMENT', department: 'ΜΕΘ'},
        dept,
        new Date(),
        legacy('DELIVERY', 'IN_DEPARTMENT'),
      ),
    ).toEqual({
      ok: false,
      reason: 'NO_RIGHT',
    });
    expect(undoPermission(m, {state: 'IN_WASHING'}, ster, new Date(), legacy('RECEIPT', 'IN_WASHING'))).toEqual({
      ok: false,
      reason: 'NO_RIGHT',
    });
  });
});
