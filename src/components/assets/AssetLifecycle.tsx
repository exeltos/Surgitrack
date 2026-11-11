import {Link} from 'react-router-dom';
import {ArrowRight, Check, Send} from 'lucide-react';
import {useLibraries} from '../../core/LibraryStore';
import {useAppPreferences} from '../../core/AppPreferences';
import {useSurgi} from '../../store/SurgiStore';
import {assetLifecycle, queueOfStage, type LifecycleStepId} from '../../core/assetLifecycle';
import {latestMovement} from '../../core/movementUndo';
import {tr} from '../../i18n';
import type {AssetKind} from '../../types/domain';
import AppButton from '../ui/AppButton';

const NEXT_TEXT: Record<LifecycleStepId, string> = {
  DEPARTMENT: 'Μετά τη χρήση, στείλτε το προς Αποστείρωση.',
  RECEIPT: 'Αναμένει φυσική παραλαβή από την Αποστείρωση.',
  WASHING: 'Αναμένει ολοκλήρωση του καθαρισμού.',
  PREPARATION: 'Έλεγχος εργαλείων και σύνθεση.',
  PACKAGING: 'Συσκευασία και σήμανση.',
  STERILIZATION: 'Φόρτωση σε κλίβανο και κύκλος αποστείρωσης.',
  RELEASE: 'Έλεγχος δεικτών και αποδέσμευση του φορτίου.',
  STORAGE: 'Έλεγχος ασφαλούς αποθήκευσης πριν την παράδοση.',
  DELIVERY: 'Έτοιμο για παραλαβή από το τμήμα.',
};

/**
 * Where a Set or instrument is on its way round (department, the stages of Sterilization, back to the department),
 * how long it has been at this step, and what comes next, with the button when the signed-in user is the one who acts.
 */
export default function AssetLifecycle({
  kind,
  id,
  state,
  barcode,
  onDispatch,
}: {
  kind: AssetKind;
  id: string;
  state: string;
  barcode: string;
  /** Sends it to Sterilization (when it is in the department and the user may). */
  onDispatch?: () => void;
}) {
  const {sterilizationWorkflow} = useLibraries();
  const {lang} = useAppPreferences();
  const {movements, can, processLoads} = useSurgi();
  const life = assetLifecycle(sterilizationWorkflow.stages, state);
  if (!life) return null;
  const label = (id: LifecycleStepId) => {
    if (id === 'DEPARTMENT') return tr('Στο τμήμα');
    const stage = sterilizationWorkflow.stages.find(item => item.id === id);
    return stage ? (lang === 'en' ? stage.labelEn : stage.labelEl) : id;
  };
  const currentId = life.steps[life.current];
  const since = latestMovement(movements, barcode)?.at;
  // In a sterilizer load that has not ended: the Sterilization screen lists it under the running cycles, not under Loading.
  const inRunningLoad = processLoads.some(
    load =>
      load.kind === 'STERILIZATION' &&
      load.status === 'OPEN' &&
      load.items.some(item => item.assetKind === kind && item.assetId === id),
  );
  const queue =
    currentId === 'STERILIZATION' && inRunningLoad
      ? 'IN_STERILIZER'
      : currentId === 'DEPARTMENT'
        ? ''
        : queueOfStage[currentId];
  const action =
    currentId === 'DEPARTMENT' ? (
      onDispatch ? (
        <AppButton variant="primary" icon={<Send size={16} />} onClick={onDispatch}>
          {tr('Προς Αποστείρωση')}
        </AppButton>
      ) : null
    ) : can('sterilization.workspace') ? (
      <Link className="app-button app-button-secondary app-button-md" to={`/sterilization?queue=${queue}`}>
        {tr('Άνοιγμα στην Αποστείρωση')}
        <ArrowRight size={15} />
      </Link>
    ) : null;
  return (
    <section className="asset-lifecycle" aria-label={tr('Πορεία στην Αποστείρωση')}>
      <ol className="asset-lifecycle-steps">
        {life.steps.map((id, index) => {
          const status = index < life.current ? 'done' : index === life.current ? 'current' : 'todo';
          return (
            <li key={id} className={status} aria-current={status === 'current' ? 'step' : undefined}>
              <i aria-hidden="true">{status === 'done' ? <Check size={13} /> : index + 1}</i>
              <span>{label(id)}</span>
            </li>
          );
        })}
      </ol>
      <div className="asset-lifecycle-next">
        <div>
          <small>{tr('ΕΠΟΜΕΝΟ ΒΗΜΑ')}</small>
          <strong>{tr(NEXT_TEXT[currentId])}</strong>
          <em>
            {tr('Τώρα: {0}', label(currentId))}
            {since ? ` · ${tr('από {0}', since)}` : ''}
          </em>
        </div>
        {action}
      </div>
    </section>
  );
}
