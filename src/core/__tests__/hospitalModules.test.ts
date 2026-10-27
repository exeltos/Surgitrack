import {describe, expect, it} from 'vitest';
import {ALL_MODULES, HOSPITAL_MODULES, modulesOf} from '../hospitalModules';

describe('the modules of a hospital', () => {
  it('are the two the platform owner switches on', () => {
    expect(ALL_MODULES).toEqual(['REPLACEMENTS', 'STOCK_MINIMUMS']);
    expect(HOSPITAL_MODULES.every(m => m.el && m.en && m.descriptionEl && m.descriptionEn)).toBe(true);
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
