import {useEffect, useMemo} from 'react';
import {ChevronRight, Sun, X} from 'lucide-react';
import AppButton from '../ui/AppButton';
import {getRuntimeDataMode} from '../../config/dataMode';
import {briefingFor, greekVocative, type BriefingItem} from '../../core/briefing';
import {formatDate} from '../../core/displayDate';
import {isoDate, sterileExpiryList, expiryAlerts} from '../../core/sterileExpiry';
import {belowMinimum, minimumRows} from '../../core/stockMinimums';
import {getRealIdentity} from '../../data/cloud/identity';
import {useLibraries} from '../../core/LibraryStore';
import {useSurgi} from '../../store/SurgiStore';
import {tr} from '../../i18n';

const seenKey = (userId: string) => `surgitrack-briefing-seen:${userId}`;

/** Whether today's briefing is still to be shown to the signed-in person (once a day, per person). */
export function briefingDue() {
  const userId = getRuntimeDataMode() === 'PRODUCTION' ? getRealIdentity()?.id : undefined;
  if (!userId) return false;
  try {
    return localStorage.getItem(seenKey(userId)) !== isoDate(new Date());
  } catch {
    return false;
  }
}

const markSeen = () => {
  const userId = getRealIdentity()?.id;
  try {
    if (userId) localStorage.setItem(seenKey(userId), isoDate(new Date()));
  } catch {
    // Private mode: shown again next time.
  }
};

/**
 * The first thing after signing in each day: what waits for this person, by role, each line opening the
 * screen where it is dealt with. Nothing waiting, nothing shown.
 */
export default function Briefing({
  lang,
  name,
  accessRequests,
  screens,
  onOpen,
  onClose,
}: {
  lang: 'el' | 'en';
  name: string;
  accessRequests: number;
  screens: readonly string[];
  onOpen: (to: string) => void;
  onClose: () => void;
}) {
  const {role, currentUser, sets, tools, retiredTools, issues, processLoads, purchaseOrders} = useSurgi();
  const {systemSettings} = useLibraries();
  const items: BriefingItem[] = useMemo(
    () =>
      briefingFor({
        role,
        department: currentUser.department,
        sets,
        tools,
        issues,
        processLoads,
        expiry: expiryAlerts(sterileExpiryList(sets, tools)),
        outOfUse: retiredTools.filter(t => !t.retiredNoticeSeenAt).length,
        accessRequests,
        belowMinimum: belowMinimum(
          minimumRows([...tools, ...retiredTools], purchaseOrders, systemSettings.stockMinimums),
        ).length,
        screens,
      }),
    [
      role,
      currentUser.department,
      sets,
      tools,
      retiredTools,
      issues,
      processLoads,
      purchaseOrders,
      systemSettings,
      accessRequests,
      screens,
    ],
  );
  const empty = !items.length;
  useEffect(() => {
    if (!empty) return;
    markSeen();
    onClose();
  }, [empty, onClose]);
  if (empty) return null;
  const close = () => {
    markSeen();
    onClose();
  };
  const hour = new Date().getHours();
  const called = lang === 'el' ? greekVocative(name) : name;
  const greeting =
    hour >= 5 && hour < 12
      ? tr('Καλημέρα, {0}', called)
      : hour >= 12 && hour < 18
        ? tr('Καλό απόγευμα, {0}', called)
        : tr('Καλησπέρα, {0}', called);
  return (
    <div className="modal-backdrop confirm-dialog-backdrop" onMouseDown={e => e.currentTarget === e.target && close()}>
      <div className="confirm-dialog briefing-dialog" role="dialog" aria-modal="true" aria-labelledby="briefing-title">
        <header>
          <div className="confirm-icon briefing-icon">
            <Sun size={20} />
          </div>
          <div>
            <h3 id="briefing-title">{greeting}</h3>
            <p>{tr('Τι σας περιμένει σήμερα, {0}', formatDate(new Date()))}</p>
          </div>
          <button className="icon-button" onClick={close} aria-label={tr('Κλείσιμο')}>
            <X size={18} />
          </button>
        </header>
        <ul className="briefing-list">
          {items.map(i => (
            <li key={i.key}>
              <button
                type="button"
                className={`briefing-row tone-${i.tone}`}
                onClick={() => {
                  markSeen();
                  onOpen(i.to);
                }}
              >
                <b>{i.count}</b>
                <span>{i[lang]}</span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <footer>
          <AppButton variant="primary" autoFocus onClick={close}>
            {tr('Ξεκινάμε')}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
