import type {ReactNode} from 'react';
import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import {LibraryStoreProvider} from '../../core/LibraryStore';
import {SurgiProvider, useSurgi} from '../SurgiStore';
import {defaultSterilizationWorkflow} from '../../core/workflow';
import {returnTargets} from '../../core/stageReturn';

const wrapper = ({children}: {children: ReactNode}) => (
  <LibraryStoreProvider>
    <SurgiProvider dataMode="DEMO">{children}</SurgiProvider>
  </LibraryStoreProvider>
);

const stages = defaultSterilizationWorkflow.stages;

describe('returnTargets', () => {
  it('offers every enabled earlier stage, nearest first, never the release', () => {
    expect(returnTargets(stages, 'READY_FOR_PICKUP').map(t => t.id)).toEqual([
      'STERILIZATION',
      'PACKAGING',
      'PREPARATION',
      'WASHING',
      'RECEIPT',
      'DEPARTMENT',
    ]);
    expect(returnTargets(stages, 'IN_WASHING').map(t => t.id)).toEqual(['RECEIPT', 'DEPARTMENT']);
  });

  it('offers only the department at the first stage, and every stage but the release once delivered', () => {
    expect(returnTargets(stages, 'PENDING_STERILIZATION').map(t => t.id)).toEqual(['DEPARTMENT']);
    expect(returnTargets(stages, 'IN_DEPARTMENT').map(t => t.id)).toEqual([
      'DELIVERY',
      'STERILIZATION',
      'PACKAGING',
      'PREPARATION',
      'WASHING',
      'RECEIPT',
    ]);
    expect(returnTargets(stages, 'RETIRED')).toEqual([]);
  });
});

describe('returning an item to an earlier stage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-demo-role', 'ADMIN');
  });

  const setup = () => {
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const s = () => result.current;
    const asset = s().tools.find(t => t.mode === 'STANDALONE' && t.state === 'IN_DEPARTMENT' && !t.maxUses)!;
    const tool = () => s().tools.find(t => t.id === asset.id)!;
    const run = <T,>(fn: () => T) => {
      let out!: T;
      act(() => {
        out = fn();
      });
      return out;
    };
    const through = () => {
      run(() => s().sendToSterilization('TOOL', asset.id));
      run(() =>
        s().receiveAtSterilization('TOOL', asset.id, {
          deliveredByUserId: 'u',
          deliveredByName: 'Τ',
          deliveredByDepartment: 'Τμήμα',
        }),
      );
      run(() =>
        s().createProcessLoad({
          kind: 'WASHING',
          assetRefs: [{kind: 'TOOL', id: asset.id}],
          equipment: 'ΠΛΥΝΤΗΡΙΟ 1',
          cycleNumber: 'W-1',
          program: 'ΘΕΡΜΙΚΗ',
        }),
      );
    };
    return {s, asset, tool, run, through};
  };

  it('puts an instrument back one stage with a reason, in the history, and the move can be undone', () => {
    const f = setup();
    f.through();
    expect(f.tool().state).toBe('IN_PREPARATION');
    expect(
      f
        .s()
        .stageReturnInfo('TOOL', f.asset.id)
        ?.targets.map(t => t.id),
    ).toEqual(['WASHING', 'RECEIPT', 'DEPARTMENT']);

    // A reason is required.
    expect(f.run(() => f.s().returnToStage('TOOL', f.asset.id, 'WASHING', '  '))).toBe(false);
    expect(f.tool().state).toBe('IN_PREPARATION');

    const before = f.s().movements.length;
    expect(f.run(() => f.s().returnToStage('TOOL', f.asset.id, 'WASHING', 'λάθος tablet'))).toBe(true);
    expect(f.tool().state).toBe('IN_WASHING');
    expect(f.s().movements.length).toBe(before + 1);
    expect(f.s().movements[0]).toMatchObject({status: 'Επιστροφή σε προηγούμενο στάδιο', note: 'λάθος tablet'});

    // It can be undone like any other movement: back where it was.
    expect(f.run(() => f.s().undoMovement('TOOL', f.asset.id, 'τελικά σωστό'))).toBe(true);
    expect(f.tool().state).toBe('IN_PREPARATION');
  });

  it('puts a released instrument back before the sterilizer and clears its sterile dates', () => {
    const f = setup();
    f.through();
    f.run(() =>
      f.s().recordPreparation('TOOL', f.asset.id, {toolIds: [f.asset.id], checkedToolIds: [f.asset.id], allOk: true}),
    );
    f.run(() =>
      f.s().completeWorkflowCheckpoint('TOOL', f.asset.id, {stageId: 'PACKAGING', checks: [true, true, true]}),
    );
    const created = f.run(() =>
      f.s().createProcessLoad({
        kind: 'STERILIZATION',
        assetRefs: [{kind: 'TOOL', id: f.asset.id}],
        equipment: 'ΚΛΙΒΑΝΟΣ 1',
        cycleNumber: 'S-1',
        program: '134°C',
        chemicalIndicatorResult: 'PASS',
      }),
    )!;
    // In the running sterilizer: refused.
    expect(f.s().stageReturnInfo('TOOL', f.asset.id)?.refusal).toBe('IN_RUNNING_LOAD');
    f.run(() => f.s().finishProcessLoad(created.id, 'PASSED'));
    f.run(() =>
      f.s().releaseProcessLoad(created.id, {
        physicalParametersOk: true,
        chemicalIndicatorOk: true,
        packagingIntegrityOk: true,
        biologicalIndicatorResult: 'NOT_REQUIRED',
        decision: 'RELEASED',
      }),
    );
    expect(f.tool().state).toBe('READY_FOR_PICKUP');
    expect(f.tool().sterileUntil).toBeTruthy();
    expect(f.run(() => f.s().returnToStage('TOOL', f.asset.id, 'PACKAGING', 'λάθος αποδέσμευση'))).toBe(true);
    expect(f.tool().state).toBe('IN_PACKAGING');
    expect(f.tool().sterileUntil).toBeUndefined();
  });

  it('sends an instrument back to its department, and a delivered one back to the sterilization stages', () => {
    const f = setup();
    f.through();
    expect(f.run(() => f.s().returnToStage('TOOL', f.asset.id, 'DEPARTMENT', 'στάλθηκε κατά λάθος'))).toBe(true);
    expect(f.tool().state).toBe('IN_DEPARTMENT');
    expect(f.s().movements[0]).toMatchObject({status: 'Επιστροφή στο τμήμα', to: f.asset.department});
    // At its department it may be put back into any stage (here the receipt).
    expect(f.run(() => f.s().returnToStage('TOOL', f.asset.id, 'RECEIPT', 'επανάληψη'))).toBe(true);
    expect(f.tool().state).toBe('PENDING_STERILIZATION');
  });

  it('refuses a stage that is not an earlier one', () => {
    const f = setup();
    f.through();
    expect(f.run(() => f.s().returnToStage('TOOL', f.asset.id, 'PACKAGING', 'x'))).toBe(false);
    expect(f.run(() => f.s().returnToStage('TOOL', f.asset.id, 'RELEASE', 'x'))).toBe(false);
    expect(f.tool().state).toBe('IN_PREPARATION');
  });

  it('is not offered to a department user', () => {
    sessionStorage.setItem('surgitrack-demo-role', 'DEPARTMENT');
    const f = setup();
    expect(f.s().stageReturnInfo('TOOL', f.asset.id)).toBeUndefined();
  });
});
