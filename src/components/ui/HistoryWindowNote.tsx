import {useEffect} from 'react';
import {History} from 'lucide-react';
import {useHistoryWindow} from '../../data/cloud/historyWindow';
import type {CloudCollection} from '../../data/cloud/appRecords';
import {tr} from '../../i18n';

/**
 * The opening loads recent history only (T3). Where all of it matters (a report over the whole history) `auto`
 * loads the rest at once; elsewhere (History) a button does. `collections`: only the history this screen
 * shows (none: every kind). Shows nothing once that is loaded.
 */
export default function HistoryWindowNote({
  auto = false,
  collections,
}: {
  auto?: boolean;
  collections?: readonly CloudCollection[];
}) {
  const {windowed, loading, loadOlder} = useHistoryWindow(collections);
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
