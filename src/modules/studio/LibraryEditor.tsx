import {useState} from 'react';
import {X, Languages} from 'lucide-react';
import type {LibraryItem} from '../../core/libraries';
import AppButton from '../../components/ui/AppButton';
import {translateToEnglish} from '../../core/glossary';
import {tr} from '../../i18n';

export default function LibraryEditor({
  item,
  title,
  onClose,
  onSave,
}: {
  item?: LibraryItem;
  title: string;
  onClose: () => void;
  onSave: (data: Omit<LibraryItem, 'id'>) => void;
}) {
  const [el, setEl] = useState(item?.el || '');
  const [code, setCode] = useState(item?.code || '');
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
          <button onClick={onClose}>
            <X />
          </button>
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
        </div>
        <footer>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton
            variant="primary"
            disabled={!el.trim()}
            onClick={() => onSave({el: el.trim(), en: english || el.trim(), code: code.trim() || undefined})}
          >
            {tr('Αποθήκευση')}
          </AppButton>
        </footer>
      </aside>
    </div>
  );
}
