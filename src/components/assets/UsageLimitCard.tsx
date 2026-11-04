import {Minus, Plus, TriangleAlert} from 'lucide-react';
import {useLibraries} from '../../core/LibraryStore';
import {tr} from '../../i18n';
export default function UsageLimitCard({
  uses,
  maxUses,
  description,
  fresh,
  onCorrect,
  onSetUses,
}: {
  uses: number;
  maxUses?: number;
  description: string;
  /** A use limit and no use counted: new (see core/usageStatus). */
  fresh?: boolean;
  /** Usage-limit managers only: corrects the recorded uses by one (a use counted by mistake, or missed). */
  onCorrect?: (delta: 1 | -1) => void;
  /** Usage-limit managers only: sets how many uses were made (an instrument that was in use before the system). */
  onSetUses?: (uses: number) => void;
}) {
  const {systemSettings} = useLibraries();
  const remaining = maxUses !== undefined ? Math.max(0, maxUses - uses) : undefined;
  const percent = maxUses ? Math.min(100, (uses / maxUses) * 100) : 0;
  const warning = remaining !== undefined && remaining <= systemSettings.usageWarningThreshold;
  return (
    <div className="usage-config-card usage-view-card">
      <div className="usage-config-head">
        <div>
          <strong>{tr('Όριο χρήσεων')}</strong>
          <span>{description}</span>
        </div>
        <span className="usage-type-badge">{maxUses ? tr('Περιορισμένων χρήσεων') : tr('Χωρίς όριο')}</span>
        {maxUses !== undefined && fresh && (
          <span className="usage-fresh-badge" title={tr('Έχει όριο χρήσεων και καμία χρήση ακόμα.')}>
            {tr('Αχρησιμοποίητο')}
          </span>
        )}
      </div>
      {maxUses !== undefined && (
        <>
          <div className="usage-config-limit usage-view-stats">
            <div>
              <span>{tr('Χρήσεις που έχουν γίνει')}</span>
              {onSetUses ? (
                <span className="usage-correct">
                  <input
                    type="number"
                    min={0}
                    max={maxUses}
                    defaultValue={uses}
                    key={uses}
                    aria-label={tr('Χρήσεις που έχουν γίνει')}
                    onBlur={e => {
                      const next = Math.min(maxUses, Math.max(0, Math.round(Number(e.target.value) || 0)));
                      if (next !== uses) onSetUses(next);
                      else e.target.value = String(uses);
                    }}
                  />
                </span>
              ) : onCorrect ? (
                <span className="usage-correct">
                  <strong>{uses}</strong>
                  <button
                    type="button"
                    onClick={() => onCorrect(-1)}
                    disabled={uses <= 0}
                    aria-label={tr('Μία χρήση λιγότερη')}
                    title={tr('Μία χρήση λιγότερη')}
                  >
                    <Minus size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onCorrect(1)}
                    disabled={uses >= maxUses}
                    aria-label={tr('Μία χρήση περισσότερη')}
                    title={tr('Μία χρήση περισσότερη')}
                  >
                    <Plus size={14} />
                  </button>
                </span>
              ) : (
                <strong>{uses}</strong>
              )}
            </div>
            <div className={warning ? 'warning' : ''}>
              <span>{tr('Υπόλοιπο χρήσεων')}</span>
              <strong>{remaining}</strong>
            </div>
            <div>
              <span>{tr('Αρχικό όριο')}</span>
              <strong>{maxUses}</strong>
            </div>
          </div>
          <div className="usage-limit-bar" aria-label={tr('Χρησιμοποιήθηκε {0}% του ορίου', Math.round(percent))}>
            <span style={{width: `${percent}%`}} />
          </div>
          {remaining === 0 && (
            <div className="usage-exhausted-warning">
              <TriangleAlert size={15} />
              <span>{tr('Εξαντλημένο: δεν απομένει καμία χρήση. Αποσύρετε το από τη χρήση.')}</span>
            </div>
          )}
          {warning && remaining !== 0 && (
            <div className="usage-threshold-warning">
              <TriangleAlert size={15} />
              <span>
                {tr('Απομένουν μόνο') + ' '}
                {remaining} {tr('χρήσεις. Το αντικείμενο εμφανίζεται στις ειδοποιήσεις.')}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
