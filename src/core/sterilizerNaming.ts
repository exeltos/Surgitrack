/** How a hospital names its sterilizers: a base name and a mark that is a letter (A, B, C…) or a number. */
export type SterilizerNaming = {base: string; style: 'LETTERS' | 'NUMBERS'};

export const defaultSterilizerNaming: SterilizerNaming = {base: 'Κλίβανος', style: 'LETTERS'};

/** The mark for the n-th sterilizer (0-based): A…Z, AA, AB… or 1, 2, 3… */
export function sterilizerMark(style: SterilizerNaming['style'], index: number): string {
  if (style === 'NUMBERS') return String(index + 1);
  let n = index;
  let mark = '';
  do {
    mark = String.fromCharCode(65 + (n % 26)) + mark;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return mark;
}

/** The next `count` names that are not already in the list (names compare without case or extra spaces). */
export function nextSterilizerNames(naming: SterilizerNaming, existing: readonly string[], count: number) {
  const base = naming.base.trim() || defaultSterilizerNaming.base;
  const taken = new Set(existing.map(name => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('el')));
  const names: Array<{name: string; mark: string}> = [];
  for (let index = 0; names.length < count && index < 1000; index++) {
    const mark = sterilizerMark(naming.style, index);
    const name = `${base} ${mark}`;
    if (!taken.has(name.toLocaleLowerCase('el'))) names.push({name, mark});
  }
  return names;
}
