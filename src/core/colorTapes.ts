/**
 * Color identification tape ("χρωματικός μάρτυρας") put on instruments and Sets. The palette starts
 * with common tape colors, stripes, labels, patterns and numbers; each hospital can hide tapes it
 * does not use and add its own. A marker is an ordered list of 1-3 tapes.
 */

export type ColorTape = {
  id: string;
  el: string;
  en: string;
  /** 1-3 colors, in the order the stripes appear. */
  colors: string[];
  /** Text or symbol printed on the tape: ENT, 5, ★ … */
  label?: string;
  group: ColorTapeGroup;
  /** Hidden tapes stay on assets that already use them but are not offered for new markers. */
  active?: boolean;
  /** Added by the hospital (can be deleted); catalogue tapes can only be hidden. */
  custom?: boolean;
};
export type ColorTapeGroup = 'SOLID' | 'STRIPED' | 'LABEL' | 'PATTERN' | 'NUMBER';

export const MAX_MARKER_TAPES = 3;

export const colorTapeGroups: Array<{id: ColorTapeGroup; el: string; en: string}> = [
  {id: 'SOLID', el: 'Μονόχρωμες', en: 'Solid colors'},
  {id: 'STRIPED', el: 'Δίχρωμες / τρίχρωμες', en: 'Two / three colors'},
  {id: 'LABEL', el: 'Με ένδειξη τμήματος', en: 'With department label'},
  {id: 'PATTERN', el: 'Με σχέδιο', en: 'With pattern'},
  {id: 'NUMBER', el: 'Με αριθμό / γράμμα', en: 'With number / letter'},
];

/** The palette colors: key → Greek, English, hex. */
const C: Record<string, [string, string, string]> = {
  '01': ['Λευκό', 'White', '#f7f7f5'],
  '02': ['Μπλε', 'Blue', '#1f5fbf'],
  '03': ['Πράσινο', 'Green', '#1e9a4b'],
  '04': ['Κόκκινο', 'Red', '#d92b2b'],
  '05': ['Κίτρινο', 'Yellow', '#f5d31c'],
  '06': ['Μωβ', 'Purple', '#7b3fb0'],
  '07': ['Πορτοκαλί', 'Orange', '#f08a1c'],
  '08': ['Καφέ', 'Brown', '#7a4a26'],
  '09': ['Μαύρο', 'Black', '#1d1d1d'],
  '10': ['Ανοιχτό πορτοκαλί', 'Bright orange', '#ff6a13'],
  '11': ['Ροζ', 'Pink', '#f27fb2'],
  '12': ['Γκρι', 'Gray', '#8e959b'],
  '13': ['Ανοιχτό πράσινο', 'Lime green', '#8fd13f'],
  '14': ['Γαλάζιο', 'Light blue', '#6fc3ef'],
  '15': ['Λεβάντα', 'Lavender', '#b9a3e3'],
  '16': ['Μπεζ', 'Beige', '#e3d3b0'],
  '17': ['Δαμασκηνί', 'Plum', '#7c2d5a'],
  '18': ['Απαλό ροζ', 'Baby pink', '#f7c6d9'],
  '19': ['Φούξια', 'Fuchsia', '#d6197c'],
  '20': ['Ιατρικό μπλε', 'Medical blue', '#0f7fa8'],
  '21': ['Σμαραγδί', 'Emerald green', '#0b8a6a'],
};
const hex = (n: string) => C[n][2];
const el = (n: string) => C[n][0];
const en = (n: string) => C[n][1];

const solid = (n: string): ColorTape => ({
  id: `solid-${n}`,
  el: el(n),
  en: en(n),
  colors: [hex(n)],
  group: 'SOLID',
});
const striped = (parts: string[]): ColorTape => ({
  id: `stripes-${parts.join('-')}`,
  el: parts.map(el).join(' / '),
  en: parts.map(en).join(' / '),
  colors: parts.map(hex),
  group: 'STRIPED',
});
const pattern = (n: string, grPattern: string, enPattern: string, symbol: string): ColorTape => ({
  id: `pattern-${n}-${enPattern}`,
  el: `${el(n)} · ${grPattern}`,
  en: `${en(n)} · ${enPattern}`,
  colors: [hex(n)],
  label: symbol,
  group: 'PATTERN',
});
const numbered = (n: string, label: string): ColorTape => ({
  id: `number-${n}-${label}`,
  el: `${el(n)} · ${label}`,
  en: `${en(n)} · ${label}`,
  colors: [hex(n)],
  label,
  group: 'NUMBER',
});

// Sorted: object keys like '10' would otherwise come before '01'.
const ALL_COLORS = Object.keys(C).sort();
const STRIPES = [
  ['01', '02'],
  ['01', '03'],
  ['01', '04'],
  ['01', '05'],
  ['01', '06'],
  ['01', '07'],
  ['01', '09'],
  ['01', '11'],
  ['01', '14'],
  ['02', '03'],
  ['02', '04'],
  ['02', '05'],
  ['02', '06'],
  ['02', '07'],
  ['02', '11'],
  ['05', '03'],
  ['05', '04'],
  ['05', '06'],
  ['05', '07'],
  ['05', '13'],
  ['09', '03'],
  ['09', '04'],
  ['09', '05'],
  ['09', '06'],
  ['09', '07'],
  ['01', '09', '02'],
  ['01', '03', '04'],
  ['04', '05', '09'],
];
const PATTERNS: Array<[string, string, string, string[]]> = [
  ['καρδιές', 'hearts', '♥', ['01', '02', '03', '04', '06', '07', '11']],
  ['αστέρια', 'stars', '★', ['02', '03', '04', '06', '07', '19', '21']],
  ['κουκκίδες', 'dots', '●', ['06', '19', '20', '21']],
  ['τρίγωνα', 'triangles', '▲', ['06', '19', '20', '21']],
  ['ρόμβοι', 'diamonds', '◆', ['02', '04', '17']],
];

export const colorTapeCatalog: ColorTape[] = [
  ...ALL_COLORS.map(solid),
  ...STRIPES.map(striped),
  ...PATTERNS.flatMap(([grName, enName, symbol, colors]) => colors.map(n => pattern(n, grName, enName, symbol))),
  ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'A', 'B', 'C', 'D', 'E'].map(label => numbered('05', label)),
];

/** The marker a tool shows: its own, its Set's, or none. */
export type ToolColorMode = 'SET' | 'OWN' | 'NONE';

export const effectiveToolMarker = (
  tool: {colorMode?: ToolColorMode; colorTapes?: string[]; setId?: string; mode?: string},
  parentSet?: {colorTapes?: string[]},
): string[] => {
  const mode = tool.colorMode || (tool.mode === 'SET_MEMBER' && tool.setId ? 'SET' : 'NONE');
  if (mode === 'OWN') return tool.colorTapes || [];
  if (mode === 'SET') return tool.mode === 'SET_MEMBER' ? parentSet?.colorTapes || [] : [];
  return [];
};

export const sameMarker = (a: string[] = [], b: string[] = []) =>
  a.length === b.length && a.every((id, i) => id === b[i]);
