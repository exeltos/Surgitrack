import {useMemo, useState, type KeyboardEvent} from 'react';
import {useSurgi} from '../../store/SurgiStore';
import {tr, trData} from '../../i18n';

/** One Set or instrument a barcode field can offer while its name, code or barcode is typed. */
export type AssetSuggestion = {
  barcode: string;
  name: string;
  code?: string;
  department?: string;
  legacyBarcodes?: string[];
};

const MAX = 8;
const plain = (value = '') => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Every Set and every instrument outside a Set (members are scanned with their Set), retired ones left out. */
function useAllAssets(): AssetSuggestion[] {
  const {sets, tools} = useSurgi();
  return useMemo(
    () => [
      ...sets.filter(set => set.state !== 'RETIRED'),
      ...tools.filter(tool => !tool.setId && tool.state !== 'RETIRED'),
    ],
    [sets, tools],
  );
}

/** What was typed matches this barcode exactly (its current or an older one): a scan, nothing to suggest. */
const isExact = (asset: AssetSuggestion, query: string) =>
  asset.barcode.toUpperCase() === query || !!asset.legacyBarcodes?.some(code => code.toUpperCase() === query);

/** The items whose barcode, name or code holds what was typed; none for a known barcode (a scan) or under 2 letters. */
export function matchAssets(list: AssetSuggestion[], typed: string) {
  const text = typed.trim();
  if (text.length < 2 || list.some(asset => isExact(asset, text.toUpperCase()))) return [];
  const needle = plain(text);
  return list
    .filter(
      asset =>
        plain(asset.barcode).includes(needle) ||
        plain(asset.name).includes(needle) ||
        (!!asset.code && plain(asset.code).includes(needle)),
    )
    .slice(0, MAX);
}

/**
 * What Enter takes: the highlighted suggestion; else the first one when the text cannot be a barcode (a space, no
 * digit, or a single match); else nothing, and the field sends the typed barcode as a scanner would.
 */
export function enterChoice(typed: string, suggestions: AssetSuggestion[], active: number) {
  if (!suggestions.length) return undefined;
  if (active >= 0) return suggestions[active];
  const text = typed.trim();
  return /\s/.test(text) || !/\d/.test(text) || suggestions.length === 1 ? suggestions[0] : undefined;
}

/**
 * Suggestions for a barcode field: what was typed is searched in the barcode, the name and the code (accents and
 * case ignored). `pool` narrows them to the items the field takes (e.g. those waiting to be loaded); without it
 * every Set and standalone instrument is offered. Keys: ↑/↓ move, Enter picks; Enter with nothing picked keeps
 * the scanner's behaviour (the typed barcode is sent), except when the text cannot be a barcode (it has a space,
 * no digit, or a single match): then the first suggestion is taken.
 */
export function useAssetSuggest(query: string, onPick: (barcode: string) => void, pool?: AssetSuggestion[]) {
  const everything = useAllAssets();
  const [active, setActive] = useState(-1);
  const [shownFor, setShownFor] = useState('');
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const text = query.trim();
  const list = pool || everything;
  const suggestions = useMemo(() => (dismissedFor === text ? [] : matchAssets(list, text)), [list, text, dismissedFor]);
  // A new text starts with nothing picked.
  if (shownFor !== text) {
    setShownFor(text);
    setActive(-1);
  }
  const pick = (asset: AssetSuggestion) => {
    setActive(-1);
    onPick(asset.barcode);
  };
  /** The field's keys. Returns true when it handled Enter itself (a suggestion was picked). */
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive(index => (index + step + suggestions.length) % suggestions.length);
      return false;
    }
    if (e.key === 'Escape') {
      setDismissedFor(text);
      return false;
    }
    if (e.key !== 'Enter') return false;
    const chosen = enterChoice(text, suggestions, active);
    if (!chosen) return false;
    e.preventDefault();
    pick(chosen);
    return true;
  };
  const listbox = suggestions.length ? (
    <ul className="barcode-suggest" role="listbox" aria-label={tr('Προτάσεις')}>
      {suggestions.map((asset, index) => (
        <li key={asset.barcode} role="option" aria-selected={index === active}>
          <button
            type="button"
            className={index === active ? 'active' : ''}
            // Keeps the focus in the field, so the scanner can go on typing.
            onMouseDown={e => e.preventDefault()}
            onClick={() => pick(asset)}
          >
            <b>{asset.barcode}</b>
            <span>{asset.name}</span>
            <small>{[asset.code, trData(asset.department)].filter(Boolean).join(' · ')}</small>
          </button>
        </li>
      ))}
    </ul>
  ) : null;
  return {suggestions, onKeyDown, listbox};
}

/** The placeholder of every field that takes a barcode: a scan, typing it, or searching by name or code. */
export const scanPlaceholder = () => tr('Σάρωση ή αναζήτηση: barcode, όνομα, κωδικός…');
