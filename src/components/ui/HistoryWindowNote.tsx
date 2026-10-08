import {useEffect} from 'react';
import {History} from 'lucide-react';
import {useHistoryWindow} from '../../data/cloud/historyWindow';
import {tr} from '../../i18n';

/**
 * The opening loads recent history only (T3). Where all of it matters (Traceability, Reports) `auto`
 * loads the rest at once; elsewhere (History) a button does. Shows nothing once everything is loaded.
 */
export default function HistoryWindowNote({auto = false}: {auto?: boolean}) {
  const {windowed, loading, loadOlder} = useHistoryWindow();
  useEffect(() => {
    if (auto && windowed) void loadOlder();
  }, [auto, windowed, loadOlder]);
  if (!windowed) return null;
  return (
    <div className="history-window-note" role="status">
      <History size={15} />
      <span>
        {loading ? tr('Φόρτωση του παλαιότερου ιστορικού…') : tr('Εμφανίζεται το ιστορικό των τελευταίων 90 ημερών.')}
      </span>
      {!loading && !auto && (
        <button type="button" onClick={() => void loadOlder()}>
          {tr('Φόρτωση παλαιότερων')}
        </button>
      )}
    </div>
  );
}
