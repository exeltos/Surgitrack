import {describe, expect, it} from 'vitest';
import {colorTapeCatalog, effectiveToolMarker, sameMarker} from '../colorTapes';

describe('color tape catalogue', () => {
  it('has unique codes and 1-3 colors per tape', () => {
    const ids = colorTapeCatalog.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tape of colorTapeCatalog) {
      expect(tape.colors.length).toBeGreaterThanOrEqual(1);
      expect(tape.colors.length).toBeLessThanOrEqual(3);
      tape.colors.forEach(c => expect(c).toMatch(/^#[0-9a-f]{6}$/));
    }
  });

  it('offers solid, striped, patterned and numbered tapes without supplier codes', () => {
    const groups = new Set(colorTapeCatalog.map(t => t.group));
    expect([...groups].sort()).toEqual(['NUMBER', 'PATTERN', 'SOLID', 'STRIPED']);
    expect(colorTapeCatalog.find(t => t.id === 'solid-04')?.el).toBe('Κόκκινο');
    expect(colorTapeCatalog.some(t => t.colors.length === 3)).toBe(true);
    expect(colorTapeCatalog.every(t => !('code' in t))).toBe(true);
  });
});

describe('effectiveToolMarker', () => {
  const set = {colorTapes: ['solid-02', 'solid-05']};
  it('follows the Set by default when the tool is in a Set', () => {
    expect(effectiveToolMarker({mode: 'SET_MEMBER', setId: 's1'}, set)).toEqual(set.colorTapes);
  });
  it('keeps its own marker or none', () => {
    expect(
      effectiveToolMarker({mode: 'SET_MEMBER', setId: 's1', colorMode: 'OWN', colorTapes: ['solid-04']}, set),
    ).toEqual(['solid-04']);
    expect(effectiveToolMarker({mode: 'SET_MEMBER', setId: 's1', colorMode: 'NONE'}, set)).toEqual([]);
  });
  it('a standalone tool has no Set color to follow', () => {
    expect(effectiveToolMarker({mode: 'STANDALONE', colorMode: 'SET'}, set)).toEqual([]);
  });
  it('compares markers in order', () => {
    expect(sameMarker(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameMarker(['a', 'b'], ['b', 'a'])).toBe(false);
  });
});
