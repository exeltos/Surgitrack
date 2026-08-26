import {TriangleAlert} from 'lucide-react';
import {useLibraries} from '../../core/LibraryStore';
export default function UsageLimitCard({
  uses,
  maxUses,
  description,
}: {
  uses: number;
  maxUses?: number;
  description: string;
}) {
  const {systemSettings} = useLibraries();
  const remaining = maxUses !== undefined ? Math.max(0, maxUses - uses) : undefined;
  const percent = maxUses ? Math.min(100, (uses / maxUses) * 100) : 0;
  const warning = remaining !== undefined && remaining <= systemSettings.usageWarningThreshold;
  return (
    <div className="usage-config-card usage-view-card">
      <div className="usage-config-head">
        <div>
          <strong>Όριο χρήσεων</strong>
          <span>{description}</span>
        </div>
        <span className="usage-type-badge">{maxUses ? 'Περιορισμένων χρήσεων' : 'Χωρίς όριο'}</span>
      </div>
      {maxUses !== undefined && (
        <>
          <div className="usage-config-limit usage-view-stats">
            <div>
              <span>Χρήσεις που έχουν γίνει</span>
              <strong>{uses}</strong>
            </div>
            <div className={warning ? 'warning' : ''}>
              <span>Υπόλοιπο χρήσεων</span>
              <strong>{remaining}</strong>
            </div>
            <div>
              <span>Αρχικό όριο</span>
              <strong>{maxUses}</strong>
            </div>
          </div>
          <div className="usage-limit-bar" aria-label={`Χρησιμοποιήθηκε ${Math.round(percent)}% του ορίου`}>
            <span style={{width: `${percent}%`}} />
          </div>
          {warning && (
            <div className="usage-threshold-warning">
              <TriangleAlert size={15} />
              <span>Απομένουν μόνο {remaining} χρήσεις. Το αντικείμενο εμφανίζεται στις ειδοποιήσεις.</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
