import {useState} from 'react';
import {Eye, EyeOff, Plus, Trash2, X} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import {TapeSwatch} from '../../components/assets/ColorMarker';
import {useLibraries} from '../../core/LibraryStore';
import {useAppPreferences} from '../../core/AppPreferences';
import {colorTapeGroups, MAX_MARKER_TAPES, type ColorTape} from '../../core/colorTapes';
import {tr} from '../../i18n';
import {askConfirm} from '../../components/ui/confirmService';

/**
 * The hospital's color tape palette. It starts full; unused tapes are hidden (they stay on
 * instruments that already carry them) and the hospital adds its own colors, stripes or labels.
 */
export default function ColorTapeLibrary() {
  const {colorTapes = [], addColorTape, updateColorTape, removeColorTape} = useLibraries();
  const {lang} = useAppPreferences();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({el: '', colors: ['#1f5fbf'], label: ''});
  const [showHidden, setShowHidden] = useState(true);
  const inUse = colorTapes.filter(t => t.active !== false).length;

  const save = () => {
    const name = draft.el.trim();
    if (!name) return;
    const label = draft.label.trim();
    const tape: Omit<ColorTape, 'id' | 'custom'> = {
      el: name,
      en: name,
      colors: draft.colors,
      ...(label ? {label} : {}),
      group: label ? 'LABEL' : draft.colors.length > 1 ? 'STRIPED' : 'SOLID',
    };
    addColorTape(tape);
    setDraft({el: '', colors: ['#1f5fbf'], label: ''});
    setAdding(false);
  };
  const preview: ColorTape = {
    id: 'preview',
    el: draft.el,
    en: draft.el,
    colors: draft.colors,
    label: draft.label.trim() || undefined,
    group: 'SOLID',
  };

  return (
    <div className="tape-library">
      <header>
        <div>
          <b>{tr('Χρωματικοί μάρτυρες')}</b>
          <small>
            {tr(
              'Οι ταινίες που κολλάτε σε εργαλεία και Σετ. Κρύψτε όσες δεν χρησιμοποιείτε και προσθέστε δικές σας. {0} σε χρήση από {1}.',
              inUse,
              colorTapes.length,
            )}
          </small>
        </div>
        <div className="tape-library-actions">
          <label>
            <input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} />
            {tr('Εμφάνιση κρυφών')}
          </label>
          <AppButton variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
            {tr('Νέα ταινία')}
          </AppButton>
        </div>
      </header>

      {adding && (
        <section className="tape-new">
          <label>
            <span>{tr('Ονομασία')}</span>
            <input
              value={draft.el}
              onChange={e => setDraft({...draft, el: e.target.value})}
              placeholder={tr('π.χ. Μπλε / Λευκό')}
            />
          </label>
          <div className="tape-new-colors">
            <span>{tr('Χρώματα (έως {0})', MAX_MARKER_TAPES)}</span>
            {draft.colors.map((color, i) => (
              <span key={i} className="tape-new-color">
                <input
                  type="color"
                  value={color}
                  onChange={e =>
                    setDraft({...draft, colors: draft.colors.map((c, j) => (j === i ? e.target.value : c))})
                  }
                />
                {draft.colors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setDraft({...draft, colors: draft.colors.filter((_, j) => j !== i)})}
                    aria-label={tr('Αφαίρεση')}
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
            {draft.colors.length < 3 && (
              <button
                type="button"
                className="tape-new-add-color"
                onClick={() => setDraft({...draft, colors: [...draft.colors, '#f5d31c']})}
              >
                <Plus size={13} /> {tr('Χρώμα')}
              </button>
            )}
          </div>
          <label>
            <span>{tr('Κείμενο ή σύμβολο (προαιρετικό)')}</span>
            <input
              value={draft.label}
              maxLength={6}
              onChange={e => setDraft({...draft, label: e.target.value})}
              placeholder={tr('π.χ. ΟΡΘ, 5, ★')}
            />
          </label>
          <div className="tape-new-preview">
            <TapeSwatch tape={preview} size="lg" />
          </div>
          <footer>
            <AppButton onClick={() => setAdding(false)}>{tr('Ακύρωση')}</AppButton>
            <AppButton variant="primary" disabled={!draft.el.trim()} onClick={save}>
              {tr('Προσθήκη')}
            </AppButton>
          </footer>
        </section>
      )}

      <div className="tape-library-groups">
        {colorTapeGroups.map(group => {
          const items = colorTapes.filter(t => t.group === group.id && (showHidden || t.active !== false));
          if (!items.length) return null;
          return (
            <section key={group.id}>
              <b>{lang === 'el' ? group.el : group.en}</b>
              <div>
                {items.map(tape => {
                  const hidden = tape.active === false;
                  return (
                    <article key={tape.id} className={hidden ? 'hidden-tape' : ''}>
                      <TapeSwatch tape={tape} size="lg" />
                      <span>{lang === 'el' ? tape.el : tape.en}</span>
                      <button
                        type="button"
                        title={hidden ? tr('Εμφάνιση στις επιλογές') : tr('Απόκρυψη από τις επιλογές')}
                        onClick={() => updateColorTape(tape.id, {active: hidden})}
                      >
                        {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      {tape.custom && (
                        <button
                          type="button"
                          className="danger"
                          title={tr('Διαγραφή')}
                          onClick={() =>
                            void askConfirm({
                              title: tr('Διαγραφή'),
                              message: tr('Διαγραφή της ταινίας «{0}»; Θα μείνει στον Κάδο για 30 ημέρες.', tape.el),
                              confirmLabel: tr('Διαγραφή'),
                              danger: true,
                            }).then(sure => sure !== false && removeColorTape(tape.id))
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
