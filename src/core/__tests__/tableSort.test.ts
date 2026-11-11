import {describe, expect, it} from 'vitest';
import {ariaSortOf, nextSort, sortRows} from '../tableSort';

type Row = {name: string; n?: number; at?: Date};
const rows: Row[] = [{name: 'Ωμέγα', n: 10}, {name: 'Άλφα', n: 2}, {name: 'βήτα'}, {name: 'Γάμμα', n: 2}];
const accessors = {name: (r: Row) => r.name, n: (r: Row) => r.n};
const names = (list: Row[]) => list.map(r => r.name);

describe('sorting a list by a column', () => {
  it('goes ascending, descending, then back to the list’s own order', () => {
    const first = nextSort(null, 'name');
    expect(first).toEqual({key: 'name', dir: 'asc'});
    const second = nextSort(first, 'name');
    expect(second).toEqual({key: 'name', dir: 'desc'});
    expect(nextSort(second, 'name')).toBeNull();
    expect(nextSort(second, 'n')).toEqual({key: 'n', dir: 'asc'});
  });

  it('orders text as a person would, Greek and Latin together, ignoring accents and case', () => {
    expect(names(sortRows(rows, {key: 'name', dir: 'asc'}, accessors))).toEqual(['Άλφα', 'βήτα', 'Γάμμα', 'Ωμέγα']);
    expect(names(sortRows(rows, {key: 'name', dir: 'desc'}, accessors))).toEqual(['Ωμέγα', 'Γάμμα', 'βήτα', 'Άλφα']);
  });

  it('orders numbers by size, keeps equal ones in their order and empty ones last in both directions', () => {
    expect(names(sortRows(rows, {key: 'n', dir: 'asc'}, accessors))).toEqual(['Άλφα', 'Γάμμα', 'Ωμέγα', 'βήτα']);
    expect(names(sortRows(rows, {key: 'n', dir: 'desc'}, accessors))).toEqual(['Ωμέγα', 'Άλφα', 'Γάμμα', 'βήτα']);
  });

  it('leaves the rows alone with no sort, and never changes the list it was given', () => {
    const copy = [...rows];
    expect(sortRows(rows, null, accessors)).toEqual(rows);
    sortRows(rows, {key: 'name', dir: 'asc'}, accessors);
    expect(rows).toEqual(copy);
  });

  it('puts «2» before «10» in text', () => {
    const list = [{name: 'Κλίβανος 10'}, {name: 'Κλίβανος 2'}];
    expect(names(sortRows(list, {key: 'name', dir: 'asc'}, accessors))).toEqual(['Κλίβανος 2', 'Κλίβανος 10']);
  });

  it('says which column is sorted for assistive technology', () => {
    expect(ariaSortOf({key: 'name', dir: 'asc'}, 'name')).toBe('ascending');
    expect(ariaSortOf({key: 'name', dir: 'desc'}, 'name')).toBe('descending');
    expect(ariaSortOf({key: 'name', dir: 'asc'}, 'n')).toBe('none');
    expect(ariaSortOf(null, 'n')).toBe('none');
  });
});
