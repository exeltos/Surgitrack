import {describe, expect, it} from 'vitest';
import {correctName, correctionFor, spellingFixes} from '../spelling';

describe('correctionFor', () => {
  it('corrects a misspelled instrument word', () => {
    expect(correctionFor('ΛΑΒΗΔΑ')).toBe('ΛΑΒΙΔΑ');
    expect(correctionFor('ΑΙΜΟΣΤΑΤΚΗ')).toBe('ΑΙΜΟΣΤΑΤΙΚΗ');
    expect(correctionFor('ΑΠΟΚΟΛΗΤΗΡΑΣ')).toBe('ΑΠΟΚΟΛΛΗΤΗΡΑΣ');
    expect(correctionFor('ΑΝΑΡΡΟΦΙΣΗΣ')).toBe('ΑΝΑΡΡΟΦΗΣΗΣ');
    expect(correctionFor('ΣΜΗΛΗ')).toBe('ΣΜΙΛΗ');
  });

  it('leaves known words, endings of their own, short look-alikes and unknown names alone', () => {
    expect(correctionFor('ΛΑΒΙΔΑ')).toBeUndefined();
    expect(correctionFor('ΚΥΡΤΑ')).toBeUndefined();
    expect(correctionFor('ΜΑΥΟ')).toBeUndefined();
    expect(correctionFor('ΚΥΤΙΟ')).toBeUndefined();
    expect(correctionFor('ΡΙΤΣΑΡΣΟΝ')).toBeUndefined();
    expect(correctionFor('METZENBAUM')).toBeUndefined();
  });

  it('suggests nothing when two equally close words are used as much, whatever comes after', () => {
    expect(
      correctionFor(
        'ΑΒΙΔΕΣ',
        new Map([
          ['ΑΚΙΔΕΣ', 10],
          ['ΒΙΔΕΣ', 10],
        ]),
      ),
    ).toBeUndefined();
    expect(
      correctionFor(
        'ΑΒΙΔΕΣ',
        new Map([
          ['ΑΚΙΔΕΣ', 10],
          ['ΒΙΔΕΣ', 3],
        ]),
      ),
    ).toBe('ΑΚΙΔΕΣ');
  });
});

describe('spellingFixes', () => {
  it('lists each misspelled word with the instruments that carry it, and corrects their names', () => {
    const tools = [
      {id: '1', name: 'ΛΑΒΗΔΑ ΚΥΡΤΗ 14 CM'},
      {id: '2', name: 'λαβηδα ευθεία'},
      {id: '3', name: 'ΛΑΒΙΔΑ ΚΥΡΤΗ'},
    ];
    const fixes = spellingFixes(tools);
    expect(fixes.map(f => [f.from, f.to, f.items.map(t => t.id)])).toEqual([['ΛΑΒΗΔΑ', 'ΛΑΒΙΔΑ', ['1', '2']]]);
    expect(correctName(tools[1].name, new Map([['ΛΑΒΗΔΑ', 'ΛΑΒΙΔΑ']]))).toBe('ΛΑΒΙΔΑ ΕΥΘΕΙΑ');
  });
});
