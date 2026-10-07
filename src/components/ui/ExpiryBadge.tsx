import {tr} from '../../i18n';
import type {ExpiryStatus} from '../../core/sterileExpiry';

/** How long a sterile Set or instrument has left, or since when it expired. */
export default function ExpiryBadge({entry}: {entry: ExpiryStatus}) {
  if (entry.state === 'EXPIRED')
    return <span className="expiry-badge expired">{tr('Έληξε πριν {0} ημ.', -entry.daysLeft)}</span>;
  if (entry.state === 'EXPIRING')
    return (
      <span className="expiry-badge expiring">
        {entry.daysLeft === 0 ? tr('Λήγει σήμερα') : tr('Λήγει σε {0} ημ.', entry.daysLeft)}
      </span>
    );
  return <span className="expiry-badge ok">{tr('{0} ημέρες', entry.daysLeft)}</span>;
}
