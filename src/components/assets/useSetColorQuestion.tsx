import {useState, type ReactNode} from 'react';
import {Palette} from 'lucide-react';
import AppButton from '../ui/AppButton';
import ColorMarker from './ColorMarker';
import {useSurgi} from '../../store/SurgiStore';
import {sameMarker} from '../../core/colorTapes';
import {tr} from '../../i18n';
import type {SetAsset, Tool} from '../../types/domain';

type Pending = {tools: Tool[]; set: SetAsset; resolve: (followIds: string[] | null) => void};

/**
 * Before instruments join a Set: those with their own color marker, different from the Set's,
 * ask whether to keep it or take the Set's. Resolves with the ids that take the Set's color
 * ([] when nothing needs asking) or null when cancelled.
 */
export function useSetColorQuestion(): {
  ask: (toolIds: string[], setId: string) => Promise<string[] | null>;
  dialog: ReactNode;
} {
  const {tools, sets} = useSurgi();
  const [pending, setPending] = useState<Pending | null>(null);

  const ask = (toolIds: string[], setId: string) =>
    new Promise<string[] | null>(resolve => {
      const set = sets.find(s => s.id === setId);
      const conflicted = set
        ? tools.filter(
            t =>
              toolIds.includes(t.id) &&
              t.colorMode === 'OWN' &&
              (t.colorTapes?.length || 0) > 0 &&
              !sameMarker(t.colorTapes, set.colorTapes),
          )
        : [];
      if (!set || !conflicted.length) {
        resolve([]);
        return;
      }
      setPending({tools: conflicted, set, resolve});
    });

  const finish = (result: string[] | null) => {
    pending?.resolve(result);
    setPending(null);
  };

  const dialog = pending && (
    <div className="modal-backdrop nested-color-question">
      <div className="color-question-modal" role="dialog" aria-modal="true">
        <header>
          <Palette size={20} />
          <div>
            <span className="eyebrow">{tr('ΧΡΩΜΑΤΙΚΟΣ ΜΑΡΤΥΡΑΣ')}</span>
            <h2>
              {pending.tools.length === 1
                ? tr('Το εργαλείο έχει δικό του χρώμα')
                : tr('{0} εργαλεία έχουν δικό τους χρώμα', pending.tools.length)}
            </h2>
          </div>
        </header>
        <div className="color-question-rows">
          {pending.tools.map(t => (
            <div key={t.id}>
              <span>
                <b className="mono">{t.barcode}</b> {t.name}
              </span>
              <ColorMarker tapes={t.colorTapes} />
            </div>
          ))}
          <div className="color-question-set">
            <span>
              {tr('Χρώμα του Σετ')} <b className="mono">{pending.set.barcode}</b>
            </span>
            <ColorMarker tapes={pending.set.colorTapes} empty={tr('Το Σετ δεν έχει χρώμα')} />
          </div>
        </div>
        <p>
          {tr(
            'Να κρατήσει το δικό του χρώμα ή να πάρει του Σετ; Αν πάρει του Σετ, αλλάξτε και την ταινία πάνω στο εργαλείο.',
          )}
        </p>
        <footer>
          <AppButton onClick={() => finish(null)}>{tr('Ακύρωση')}</AppButton>
          <AppButton onClick={() => finish([])}>{tr('Κρατά το δικό του')}</AppButton>
          <AppButton variant="primary" onClick={() => finish(pending.tools.map(t => t.id))}>
            {tr('Παίρνει του Σετ')}
          </AppButton>
        </footer>
      </div>
    </div>
  );
  return {ask, dialog};
}
