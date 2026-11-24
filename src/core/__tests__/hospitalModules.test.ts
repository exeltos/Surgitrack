import {describe, expect, it} from 'vitest';
import {ALL_MODULES, HOSPITAL_MODULES, modulesOf} from '../hospitalModules';

describe('the modules of a hospital', () => {
  it('are the ones the platform owner switches on', () => {
    expect(ALL_MODULES).toEqual([
      'REPLACEMENTS',
      'ORDERS',
      'STOCK_MINIMUMS',
      'DEVICES',
      'SURGICAL_COUNT',
      'EQUIPMENT_TESTS',
      'MANUAL_USES',
    ]);
    expect(HOSPITAL_MODULES.every(m => m.el && m.en && m.descriptionEl && m.descriptionEn)).toBe(true);
  });

  it('has withdrawals & replacements and orders as two modules', () => {
    expect(modulesOf(['ORDERS'])).toEqual(['ORDERS']);
    expect(HOSPITAL_MODULES.find(m => m.id === 'ORDERS')?.el).toBe('Παραγγελίες');
  });

  it('are read from the hospital row: the known ones, in order; undefined when the row says nothing', () => {
    expect(modulesOf(['STOCK_MINIMUMS', 'REPLACEMENTS'])).toEqual(['REPLACEMENTS', 'STOCK_MINIMUMS']);
    expect(modulesOf(['STOCK_MINIMUMS', 'SOMETHING'])).toEqual(['STOCK_MINIMUMS']);
    expect(modulesOf([])).toEqual([]);
    expect(modulesOf(undefined)).toBeUndefined();
    expect(modulesOf(null)).toBeUndefined();
    expect(modulesOf('REPLACEMENTS')).toBeUndefined();
  });
});
