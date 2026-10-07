import {useState} from 'react';
import {X} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import {translateToEnglish} from '../../core/glossary';
import {nextSterilizerNames, type SterilizerNaming} from '../../core/sterilizerNaming';
import {tr} from '../../i18n';

/** Adds several sterilizers at once, named the hospital's way (Κλίβανος A, B, C… or 1, 2, 3…). */
export default function SterilizerBatchDialog({
  naming,
  existing,
  onClose,
  onSave,
}: {
  naming: SterilizerNaming;
  existing: readonly string[];
  onClose: () => void;
  onSave: (naming: SterilizerNaming, names: Array<{name: string; mark: string}>) => void;
}) {
  const [base, setBase] = useState(naming.base);
  const [style, setStyle] = useState(naming.style);
  const [count, setCount] = useState(4);
  const safeCount = Math.max(1, Math.min(20, Math.floor(count) || 1));
  const names = nextSterilizerNames({base, style}, existing, safeCount);
  const english = translateToEnglish(base.trim());
  return (
    <div className="studio-drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <aside className="studio-drawer sterilizer-batch">
        <header>
          <div>
            <span className="eyebrow">{tr('Κλίβανοι')}</span>
            <h2>{tr('Προσθήκη κλιβάνων')}</h2>
          </div>
          <button aria-label={tr('Κλείσιμο')} onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="studio-drawer-form">
          <label>
            {tr('Ονομασία')}
            <input autoFocus value={base} onChange={e => setBase(e.target.value)} />
          </label>
          <div className="sterilizer-batch-style" role="radiogroup" aria-label={tr('Αρίθμηση')}>
            <span>{tr('Αρίθμηση')}</span>
            <div>
              <label className={style === 'LETTERS' ? 'on' : ''}>
                <input
                  type="radio"
                  name="sterilizer-style"
                  checked={style === 'LETTERS'}
                  onChange={() => setStyle('LETTERS')}
                />
                A, B, C, D
              </label>
              <label className={style === 'NUMBERS' ? 'on' : ''}>
                <input
                  type="radio"
                  name="sterilizer-style"
                  checked={style === 'NUMBERS'}
                  onChange={() => setStyle('NUMBERS')}
                />
                1, 2, 3, 4
              </label>
            </div>
          </div>
          <label>
            {tr('Πλήθος κλιβάνων')}
            <input type="number" min={1} max={20} value={count} onChange={e => setCount(Number(e.target.value))} />
          </label>
          <div className="sterilizer-batch-preview">
            <span>{tr('Θα προστεθούν')}</span>
            <ul>
              {names.map(item => (
                <li key={item.name}>{item.name}</li>
              ))}
            </ul>
            {existing.length > 0 && (
              <small>
                {tr('Ονόματα που υπάρχουν ήδη παραλείπονται· η μονάδα κρατά την επιλογή για τις επόμενες φορές.')}
              </small>
            )}
            {english && english !== base.trim() && (
              <small>
                {tr('Στα αγγλικά θα εμφανίζεται ως') + ' '}
                <b>{english}</b>.
              </small>
            )}
          </div>
        </div>
        <footer>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton
            variant="primary"
            disabled={!names.length}
            onClick={() => onSave({base: base.trim() || naming.base, style}, names)}
          >
            {tr('Προσθήκη · {0}', String(names.length))}
          </AppButton>
        </footer>
      </aside>
    </div>
  );
}
