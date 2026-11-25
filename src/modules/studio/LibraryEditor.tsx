import {useState} from 'react';
import {Languages, Plus, X} from 'lucide-react';
import {
  programBase,
  programFields,
  programFromFields,
  programsOf,
  type ProgramFields,
} from '../../core/sterilizerPrograms';
import type {LibraryItem} from '../../core/libraries';
import AppButton from '../../components/ui/AppButton';
import {useConfirm} from '../../components/ui/useConfirm';
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
  // Its own programs once edited; until then the usual ones for its name (steam, or plasma).
  // Each program is edited in its parts (°C, exposure, whole cycle), and kept as text: «134°C · 5 min · σύνολο 45 min».
  const [ownPrograms, setOwnPrograms] = useState<ProgramFields[] | null>(
    item?.programs?.length ? item.programs.map(programFields) : null,
  );
  const programs = ownPrograms ?? programsOf({el}).map(programFields);
  // How its cycles end: chosen here; before the choice existed, by itself wherever a program gave its length.
  const [cycleEnd, setCycleEnd] = useState<'AUTO' | 'MANUAL'>(
    item?.cycleEnd ?? (item?.programs?.some(p => programFields(p).total) ? 'AUTO' : 'MANUAL'),
  );
  // Ending by itself needs every program's whole-cycle length.
  const missingTotal = withPrograms && cycleEnd === 'AUTO' && programs.some(p => !p.total);
  const setField = (index: number, key: keyof ProgramFields, value: string) =>
    setOwnPrograms(
      programs.map((p, i) =>
        i === index ? {...p, [key]: key === 'name' ? value : value.replace(/\D/g, '').slice(0, 3)} : p,
      ),
    );
  // One name only: the English comes from the built-in glossary (or stays as written).
  const english = translateToEnglish(el);
  // Removing a program is asked first, as every deletion is.
  const [confirm, ask] = useConfirm();
  return (
    <div className="studio-drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      {confirm}
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
            <fieldset className="studio-programs">
              <legend>{tr('Προγράμματα')}</legend>
              <div className="studio-cycle-end" role="radiogroup" aria-label={tr('Τέλος κύκλου')}>
                <span>{tr('Τέλος κύκλου')}</span>
                <label>
                  <input
                    type="radio"
                    name="cycle-end"
                    checked={cycleEnd === 'MANUAL'}
                    onChange={() => setCycleEnd('MANUAL')}
                  />
                  {tr('Χειροκίνητα, με «Τέλος κύκλου»')}
                </label>
                <label>
                  <input
                    type="radio"
                    name="cycle-end"
                    checked={cycleEnd === 'AUTO'}
                    onChange={() => setCycleEnd('AUTO')}
                  />
                  {tr('Αυτόματα, στο τέλος του προγράμματος')}
                </label>
              </div>
              <div className="studio-program-row studio-program-head" aria-hidden="true">
                <span>°C</span>
                <span>{tr('Αποστείρωση (λεπτά)')}</span>
                <span>{tr('Όλος ο κύκλος (λεπτά)')}</span>
                <span>{tr('Όνομα προγράμματος')}</span>
              </div>
              {programs.map((program, index) => (
                <div key={index} className="studio-program-row">
                  <input
                    inputMode="numeric"
                    value={program.temperature}
                    placeholder="134"
                    aria-label={tr('Θερμοκρασία προγράμματος {0} (°C)', index + 1)}
                    onChange={e => setField(index, 'temperature', e.target.value)}
                  />
                  <input
                    inputMode="numeric"
                    value={program.exposure}
                    placeholder="5"
                    aria-label={tr('Έκθεση προγράμματος {0} (λεπτά)', index + 1)}
                    onChange={e => setField(index, 'exposure', e.target.value)}
                  />
                  {/* The whole cycle's length: with it the cycle ends by itself; without, by «Τέλος κύκλου». */}
                  <input
                    inputMode="numeric"
                    value={program.total}
                    disabled={cycleEnd === 'MANUAL'}
                    placeholder={cycleEnd === 'MANUAL' ? '—' : '45'}
                    aria-label={tr('Συνολική διάρκεια προγράμματος {0} (λεπτά)', index + 1)}
                    onChange={e => setField(index, 'total', e.target.value)}
                  />
                  <input
                    value={program.name}
                    placeholder={tr('π.χ. Prion')}
                    aria-label={tr('Ονομασία προγράμματος {0}', index + 1)}
                    onChange={e => setField(index, 'name', e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={tr('Αφαίρεση προγράμματος')}
                    disabled={programs.length === 1}
                    onClick={() =>
                      ask({
                        title: tr('Διαγραφή προγράμματος;'),
                        message: tr(
                          'Το πρόγραμμα «{0}» θα αφαιρεθεί από τον κλίβανο μόλις πατήσετε «Αποθήκευση». Τα φορτία που έγιναν με αυτό μένουν ως έχουν.',
                          programFromFields(program) || tr('Πρόγραμμα'),
                        ),
                        confirmLabel: tr('Διαγραφή'),
                        danger: true,
                        onConfirm: () => setOwnPrograms(programs.filter((_, i) => i !== index)),
                      })
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {missingTotal && (
                <small className="studio-programs-missing" role="alert">
                  {tr('Για αυτόματο τέλος συμπληρώστε σε κάθε πρόγραμμα «Όλος ο κύκλος (λεπτά)».')}
                </small>
              )}
              <small className="studio-programs-note">
                {tr(
                  'Αποστείρωση: πόσα λεπτά μένει στη θερμοκρασία (π.χ. 5). Όλος ο κύκλος: από την έναρξη μέχρι να ανοίξει ο κλίβανος, με προθέρμανση και στέγνωμα (π.χ. 45). Με αυτόματο τέλος, ο κύκλος τελειώνει μόνος του όταν περάσει αυτός ο χρόνος. Με χειροκίνητο, τελειώνει όταν πατηθεί «Τέλος κύκλου». Ο κλίβανος δέχεται νέο φορτίο μόνο όταν τελειώσει ο κύκλος του.',
                )}
              </small>
              <AppButton
                size="sm"
                icon={<Plus size={15} />}
                onClick={() => setOwnPrograms([...programs, {name: '', temperature: '', exposure: '', total: ''}])}
              >
                {tr('Προσθήκη προγράμματος')}
              </AppButton>
            </fieldset>
          )}
        </div>
        <footer>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton
            variant="primary"
            disabled={!el.trim() || missingTotal}
            onClick={() =>
              onSave({
                el: el.trim(),
                en: english || el.trim(),
                code: code.trim() || undefined,
                ...(withPrograms
                  ? {programs: programs.map(programFromFields).filter(program => programBase(program)), cycleEnd}
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
