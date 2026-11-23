import type {ReactNode} from 'react';
import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import {LibraryStoreProvider, useLibraries} from '../../core/LibraryStore';
import {SurgiProvider, useSurgi} from '../SurgiStore';
import {openCycleOn} from '../../core/cycleEnd';

const wrapper = ({children}: {children: ReactNode}) => (
  <LibraryStoreProvider>
    <SurgiProvider dataMode="DEMO">{children}</SurgiProvider>
  </LibraryStoreProvider>
);

describe('releasing a load with one item failed', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-demo-role', 'STERILIZATION');
  });

  it('releases the rest and sends only the failed item back to reprocessing', () => {
    const {result} = renderHook(() => ({...useSurgi(), libs: useLibraries()}), {wrapper});
    const s = () => result.current;
    const run = <T,>(fn: () => T) => {
      let out!: T;
      act(() => {
        out = fn();
      });
      return out;
    };
    const assets = s()
      .tools.filter(t => t.mode === 'STANDALONE' && t.state === 'IN_DEPARTMENT' && !t.maxUses)
      .slice(0, 2);
    expect(assets).toHaveLength(2);
    for (const asset of assets) {
      run(() => s().sendToSterilization('TOOL', asset.id));
      run(() =>
        s().receiveAtSterilization('TOOL', asset.id, {
          deliveredByUserId: 'u',
          deliveredByName: 'Τ',
          deliveredByDepartment: 'Τμήμα',
        }),
      );
    }
    const refs = assets.map(a => ({kind: 'TOOL' as const, id: a.id}));
    run(() =>
      s().createProcessLoad({
        kind: 'WASHING',
        assetRefs: refs,
        equipment: 'ΠΛΥΝΤΗΡΙΟ 1',
        cycleNumber: 'W-1',
        program: 'Θ',
      }),
    );
    for (const asset of assets) {
      run(() =>
        s().recordPreparation('TOOL', asset.id, {toolIds: [asset.id], checkedToolIds: [asset.id], allOk: true}),
      );
      run(() => s().completeWorkflowCheckpoint('TOOL', asset.id, {stageId: 'PACKAGING', checks: [true, true, true]}));
    }
    const load = run(() =>
      s().createProcessLoad({
        kind: 'STERILIZATION',
        assetRefs: refs,
        equipment: s().libs.sterilizers.find(x => !openCycleOn(s().processLoads, x.el))!.el,
        cycleNumber: 'S-9',
        program: '134°C · 5 min',
        chemicalIndicatorResult: 'PASS',
        cycleCompleted: true,
      }),
    )!;
    expect(load.status).toBe('AWAITING_RELEASE');
    run(() =>
      s().releaseProcessLoad(load.id, {
        physicalParametersOk: true,
        packagingIntegrityOk: true,
        chemicalIndicatorOk: true,
        chemicalIndicatorResult: 'PASS',
        biologicalIndicatorResult: 'NOT_REQUIRED',
        decision: 'RELEASED',
        failedItems: [`TOOL:${assets[1].id}`],
      }),
    );
    const state = (id: string) => s().tools.find(t => t.id === id)?.state;
    expect(s().processLoads.find(l => l.id === load.id)?.status).toBe('RELEASED');
    expect(state(assets[0].id)).not.toBe(state(assets[1].id));
    expect(['IN_STORAGE', 'READY_FOR_PICKUP']).toContain(state(assets[0].id));
    const failedRecord = s().sterilizationReleases.find(r => r.loadId === load.id && r.assetId === assets[1].id);
    expect(failedRecord?.decision).toBe('REPROCESS');
  });
});
