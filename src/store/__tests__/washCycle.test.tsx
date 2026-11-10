import type {ReactNode} from 'react';
import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import {LibraryStoreProvider} from '../../core/LibraryStore';
import {equipmentTrouble} from '../../core/equipmentHealth';
import {SurgiProvider, useSurgi} from '../SurgiStore';

const wrapper = ({children}: {children: ReactNode}) => (
  <LibraryStoreProvider>
    <SurgiProvider dataMode="DEMO">{children}</SurgiProvider>
  </LibraryStoreProvider>
);

describe('the result of a wash cycle', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-demo-role', 'STERILIZATION');
  });

  const setup = () => {
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const run = <T,>(fn: () => T) => {
      let out!: T;
      act(() => {
        out = fn();
      });
      return out;
    };
    const asset = result.current.tools.find(t => t.mode === 'STANDALONE' && t.state === 'IN_DEPARTMENT' && !t.maxUses)!;
    run(() => result.current.sendToSterilization('TOOL', asset.id));
    run(() =>
      result.current.receiveAtSterilization('TOOL', asset.id, {
        deliveredByUserId: 'u',
        deliveredByName: 'Τ',
        deliveredByDepartment: 'Τμήμα',
      }),
    );
    const wash = (extra: object) =>
      run(() =>
        result.current.createProcessLoad({
          kind: 'WASHING',
          assetRefs: [{kind: 'TOOL', id: asset.id}],
          equipment: 'ΠΛΥΝΤΗΡΙΟ 1',
          cycleNumber: `W-${Math.random()}`,
          program: 'Θερμική απολύμανση',
          ...extra,
        }),
      );
    const stateOf = () => result.current.tools.find(t => t.id === asset.id)!.state;
    return {result, wash, stateOf};
  };

  it('moves a passed wash on and keeps its temperature and A0', () => {
    const f = setup();
    const load = f.wash({washResult: 'PASS', washTemperature: 90, washA0: 600});
    expect(load).toMatchObject({status: 'PASSED', washTemperature: 90, washA0: 600});
    expect(f.stateOf()).not.toBe('IN_WASHING');
  });

  it('keeps the items in cleaning after a failed wash, which counts as the washer’s trouble', () => {
    const f = setup();
    const load = f.wash({washResult: 'FAIL', washTemperature: 61});
    expect(load).toMatchObject({status: 'FAILED', washTemperature: 61});
    expect(f.stateOf()).toBe('IN_WASHING');
    const loads = f.result.current.processLoads;
    expect(equipmentTrouble('ΠΛΥΝΤΗΡΙΟ 1', loads, Date.now(), 'WASHING').items).toHaveLength(1);
    // washed again, the same items go on
    expect(f.wash({washResult: 'PASS'})).toMatchObject({status: 'PASSED'});
    expect(f.stateOf()).not.toBe('IN_WASHING');
  });
});
