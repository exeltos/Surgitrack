import type {ReactNode} from 'react';
import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import {LibraryStoreProvider, useLibraries} from '../../core/LibraryStore';
import {SurgiProvider, useSurgi} from '../SurgiStore';

const wrapper = ({children}: {children: ReactNode}) => (
  <LibraryStoreProvider>
    <SurgiProvider dataMode="DEMO">{children}</SurgiProvider>
  </LibraryStoreProvider>
);
const both = () => ({surgi: useSurgi(), libs: useLibraries()});

describe('recycle bin: libraries', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-demo-role', 'ADMIN');
  });

  it('keeps a deleted library record in the bin, and putting it back does not duplicate it', () => {
    const {result} = renderHook(both, {wrapper});
    const item = result.current.libs.suppliers[0];
    const count = result.current.libs.suppliers.length;
    act(() => result.current.libs.removeItem('suppliers', item.id));
    expect(result.current.libs.suppliers).toHaveLength(count - 1);
    const [entry] = result.current.surgi.recycleBin;
    expect(entry).toMatchObject({kind: 'LIBRARY', label: item.el, detail: 'suppliers'});
    expect(entry.payload.library?.item).toMatchObject({id: item.id});

    act(() => result.current.libs.restoreItem('suppliers', entry.payload.library!.item as never));
    expect(result.current.libs.suppliers).toHaveLength(count);
    act(() => result.current.libs.restoreItem('suppliers', entry.payload.library!.item as never));
    expect(result.current.libs.suppliers).toHaveLength(count);
  });

  it('keeps only hospital-made colour tapes (catalogue ones are hidden, not deleted)', () => {
    const {result} = renderHook(both, {wrapper});
    act(() => result.current.libs.addColorTape({el: 'ΔΟΚΙΜΗ', en: 'Test', colors: ['#112233'], group: 'SOLID'}));
    const tape = result.current.libs.colorTapes.find(t => t.custom)!;
    const catalogue = result.current.libs.colorTapes.find(t => !t.custom)!;
    act(() => result.current.libs.removeColorTape(catalogue.id));
    expect(result.current.surgi.recycleBin).toHaveLength(0);
    act(() => result.current.libs.removeColorTape(tape.id));
    expect(result.current.surgi.recycleBin[0]).toMatchObject({kind: 'COLOR_TAPE', label: 'ΔΟΚΙΜΗ'});
    expect(result.current.libs.colorTapes.some(t => t.id === tape.id)).toBe(false);
    act(() => result.current.libs.restoreColorTape(tape));
    expect(result.current.libs.colorTapes.some(t => t.id === tape.id)).toBe(true);
  });
});
