import {X} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import {wholeHospital} from '../hospitalPeopleMeta';
import type {PeopleState} from './usePeople';

export default function CsvDialog({s}: {s: PeopleState}) {
  const {L, busy, csvRows, roleLabel, sendCsv, setCsvRows} = s;
  return (
    <>
      {csvRows && (
        <div className="studio-drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && setCsvRows(null)}>
          <aside className="studio-drawer">
            <header>
              <div>
                <span className="eyebrow">{L('ΠΡΟΣΚΛΗΣΗ', 'INVITATION')}</span>
                <h2>{L('Προσκλήσεις από αρχείο', 'Invitations from a file')}</h2>
              </div>
              <button onClick={() => setCsvRows(null)} aria-label={L('Κλείσιμο', 'Close')}>
                <X />
              </button>
            </header>
            <div className="studio-drawer-form">
              {csvRows.length === 0 && (
                <p className="hospital-empty">{L('Το αρχείο δεν έχει γραμμές.', 'The file has no rows.')}</p>
              )}
              <div className="people-csv">
                {csvRows.map((r, i) => (
                  <div key={i} className={r.error ? 'error' : ''}>
                    <b>{r.name || '—'}</b>
                    <small>
                      {r.email} · {roleLabel(r.role)}
                      {!wholeHospital(r.role) && ` · ${r.department || '—'}`}
                    </small>
                    {r.error && <em>{r.error}</em>}
                  </div>
                ))}
              </div>
            </div>
            <footer>
              <AppButton onClick={() => setCsvRows(null)}>{L('Ακύρωση', 'Cancel')}</AppButton>
              <AppButton
                variant="primary"
                disabled={busy || !csvRows.length || csvRows.some(r => r.error)}
                onClick={() => void sendCsv()}
              >
                {L(`Αποστολή ${csvRows.length} προσκλήσεων`, `Send ${csvRows.length} invitations`)}
              </AppButton>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}
