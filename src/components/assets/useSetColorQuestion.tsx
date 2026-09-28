import {useState, type ReactNode} from 'react';
import {Palette} from 'lucide-react';
import AppButton from '../ui/AppButton';
import ColorMarker from './ColorMarker';
import {useSurgi} from '../../store/SurgiStore';
import {EMPTY_COLOR_PLAN, effectiveToolMarker, sameMarker, type ColorPlan} from '../../core/colorTapes';
import {tr} from '../../i18n';
import type {SetAsset, Tool} from '../../types/domain';

type Conflict = {tool: Tool; tapes: string[]};
type Pending = {conflicts: Conflict[]; set: SetAsset; resolve: (plan: ColorPlan | null) => void};

/**
 * Before instruments join a Set: any instrument that already carries tape (its own, or the tape of
 * the Set it leaves) different from the new Set's color asks whether it keeps that tape or takes the
 * Set's. Resolves with the plan to apply after the move, or null when cancelled.
 */
export function useSetColorQuestion(): {
  ask: (toolIds: string[], setId: string) => Promise<ColorPlan | null>;
  dialog: ReactNode;
} {
  const {tools, sets} = useSurgi();
  const [pending, setPending] = useState<Pending | null>(null);

  const ask = (toolIds: string[], setId: string) =>
    new Promise<ColorPlan | null>(resolve => {
      const set = sets.find(s => s.id === setId);
      const conflicts: Conflict[] = set
        ? tools
            .filter(t => toolIds.includes(t.id) && t.setId !== setId && t.colorMode !== 'NONE')
            .map(t => ({
              tool: t,
              tapes: effectiveToolMarker(
                t,
                sets.find(s => s.id === t.setId),
              ),
            }))
            .filter(c => c.tapes.length > 0 && !sameMarker(c.tapes, set.colorTapes))
        : [];
      if (!set || !conflicts.length) {
        resolve(EMPTY_COLOR_PLAN);
        return;
      }
      setPending({conflicts, set, resolve});
    });

  const finish = (plan: ColorPlan | null) => {
    pending?.resolve(plan);
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
              {pending.conflicts.length === 1
                ? tr('Το εργαλείο έχει ήδη ταινία άλλου χρώματος')
                : tr('{0} εργαλεία έχουν ήδη ταινία άλλου χρώματος', pending.conflicts.length)}
            </h2>
          </div>
        </header>
        <div className="color-question-rows">
          {pending.conflicts.map(({tool, tapes}) => (
            <div key={tool.id}>
              <span>
                <b className="mono">{tool.barcode}</b> {tool.name}
              </span>
              <ColorMarker tapes={tapes} />
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
            'Να κρατήσει την ταινία που έχει ή να πάρει το χρώμα του Σετ; Αν πάρει του Σετ, αλλάξτε και την ταινία πάνω στο εργαλείο.',
          )}
        </p>
        <footer>
          <AppButton onClick={() => finish(null)}>{tr('Ακύρωση')}</AppButton>
          <AppButton
            onClick={() => finish({follow: [], keep: pending.conflicts.map(c => ({id: c.tool.id, tapes: c.tapes}))})}
          >
            {tr('Κρατά την ταινία του')}
          </AppButton>
          <AppButton
            variant="primary"
            onClick={() => finish({follow: pending.conflicts.map(c => c.tool.id), keep: []})}
          >
            {tr('Παίρνει το χρώμα του Σετ')}
          </AppButton>
        </footer>
      </div>
    </div>
  );
  return {ask, dialog};
}
