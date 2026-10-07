import {formatExpiry} from '../../core/sterileExpiry';
import {tr} from '../../i18n';

/** The «STERILE» box (ISO 15223-1) for the sterilization date. */
export function SterileSymbol() {
  return (
    <svg className="sym sym-sterile" viewBox="0 0 46 15" role="img" aria-label={tr('Ημερομηνία αποστείρωσης')}>
      <rect x="0.6" y="0.6" width="44.8" height="13.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <text
        x="23"
        y="11"
        fontFamily="Arial,Helvetica,sans-serif"
        fontSize="9.6"
        fontWeight="700"
        textAnchor="middle"
        fill="currentColor"
      >
        STERILE
      </text>
    </svg>
  );
}

/** The hourglass (ISO 15223-1, use-by date) for the expiry date. */
export function ExpirySymbol() {
  return (
    <svg className="sym sym-expiry" viewBox="0 0 14 18" role="img" aria-label={tr('Ημερομηνία λήξης')}>
      <path
        d="M2 1h10M2 17h10M3 1.5c0 4 3.5 5.2 4 7.5c-.5 2.3-4 3.5-4 7.5M11 1.5c0 4-3.5 5.2-4 7.5c.5 2.3 4 3.5 4 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Sterilization and expiry dates side by side, each with its symbol. */
export default function SterileDates({sterilizedOn, sterileUntil}: {sterilizedOn?: string; sterileUntil?: string}) {
  if (!sterilizedOn && !sterileUntil) return null;
  return (
    <span className="sterile-dates">
      {sterilizedOn && (
        <span title={tr('Ημερομηνία αποστείρωσης')}>
          <SterileSymbol /> {formatExpiry(sterilizedOn)}
        </span>
      )}
      {sterileUntil && (
        <span title={tr('Ημερομηνία λήξης')}>
          <ExpirySymbol /> {formatExpiry(sterileUntil)}
        </span>
      )}
    </span>
  );
}
