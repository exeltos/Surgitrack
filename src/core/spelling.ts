import {INSTRUMENT_WORDS} from './instrumentWords';
import {cleanName} from './nameCheck';

/**
 * Spelling of instrument names: a word that is not a known one but is one slip away from it (ΛΑΒΗΔΑ → ΛΑΒΙΔΑ,
 * ΑΙΜΟΣΤΑΤΚΗ → ΑΙΜΟΣΤΑΤΙΚΗ, ΑΠΟΚΟΛΗΤΗΡΑΣ → ΑΠΟΚΟΛΛΗΤΗΡΑΣ) is offered its correction. Known words never change,
 * and a word near nothing known (a surgeon's name, a brand) is left as it is.
 */

/** How a word sounds: the vowels written in several ways made one, double letters single. */
export const soundKey = (word: string) =>
  word
    .replace(/ΟΥ/g, 'U')
    .replace(/ΑΥ/g, 'AV')
    .replace(/ΕΥ/g, 'EV')
    .replace(/ΑΙ/g, 'Ε')
    .replace(/ΕΙ|ΟΙ|ΥΙ|Η|Υ/g, 'Ι')
    .replace(/Ω/g, 'Ο')
    .replace(/ΓΚ|ΓΓ/g, 'G')
    .replace(/(.)\1+/g, '$1');

/** Letters added, dropped, changed or swapped (two side by side) to make one word the other. */
export function editDistance(a: string, b: string, max = 3) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = Array.from({length: a.length + 1}, (_, i) =>
    Array.from({length: b.length + 1}, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, rows[i - 2][j - 2] + 1);
      rows[i][j] = d;
    }
  }
  return rows[a.length][b.length];
}

const GREEK_WORD = /^[Α-Ω]{4,}$/;

/**
 * The known word a misspelled one stands for, or undefined. The same sound wins (ΣΜΗΛΗ → ΣΜΙΛΗ); otherwise, in a word of
 * six letters or more, one slip (two in a long word), with the same last letter, so an ending of its own (ΚΥΡΤΑ,
 * ΚΥΡΤΗ) is never "corrected".
 * Several equally close words: the one the hospital uses most, else none.
 */
export function correctionFor(word: string, uses: ReadonlyMap<string, number> = new Map()) {
  if (!GREEK_WORD.test(word) || INSTRUMENT_WORDS.has(word)) return undefined;
  const sound = soundKey(word);
  const allowed = word.length >= 9 ? 2 : 1;
  let best: {word: string; score: number} | undefined;
  let tie = false;
  for (const known of INSTRUMENT_WORDS) {
    if (Math.abs(known.length - word.length) > allowed) continue;
    let score: number;
    // The same sound, then the fewest letters changed among those (ΑΝΑΡΡΟΦΙΣΗΣ → ΑΝΑΡΡΟΦΗΣΗΣ, not ΑΝΑΡΡΟΦΗΣΕΙΣ).
    if (soundKey(known) === sound) score = editDistance(word, known, 4) / 10;
    else {
      // A short word only by its sound: ΚΥΤΙΟ is not ΚΥΡΙΟ, ΜΑΥΟ (Mayo) is not ΜΑΥΡΟ.
      if (word.length < 6 || known[known.length - 1] !== word[word.length - 1]) continue;
      score = editDistance(word, known, allowed);
      if (score > allowed) continue;
    }
    if (!best || score < best.score) {
      best = {word: known, score};
      tie = false;
    } else if (score === best.score) {
      const mine = uses.get(known) || 0;
      const theirs = uses.get(best.word) || 0;
      // A more used one wins; an equally used one leaves it undecided; a less used one changes nothing.
      if (mine > theirs) {
        best = {word: known, score};
        tie = false;
      } else if (mine === theirs) tie = true;
    }
  }
  return best && !tie ? best.word : undefined;
}

type Named = {id: string; name: string};
const wordsOf = (name: string) =>
  cleanName(name)
    .split(/[^Α-ΩA-Z0-9]+/)
    .filter(Boolean);

/** Each misspelled word of the names, with its correction and the instruments whose name has it. */
export function spellingFixes<T extends Named>(items: readonly T[]) {
  const uses = new Map<string, number>();
  for (const item of items) for (const w of wordsOf(item.name)) uses.set(w, (uses.get(w) || 0) + 1);
  const corrections = new Map<string, string | undefined>();
  const byWord = new Map<string, T[]>();
  for (const item of items) {
    for (const w of new Set(wordsOf(item.name))) {
      if (!corrections.has(w)) corrections.set(w, correctionFor(w, uses));
      if (!corrections.get(w)) continue;
      const list = byWord.get(w);
      if (list) list.push(item);
      else byWord.set(w, [item]);
    }
  }
  return [...byWord.entries()]
    .map(([from, list]) => ({from, to: corrections.get(from)!, items: list}))
    .sort((a, b) => b.items.length - a.items.length || a.from.localeCompare(b.from));
}

/** A name with the chosen words corrected (whole words only), cleaned as every name is. */
export function correctName(name: string, fixes: ReadonlyMap<string, string>) {
  return cleanName(name).replace(/[Α-Ω]+/g, w => fixes.get(w) ?? w);
}
