import {useState} from 'react';
import {Languages, Plus, X} from 'lucide-react';
import {programsOf} from '../../core/sterilizerPrograms';
import {normalizeCycleNumber} from '../../core/cycleNumber';
import type {LibraryItem} from '../../core/libraries';
import AppButton from '../../components/ui/AppButton';
import {translateToEnglish} from '../../core/glossary';
import {tr} from '../../i18n';

export default function LibraryEditor({
  item,
  title,
  onClose,
  onSave,
  withPrograms,
}: {
  /** A sterilizer: its programs are edited too. */
  withPrograms?: boolean;
  item?: LibraryItem;
  title: string;
  onClose: () => void;
  onSave: (data: Omit<LibraryItem, 'id'>) => void;
}) {
  const [el, setEl] = useState(item?.el || '');
  const [code, setCode] = useState(item?.code || '');
  const [cyclePrefix, setCyclePrefix] = useState(item?.cyclePrefix || '');
  // Its own programs once edited; until then the usual ones for its name (steam, or plasma).
  const [ownPrograms, setOwnPrograms] = useState<string[] | null>(item?.programs?.length ? item.programs : null);
  const programs = ownPrograms ?? programsOf({el});
  const setProgram = (index: number, value: string) =>
    setOwnPrograms(programs.map((p, i) => (i === index ? value : p)));
  // One name only: the English comes from the built-in glossary (or stays as written).
  const english = translateToEnglish(el);
  return (
    <div className="studio-drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <aside className="studio-drawer">
        <header>
          <div>
            <span className="eyebrow">{title}</span>
            <h2>{item ? tr('Επεξεργασία εγγραφής') : tr('Νέα εγγραφή')}</h2>
          </div>
        </header>
        <div className="studio-drawer-form">
          <label>
            {tr('Ονομασία')}
            <input autoFocus value={el} onChange={e => setEl(e.target.value)} />
          </label>
          {el.trim() && (
            <div className="studio-form-note">
              <Languages size={16} />
              <span>
                {english && english !== el.trim() ? (
                  <>
                    {tr('Στα αγγλικά θα εμφανίζεται ως') + ' '}
                    <b>{english}</b>.
                  </>
                ) : (
                  tr('Στα αγγλικά θα εμφανίζεται όπως το γράψατε.')
                )}
              </span>
            </div>
          )}
          <label>
            {tr('Κωδικός')}
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder={tr('Προαιρετικό')} />
          </label>
          {withPrograms && (
            <label>
              {tr('Γράμμα κύκλων')}
              <input
                value={cyclePrefix}
                maxLength={2}
                onChange={e => setCyclePrefix(normalizeCycleNumber(e.target.value).replace(/[^A-ZΑ-Ω]/g, ''))}
                placeholder={tr('π.χ. Α — οι κύκλοι του: Α1, Α2…')}
              />
            </label>
          )}
          {withPrograms && (
            <fieldset className="studio-programs">
              <legend>{tr('Προγράμματα')}</legend>
              {programs.map((program, index) => (
                <div key={index} className="studio-program-row">
                  <input
                    value={program}
                    aria-label={tr('Πρόγραμμα {0}', index + 1)}
                    onChange={e => setProgram(index, e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={tr('Αφαίρεση προγράμματος')}
                    disabled={programs.length === 1}
                    onClick={() => setOwnPrograms(programs.filter((_, i) => i !== index))}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <AppButton size="sm" icon={<Plus size={15} />} onClick={() => setOwnPrograms([...programs, ''])}>
                {tr('Προσθήκη προγράμματος')}
              </AppButton>
            </fieldset>
          )}
        </div>
        <footer>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton
            variant="primary"
            disabled={!el.trim()}
            onClick={() =>
              onSave({
                el: el.trim(),
                en: english || el.trim(),
                code: code.trim() || undefined,
                ...(withPrograms
                  ? {programs: programs.map(p => p.trim()).filter(Boolean), cyclePrefix: cyclePrefix || undefined}
                  : {}),
              })
            }
          >
            {tr('Αποθήκευση')}
          </AppButton>
        </footer>
      </aside>
    </div>
  );
}
