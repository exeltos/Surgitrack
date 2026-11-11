import type {ReactNode} from 'react';
import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import {ALL_MODULES, HOSPITAL_MODULES, modulesOf, type HospitalModule} from '../hospitalModules';
import {LibraryStoreProvider, useLibraries} from '../LibraryStore';
import {testsState} from '../equipmentTests';
import {ModulesContext} from '../../data/cloud/modulesContext';

const withModules = (modules: HospitalModule[] | null) =>
  function Wrapper({children}: {children: ReactNode}) {
    return (
      <ModulesContext.Provider value={modules}>
        <LibraryStoreProvider>{children}</LibraryStoreProvider>
      </ModulesContext.Provider>
    );
  };

describe('the modules of a hospital', () => {
  it('names the count in the operating theatre and the equipment tests, and ignores unknown ones', () => {
    expect(ALL_MODULES).toEqual(expect.arrayContaining(['SURGICAL_COUNT', 'EQUIPMENT_TESTS']));
    expect(HOSPITAL_MODULES.every(m => m.el && m.en && m.descriptionEl && m.descriptionEn)).toBe(true);
    expect(modulesOf(['SURGICAL_COUNT', 'SOMETHING'])).toEqual(['SURGICAL_COUNT']);
  });
});

describe('the tests of a sterilizer in a hospital without the equipment tests module', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  const failTest = () => ({
    id: 't1',
    kind: 'BOWIE_DICK' as const,
    result: 'FAIL' as const,
    at: '10/11/2026 07:30',
    by: 'Τ',
  });

  it('are not there: nothing blocks the loading', () => {
    const {result} = renderHook(() => useLibraries(), {wrapper: withModules(['DEVICES'])});
    act(() => result.current.updateItem('sterilizers', result.current.sterilizers[0].id, {tests: [failTest()]}));
    expect(result.current.sterilizers[0].tests).toBeUndefined();
    expect(testsState(result.current.sterilizers[0].tests)).toBe('DUE');
  });

  it('are kept where the hospital has the module (and where nothing says otherwise)', () => {
    for (const modules of [['EQUIPMENT_TESTS'] as HospitalModule[], null]) {
      const {result, unmount} = renderHook(() => useLibraries(), {wrapper: withModules(modules)});
      act(() => result.current.updateItem('sterilizers', result.current.sterilizers[0].id, {tests: [failTest()]}));
      expect(testsState(result.current.sterilizers[0].tests)).toBe('FAILED');
      unmount();
    }
  });
});
