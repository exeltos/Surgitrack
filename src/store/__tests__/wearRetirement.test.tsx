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

describe('a deleted report put back from the bin', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-demo-role', 'ADMIN');
  });

  it('comes back as it was, without naming the admin as its writer', () => {
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const old = result.current.issues.find(i => !i.reportedBy)!;
    act(() => result.current.deleteIssue(old.id, 'Διπλή'));
    const entry = result.current.recycleBin.find(e => e.kind === 'ISSUE')!;
    act(() => {
      result.current.restoreFromBin(entry.id);
    });
    expect(result.current.issues.find(i => i.id === old.id)?.reportedBy).toBeUndefined();
  });
});

describe('correcting a report', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('the hospital admin corrects its text, and the correction is signed', () => {
    sessionStorage.setItem('surgitrack-demo-role', 'ADMIN');
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const issue = result.current.issues[0];
    act(() => result.current.editIssueNote(issue.id, 'Ελέγχθηκε και τέθηκε σε χρήση ξανά.'));
    const after = result.current.issues.find(i => i.id === issue.id)!;
    expect(after.note).toBe('Ελέγχθηκε και τέθηκε σε χρήση ξανά.');
    expect(after.editedBy).toBeTruthy();
  });

  it('Sterilization staff cannot', () => {
    sessionStorage.setItem('surgitrack-demo-role', 'STERILIZATION');
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const issue = result.current.issues[0];
    act(() => result.current.editIssueNote(issue.id, 'Άλλο'));
    expect(result.current.issues.find(i => i.id === issue.id)!.note).toBe(issue.note);
  });
});

describe('retiring during a process', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-demo-role', 'STERILIZATION');
  });

  it('is refused while awaiting release, so a release cannot put it back into use', () => {
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const busy = result.current.tools.find(t =>
      ['AWAITING_RELEASE', 'IN_STERILIZATION', 'IN_PACKAGING', 'IN_STORAGE'].includes(t.state),
    )!;
    act(() => result.current.retireForWear(busy.id, 'Δεν κόβει'));
    expect(result.current.tools.find(t => t.id === busy.id)!.state).toBe(busy.state);
  });
});
