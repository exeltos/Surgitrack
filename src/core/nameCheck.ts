/**
 * Instrument names checked for consistency: the safe clean-up every name gets (spacing, capitals
 * without accents, letters typed on the wrong keyboard, units), and the names that differ under one
 * catalogue code, with a suggestion for the one to keep.
 */

// Letters that look the same in Greek and Latin capitals.
const GREEK_TO_LATIN: Record<string, string> = {
  Α: 'A',
  Β: 'B',
  Ε: 'E',
  Ζ: 'Z',
  Η: 'H',
  Ι: 'I',
  Κ: 'K',
  Μ: 'M',
  Ν: 'N',
  Ο: 'O',
  Ρ: 'P',
  Τ: 'T',
  Υ: 'Y',
  Χ: 'X',
};
const LATIN_TO_GREEK: Record<string, string> = Object.fromEntries(
  Object.entries(GREEK_TO_LATIN).map(([greek, latin]) => [latin, greek]),
);
// Letters only one of the two alphabets has: they tell which alphabet a word is written in.
const ONLY_GREEK = /[ΓΔΘΛΞΠΣΦΨΩ]/;
const ONLY_LATIN = /[CDFGJLQRSUVW]/;
const ACCENTS: Record<string, string> = {Ά: 'Α', Έ: 'Ε', Ή: 'Η', Ί: 'Ι', Ϊ: 'Ι', Ό: 'Ο', Ύ: 'Υ', Ϋ: 'Υ', Ώ: 'Ω'};

/** Capitals without accents, as names are written on hospital records. */
const capitals = (value: string) =>
  value
    .toLocaleUpperCase('el-GR')
    .replace(/[ΆΈΉΊΪΌΎΫΏ]/g, c => ACCENTS[c])
    .replace(/ΐ/g, 'Ι')
    .replace(/ΰ/g, 'Υ');

/**
 * A word typed partly on the other keyboard ("ΚΥΡΤH", "ΗΑLSTED") written in one alphabet: the one
 * a letter only it has points to, else the one most of the word is in. Words with letters only
 * Greek has and letters only Latin has are left as they are.
 */
const oneAlphabet = (word: string) => {
  const greekLetters = (word.match(/[Α-Ω]/g) || []).length;
  const latinLetters = (word.match(/[A-Z]/g) || []).length;
  if (!greekLetters || !latinLetters) return word;
  const onlyGreek = ONLY_GREEK.test(word);
  const onlyLatin = ONLY_LATIN.test(word);
  if (onlyGreek && onlyLatin) return word;
  const toGreek = onlyGreek || (!onlyLatin && greekLetters > latinLetters);
  const toLatin = onlyLatin || (!onlyGreek && latinLetters > greekLetters);
  if (toGreek) return word.replace(/[ABEZHIKMNOPTYX]/g, c => LATIN_TO_GREEK[c]);
  if (toLatin) return word.replace(/[ΑΒΕΖΗΙΚΜΝΟΡΤΥΧ]/g, c => GREEK_TO_LATIN[c]);
  return word;
};

/**
 * The safe clean-up: one space between words, capitals without accents, each word in one alphabet,
 * and lengths written the same way ("12cm", "12 cm" → "12 CM").
 */
export function cleanName(name: string) {
  return capitals(name)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*-\s+|\s+-\s*/g, ' - ')
    .split(' ')
    .map(oneAlphabet)
    .join(' ')
    .replace(/(\d)\s*(CM|MM)\b/g, '$1 $2');
}

/** What two names have in common once punctuation and spacing are set aside. */
export const nameKey = (name: string) =>
  cleanName(name)
    .replace(/[.,;:'"()/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

type Named = {id: string; name: string; code?: string};

/** The safe clean-ups: each distinct name that changes, with the instruments it covers. */
export function cleanUps<T extends Named>(items: readonly T[]) {
  const byName = new Map<string, T[]>();
  for (const item of items) {
    if (cleanName(item.name) === item.name) continue;
    byName.set(item.name, [...(byName.get(item.name) || []), item]);
  }
  return [...byName.entries()]
    .map(([from, list]) => ({from, to: cleanName(from), items: list}))
    .sort((a, b) => b.items.length - a.items.length || a.from.localeCompare(b.from));
}

const words = (name: string) =>
  new Set(
    nameKey(name)
      .split(' ')
      .filter(w => w.length >= 4 && !/\d/.test(w)),
  );

export type CodeName = {
  name: string;
  count: number;
  ids: string[];
  /** Shares no word with the suggestion. */ odd: boolean;
};
export type CodeGroup = {code: string; total: number; names: CodeName[]; suggested: string};

/**
 * Codes whose instruments carry more than one name (after the safe clean-up). The suggestion is
 * the most used name, the fuller one on a tie; a name sharing no word with it is marked odd, as it
 * is probably another instrument with the wrong code.
 */
export function codeGroups<T extends Named>(items: readonly T[]): CodeGroup[] {
  const byCode = new Map<string, Map<string, string[]>>();
  for (const item of items) {
    const code = (item.code || '').trim().toUpperCase();
    if (!code) continue;
    const names = byCode.get(code) || new Map<string, string[]>();
    const name = cleanName(item.name);
    names.set(name, [...(names.get(name) || []), item.id]);
    byCode.set(code, names);
  }
  const groups: CodeGroup[] = [];
  for (const [code, names] of byCode) {
    if (names.size < 2) continue;
    const list = [...names.entries()]
      .map(([name, ids]) => ({name, count: ids.length, ids}))
      .sort((a, b) => b.count - a.count || b.name.length - a.name.length || a.name.localeCompare(b.name));
    const suggested = list[0].name;
    const keep = words(suggested);
    groups.push({
      code,
      total: list.reduce((sum, n) => sum + n.count, 0),
      suggested,
      names: list.map(n => {
        const own = words(n.name);
        const shared = [...own].some(w => keep.has(w));
        return {...n, odd: n.name !== suggested && own.size > 0 && keep.size > 0 && !shared};
      }),
    });
  }
  return groups.sort((a, b) => b.names.length - a.names.length || a.code.localeCompare(b.code));
}

/** The name the hospital already uses for each code (its most used one, after the clean-up). */
export function namesByCode<T extends Named>(items: readonly T[]) {
  const result = new Map<string, string>();
  const counts = new Map<string, Map<string, number>>();
  for (const item of items) {
    const code = (item.code || '').trim().toUpperCase();
    if (!code) continue;
    const names = counts.get(code) || new Map<string, number>();
    const name = cleanName(item.name);
    names.set(name, (names.get(name) || 0) + 1);
    counts.set(code, names);
  }
  for (const [code, names] of counts)
    result.set(code, [...names.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0]);
  return result;
}
