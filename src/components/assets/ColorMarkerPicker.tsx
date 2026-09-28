import {useMemo, useState} from 'react';
import {ArrowLeft, ArrowRight, Search, TriangleAlert, X} from 'lucide-react';
import AppButton from '../ui/AppButton';
import ColorMarker, {TapeSwatch} from './ColorMarker';
import {markerText, useColorTapes} from './colorMarkerUtils';
import {useLibraries} from '../../core/LibraryStore';
import {useAppPreferences} from '../../core/AppPreferences';
import {colorTapeGroups, MAX_MARKER_TAPES, sameMarker, type ToolColorMode} from '../../core/colorTapes';
import {tr} from '../../i18n';

export type MarkerValue = {mode?: ToolColorMode; tapes: string[]};

/**
 * Choosing the color marker of a Set or an instrument: up to three tapes in order. An instrument
 * can instead follow its Set's marker or carry none.
 */
export default function ColorMarkerPicker({
  kind,
  title,
  value,
  parentTapes,
  inSet,
  otherSets = [],
  onSave,
  onClose,
}: {
  kind: 'SET' | 'TOOL';
  title: string;
  value: MarkerValue;
  /** The Set's marker, for an instrument that belongs to a Set. */
  parentTapes?: string[];
  inSet?: boolean;
  /** Other Sets, to warn when the same combination is already in use. */
  otherSets?: Array<{barcode: string; name: string; colorTapes?: string[]}>;
  onSave: (value: MarkerValue) => void;
  onClose: () => void;
}) {
  const {colorTapes = []} = useLibraries();
  const {lang} = useAppPreferences();
  const byId = useColorTapes();
  const [mode, setMode] = useState<ToolColorMode>(
    value.mode || (kind === 'TOOL' ? (inSet ? 'SET' : value.tapes.length ? 'OWN' : 'NONE') : 'OWN'),
  );
  const [tapes, setTapes] = useState<string[]>(value.tapes);
  const [query, setQuery] = useState('');
  const choosing = kind === 'SET' || mode === 'OWN';
  const offered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return colorTapes.filter(
      tape => tape.active !== false && (!q || `${tape.el} ${tape.en} ${tape.label || ''}`.toLowerCase().includes(q)),
    );
  }, [colorTapes, query]);
  const duplicates = kind === 'SET' && tapes.length ? otherSets.filter(s => sameMarker(s.colorTapes, tapes)) : [];
  const add = (id: string) => setTapes(current => (current.length >= MAX_MARKER_TAPES ? current : [...current, id]));
  const move = (index: number, by: number) =>
    setTapes(current => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });
  const save = () => onSave(kind === 'SET' ? {tapes} : {mode, tapes: mode === 'OWN' ? tapes : []});

  return (
    <div className="modal-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <div className="color-picker-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <span className="eyebrow">{tr('ΧΡΩΜΑΤΙΚΟΣ ΜΑΡΤΥΡΑΣ')}</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={tr('Κλείσιμο')}>
            <X size={18} />
          </button>
        </header>

        {kind === 'TOOL' && (
          <div className="color-mode-choices">
            {inSet && (
              <label className={mode === 'SET' ? 'active' : ''}>
                <input type="radio" checked={mode === 'SET'} onChange={() => setMode('SET')} />
                <span>
                  <b>{tr('Όπως το Σετ')}</b>
                  <ColorMarker tapes={parentTapes} size="sm" empty={tr('Το Σετ δεν έχει χρώμα')} />
                </span>
              </label>
            )}
            <label className={mode === 'OWN' ? 'active' : ''}>
              <input type="radio" checked={mode === 'OWN'} onChange={() => setMode('OWN')} />
              <span>
                <b>{tr('Δικός του')}</b>
                <small>{tr('Διαφορετικό χρώμα από το Σετ ή για μεμονωμένο εργαλείο.')}</small>
              </span>
            </label>
            <label className={mode === 'NONE' ? 'active' : ''}>
              <input type="radio" checked={mode === 'NONE'} onChange={() => setMode('NONE')} />
              <span>
                <b>{tr('Χωρίς χρώμα')}</b>
              </span>
            </label>
          </div>
        )}

        {choosing && (
          <>
            <div className="color-selection">
              <span>{tr('Επιλογή (έως {0}, με τη σειρά που μπαίνουν):', MAX_MARKER_TAPES)}</span>
              {tapes.length === 0 && <em>{tr('Καμία ταινία ακόμα')}</em>}
              {tapes.map((id, i) => (
                <span className="color-selection-item" key={`${id}-${i}`}>
                  <TapeSwatch tape={byId.get(id)} size="lg" />
                  <small>{markerText([id], byId, lang)}</small>
                  <span className="color-selection-actions">
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={tr('Αριστερά')}>
                      <ArrowLeft size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={i === tapes.length - 1}
                      onClick={() => move(i, 1)}
                      aria-label={tr('Δεξιά')}
                    >
                      <ArrowRight size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTapes(current => current.filter((_, j) => j !== i))}
                      aria-label={tr('Αφαίρεση')}
                    >
                      <X size={13} />
                    </button>
                  </span>
                </span>
              ))}
            </div>
            {duplicates.length > 0 && (
              <p className="color-duplicate">
                <TriangleAlert size={15} />
                {tr('Ο ίδιος συνδυασμός υπάρχει ήδη σε: {0}', duplicates.map(s => s.barcode).join(', '))}
              </p>
            )}
            <label className="color-search">
              <Search size={15} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder={tr('Αναζήτηση χρώματος...')} />
            </label>
            <div className="color-palette">
              {colorTapeGroups.map(group => {
                const items = offered.filter(t => t.group === group.id);
                if (!items.length) return null;
                return (
                  <section key={group.id}>
                    <b>{lang === 'el' ? group.el : group.en}</b>
                    <div>
                      {items.map(tape => (
                        <button
                          type="button"
                          key={tape.id}
                          disabled={tapes.length >= MAX_MARKER_TAPES}
                          onClick={() => add(tape.id)}
                          title={lang === 'el' ? tape.el : tape.en}
                        >
                          <TapeSwatch tape={tape} size="lg" />
                          <small>{lang === 'el' ? tape.el : tape.en}</small>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}

        <footer>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton variant="primary" onClick={save}>
            {tr('Αποθήκευση')}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
