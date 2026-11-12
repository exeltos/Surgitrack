import {Link} from 'react-router-dom';
import {ArrowRight, Check} from 'lucide-react';
import {useLibraries} from '../../core/LibraryStore';
import {useAppPreferences} from '../../core/AppPreferences';
import {useSurgi} from '../../store/SurgiStore';
import {assetLifecycle, queueOfStage, type LifecycleStepId} from '../../core/assetLifecycle';
import {latestMovement} from '../../core/movementUndo';
import {tr} from '../../i18n';
import type {AssetKind} from '../../types/domain';

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
}: {
  kind: AssetKind;
  id: string;
  state: string;
  barcode: string;
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
  // The dispatch button is the page's own («Προς Αποστείρωση», top right): here only the way into the stage it is at.
  const action =
    currentId !== 'DEPARTMENT' && can('sterilization.workspace') ? (
      <Link className="asset-lifecycle-link" to={`/sterilization?queue=${queue}`}>
        {tr('Άνοιγμα στην Αποστείρωση')}
        <ArrowRight size={14} />
      </Link>
    ) : null;
  return (
    <section className="asset-lifecycle">
      {/* On a narrow screen the steps scroll sideways: the region takes the keyboard focus so they can be reached. */}
      <div className="asset-lifecycle-scroll" role="region" tabIndex={0} aria-label={tr('Πορεία στην Αποστείρωση')}>
        <ol className="asset-lifecycle-steps">
          {life.steps.map((id, index) => {
            const status = index < life.current ? 'done' : index === life.current ? 'current' : 'todo';
            return (
              <li key={id} className={status} aria-current={status === 'current' ? 'step' : undefined}>
                {status === 'done' && <Check size={13} aria-hidden="true" />}
                <span>{label(id)}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="asset-lifecycle-next">
        <b>{tr('ΕΠΟΜΕΝΟ ΒΗΜΑ')}</b>
        <span>{tr(NEXT_TEXT[currentId])}</span>
        {since && <em>{tr('Στο στάδιο από {0}', since)}</em>}
        {action}
      </p>
    </section>
  );
}
