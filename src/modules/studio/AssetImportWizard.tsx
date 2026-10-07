import {AlertTriangle, Building2, RotateCcw} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {STEPS, useAssetImport} from './import/useAssetImport';
import FileStep from './import/FileStep';
import MapStep from './import/MapStep';
import CheckStep from './import/CheckStep';
import DoneStep from './import/DoneStep';
import ImportHistory from './import/ImportHistory';

type Props = {
  lang: 'el' | 'en';
  organizations: Array<{id: string; name: string}>;
  departments: Array<{organizationId: string; name: string; code: string; active: boolean}>;
  byName: string;
  /** Standing alone on its own page (not inside Studio): its title is then the page's main heading. */
  asPage?: boolean;
};

/**
 * Studio → Εισαγωγή: Sets and instruments from an Excel or CSV file into a hospital, in four steps
 * (file, columns, check, import). Every import is logged and can be undone as a whole.
 */
export default function AssetImportWizard({asPage = false, ...props}: Props) {
  const s = useAssetImport(props);
  const {
    L,
    busy,
    error,
    needsReload,
    organizationId,
    setOrganizationId,
    setNeedsReload,
    step,
    stepIndex,
    plan,
    undoTarget,
    undo,
    setUndoTarget,
  } = s;
  const {organizations} = props;
  return (
    <div className="asset-import">
      <header className="asset-import-head">
        <div>
          <h2 {...(asPage ? {role: 'heading', 'aria-level': 1} : {})}>
            {L('Μαζική εισαγωγή εργαλείων και Σετ', 'Bulk import of instruments and Sets')}
          </h2>
          <p>
            {L(
              'Από Excel ή CSV, μία γραμμή ανά εργαλείο. Ελέγχεται πριν γραφτεί και αναιρείται ολόκληρη.',
              'From Excel or CSV, one row per instrument. Checked before writing and undone as a whole.',
            )}
          </p>
        </div>
        {organizations.length === 1 ? (
          <div className="asset-import-hospital chip">
            <Building2 size={16} />
            <b>{organizations[0].name}</b>
          </div>
        ) : (
          <label className="asset-import-hospital">
            {L('Νοσοκομείο', 'Hospital')}
            <select
              value={organizationId}
              disabled={step !== 'FILE' || Boolean(busy)}
              onChange={e => {
                setOrganizationId(e.target.value);
                setNeedsReload(false);
              }}
            >
              <option value="">{L('Επιλέξτε νοσοκομείο', 'Choose a hospital')}</option>
              {organizations.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      <ol className="asset-import-steps">
        {STEPS.map((s, i) => (
          <li key={s.id} className={i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}>
            <span>{i + 1}</span>
            {L(s.el, s.en)}
          </li>
        ))}
      </ol>

      {error && (
        <div className="asset-import-alert">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      )}
      {needsReload && (
        <div className="asset-import-note">
          <span>
            {L(
              'Έχετε ανοιχτό αυτό το νοσοκομείο. Ανανεώστε τη σελίδα για να δείτε τις αλλαγές στις λίστες.',
              'This hospital is open in your workspace. Reload the page to see the changes in the lists.',
            )}
          </span>
          <AppButton onClick={() => window.location.reload()}>
            <RotateCcw size={15} />
            {L('Ανανέωση', 'Reload')}
          </AppButton>
        </div>
      )}

      <section className="asset-import-body">
        {step === 'FILE' && <FileStep s={s} />}
        {step === 'MAP' && <MapStep s={s} />}
        {step === 'CHECK' && plan && <CheckStep s={s} />}
        {step === 'DONE' && plan && <DoneStep s={s} />}
      </section>
      <ImportHistory s={s} asPage={asPage} />
      {undoTarget && (
        <ConfirmDialog
          title={L('Αναίρεση εισαγωγής', 'Undo import')}
          message={L(
            `Θα διαγραφούν οριστικά ${undoTarget.sets} Σετ και ${undoTarget.tools} εργαλεία της εισαγωγής «${undoTarget.fileName}». Συνέχεια;`,
            `${undoTarget.sets} Sets and ${undoTarget.tools} instruments of import “${undoTarget.fileName}” will be deleted for good. Continue?`,
          )}
          confirmLabel={L('Αναίρεση εισαγωγής', 'Undo import')}
          danger
          onConfirm={() => void undo(undoTarget)}
          onClose={() => setUndoTarget(undefined)}
        />
      )}
    </div>
  );
}
