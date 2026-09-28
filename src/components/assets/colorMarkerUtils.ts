import {useMemo} from 'react';
import {useLibraries} from '../../core/LibraryStore';
import type {ColorTape} from '../../core/colorTapes';

/** The hospital's tapes by id, including hidden ones (assets may still carry them). */
export function useColorTapes() {
  const {colorTapes = []} = useLibraries();
  return useMemo(() => new Map(colorTapes.map(tape => [tape.id, tape])), [colorTapes]);
}

/** Marker names in words, e.g. "Μπλε + Κίτρινο", for text, exports and history. */
export function markerText(tapes: string[] | undefined, byId: Map<string, ColorTape>, lang: string) {
  if (!tapes?.length) return '';
  return tapes
    .map(id => {
      const tape = byId.get(id);
      return tape ? (lang === 'el' ? tape.el : tape.en) : '?';
    })
    .join(' + ');
}
