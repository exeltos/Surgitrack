import {formatExpiry, sterilizedOnOf} from '../../core/sterileExpiry';
import {tr} from '../../i18n';

/** Sterilization and expiry dates side by side, each with its word («Αποστείρωση», «Λήξη»), no symbols. */
export default function SterileDates(asset: {sterilizedOn?: string; sterileUntil?: string; shelfLifeMonths?: number}) {
  const {sterileUntil} = asset;
  const sterilizedOn = sterilizedOnOf(asset);
  if (!sterilizedOn && !sterileUntil) return null;
  return (
    <span className="sterile-dates">
      {sterilizedOn && (
        <span title={tr('Ημερομηνία αποστείρωσης')}>
          {tr('Αποστείρωση')} {formatExpiry(sterilizedOn)}
        </span>
      )}
      {sterileUntil && (
        <span title={tr('Ημερομηνία λήξης')}>
          {tr('Λήξη')} {formatExpiry(sterileUntil)}
        </span>
      )}
    </span>
  );
}
