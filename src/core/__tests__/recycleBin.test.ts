import {describe, expect, it} from 'vitest';
import {BIN_DAYS, binEntryForSet, binEntryForTool, daysLeft, isExpired, planRestore} from '../recycleBin';
import type {SetAsset, Tool} from '../../types/domain';

const tool = (id: string, patch: Partial<Tool> = {}): Tool => ({
  id,
  barcode: `T${id}`,
  code: 'X',
  name: `ΕΡΓΑΛΕΙΟ ${id}`,
  specialty: '',
  mode: 'SET_MEMBER',
  setId: 's1',
  department: 'Χειρουργείο',
  state: 'IN_DEPARTMENT',
  uses: 0,
  sterilizations: 0,
  ...patch,
});
const set = (patch: Partial<SetAsset> = {}) =>
  ({
    id: 's1',
    barcode: 'S1',
    name: 'ΒΑΣΙΚΟ',
    department: 'Χειρουργείο',
    state: 'IN_DEPARTMENT',
    expected: 2,
    actual: 2,
    ...patch,
  }) as SetAsset;

describe('recycle bin', () => {
  it('keeps an entry for 30 days', () => {
    const entry = binEntryForTool(tool('1'), undefined, 'Μαρία', new Date('2026-10-01T10:00:00Z'));
    expect(BIN_DAYS).toBe(30);
    expect(daysLeft(entry, new Date('2026-10-01T10:00:00Z'))).toBe(30);
    expect(isExpired(entry, new Date('2026-10-30T10:00:00Z'))).toBe(false);
    expect(isExpired(entry, new Date('2026-10-31T10:00:00Z'))).toBe(true);
    expect(daysLeft(entry, new Date('2026-12-01T00:00:00Z'))).toBe(0);
  });

  it('puts a deleted instrument back into its Set, or into Stock when the Set is gone', () => {
    const entry = binEntryForTool(tool('1'), set(), 'Μαρία');
    const inSet = planRestore(entry, {sets: [set({actual: 1, state: 'IN_STERILIZATION'})], tools: []});
    expect(inSet).toMatchObject({ok: true, setCountDelta: {setId: 's1', delta: 1}});
    expect(inSet.ok && inSet.add[0]).toMatchObject({mode: 'SET_MEMBER', setId: 's1', state: 'IN_STERILIZATION'});
    const alone = planRestore(entry, {sets: [], tools: []});
    expect(alone.ok && alone.add[0]).toMatchObject({mode: 'STOCK', state: 'IN_STOCK', setId: undefined});
  });

  it('refuses to overwrite an instrument or Set that exists', () => {
    const entry = binEntryForTool(tool('1'), undefined, 'Μαρία');
    expect(planRestore(entry, {sets: [], tools: [tool('9', {barcode: 't1'})]})).toMatchObject({
      ok: false,
      reason: 'TOOL_EXISTS',
    });
    const setEntry = binEntryForSet(set(), [], true, 'Μαρία');
    expect(planRestore(setEntry, {sets: [set()], tools: []})).toMatchObject({ok: false, reason: 'SET_EXISTS'});
  });

  it('restores a Set with the instruments deleted with it, skipping any whose barcode is now used', () => {
    const members = [tool('1'), tool('2')];
    const entry = binEntryForSet(set(), members, true, 'Μαρία');
    const plan = planRestore(entry, {sets: [], tools: [tool('7', {barcode: 'T2'})]});
    expect(plan).toMatchObject({ok: true, skipped: ['T2']});
    expect(plan.ok && plan.add.map(t => t.id)).toEqual(['1']);
    expect(plan.ok && plan.set?.actual).toBe(1);
  });

  it('restores a Set whose instruments went to Stock only for those still idle there', () => {
    const members = [tool('1'), tool('2'), tool('3')];
    const entry = binEntryForSet(set(), members, false, 'Μαρία');
    const idle = (id: string) => tool(id, {mode: 'STOCK', setId: undefined, state: 'IN_STOCK', department: undefined});
    const plan = planRestore(entry, {
      sets: [],
      tools: [idle('1'), tool('2', {mode: 'SET_MEMBER', setId: 's9'}), idle('3')].filter(t => t.id !== '3'),
    });
    expect(plan.ok && plan.revert.map(t => t.id)).toEqual(['1']);
    expect(plan).toMatchObject({ok: true, skipped: ['T2', 'T3']});
    expect(plan.ok && plan.set?.actual).toBe(1);
  });
});
