import AppButton from '../../../components/ui/AppButton';
import ToolsPreview from './ToolsPreview';
import {SHOWN_ERRORS, type ImportState} from './useAssetImport';

export default function CheckStep({s}: {s: ImportState}) {
  const {
    plan: maybePlan,
    L,
    busy,
    final,
    nameWarnings,
    organization,
    progress,
    reset,
    respelled,
    setStep,
    setUniform,
    setUseExisting,
    start,
    uniform,
    useExisting,
  } = s;
  if (!maybePlan) return null;
  const plan = maybePlan;
  return (
    <div className="asset-import-check">
      <div className="asset-import-summary">
        <div>
          <span>{L('Γραμμές', 'Rows')}</span>
          <strong>{plan.rows}</strong>
        </div>
        <div>
          <span>{L('Σετ', 'Sets')}</span>
          <strong>{plan.sets.length}</strong>
          <small>{L(`${plan.setMembers} εργαλεία μέσα`, `${plan.setMembers} instruments inside`)}</small>
        </div>
        <div>
          <span>{L('Μεμονωμένα', 'Standalone')}</span>
          <strong>{plan.standalone}</strong>
        </div>
        <div>
          <span>{L('Απόθεμα', 'Stock')}</span>
          <strong>{plan.stock}</strong>
        </div>
        <div className={plan.errors.length ? 'bad' : 'good'}>
          <span>{L('Προβλήματα', 'Problems')}</span>
          <strong>{plan.errors.length}</strong>
        </div>
      </div>
      {plan.errors.length ? (
        <>
          <p className="asset-import-lead">
            {L(
              'Διορθώστε αυτές τις γραμμές στο αρχείο και ανεβάστε το ξανά. Δεν γράφτηκε τίποτα.',
              'Fix these rows in the file and upload it again. Nothing was written.',
            )}
          </p>
          <div className="asset-import-errors">
            {plan.errors.slice(0, SHOWN_ERRORS).map((issue, i) => (
              <div key={i}>
                <b>{L(`Γραμμή ${issue.row}`, `Row ${issue.row}`)}</b>
                <span>{issue.message}</span>
              </div>
            ))}
            {plan.errors.length > SHOWN_ERRORS && (
              <small>
                {L(
                  `…και ${plan.errors.length - SHOWN_ERRORS} ακόμη.`,
                  `…and ${plan.errors.length - SHOWN_ERRORS} more.`,
                )}
              </small>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="asset-import-lead">
            {L(
              `Όλα σωστά. Θα δημιουργηθούν ${plan.sets.length} Σετ και ${plan.tools.length} εργαλεία στο «${organization?.name}».`,
              `All good. ${plan.sets.length} Sets and ${plan.tools.length} instruments will be created in “${organization?.name}”.`,
            )}
          </p>
          <div className="asset-import-preview">
            {plan.sets.slice(0, 6).map(s => (
              <div key={s.id}>
                <b>
                  {s.barcode} · {s.name}
                </b>
                <small>
                  {s.department || L('Απόθεμα', 'Stock')} · {L(`${s.expected} εργαλεία`, `${s.expected} instruments`)}
                </small>
              </div>
            ))}
            {plan.sets.length > 6 && (
              <small>{L(`…και ${plan.sets.length - 6} ακόμη Σετ.`, `…and ${plan.sets.length - 6} more Sets.`)}</small>
            )}
          </div>
          {(respelled > 0 || nameWarnings.length > 0) && (
            <div className="asset-import-names">
              <b>{L('Ονομασίες', 'Names')}</b>
              {respelled > 0 && (
                <label>
                  <input type="checkbox" checked={uniform} onChange={e => setUniform(e.target.checked)} />
                  <span>
                    {L(
                      `Ενιαία γραφή σε ${respelled} εργαλεία (κεφαλαία χωρίς τόνους, κενά, γράμματα από λάθος πληκτρολόγιο, 12cm → 12 CM).`,
                      `One spelling for ${respelled} instruments (capitals without accents, spacing, letters typed on the wrong keyboard, 12cm → 12 CM).`,
                    )}
                  </span>
                </label>
              )}
              {nameWarnings.length > 0 && (
                <>
                  <label>
                    <input type="checkbox" checked={useExisting} onChange={e => setUseExisting(e.target.checked)} />
                    <span>
                      {L(
                        `Χρήση της ονομασίας που έχει ήδη ο ίδιος κωδικός στο νοσοκομείο (${nameWarnings.length} διαφορές).`,
                        `Use the name the same code already has in the hospital (${nameWarnings.length} differences).`,
                      )}
                    </span>
                  </label>
                  <div className="asset-import-name-diffs">
                    {nameWarnings.slice(0, 8).map(w => (
                      <div key={`${w.code}|${w.name}`}>
                        <code>{w.code}</code>
                        <span className="from">{w.name}</span>
                        <span className="to">{w.existing}</span>
                        <small>×{w.count}</small>
                      </div>
                    ))}
                    {nameWarnings.length > 8 && (
                      <small>
                        {L(`…και ${nameWarnings.length - 8} ακόμη.`, `…and ${nameWarnings.length - 8} more.`)}
                      </small>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <ToolsPreview plan={final ? {...plan, ...final} : plan} L={L} />
        </>
      )}
      {progress && (
        <div className="asset-import-progress">
          <div style={{width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%`}} />
          <small>
            {progress.done} / {progress.total}
          </small>
        </div>
      )}
      <footer className="asset-import-actions">
        <AppButton disabled={Boolean(busy)} onClick={() => setStep('MAP')}>
          {L('Πίσω', 'Back')}
        </AppButton>
        <AppButton disabled={Boolean(busy)} onClick={reset}>
          {L('Άλλο αρχείο', 'Another file')}
        </AppButton>
        <AppButton
          variant="primary"
          disabled={Boolean(plan.errors.length) || Boolean(busy) || !(plan.tools.length + plan.sets.length)}
          onClick={() => void start()}
        >
          {busy || L('Εισαγωγή', 'Import')}
        </AppButton>
      </footer>
    </div>
  );
}
