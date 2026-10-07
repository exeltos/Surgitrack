import {formatExpiry} from './sterileExpiry';

/**
 * The symbols printed next to the sterile dates (ISO 15223-1): the «STERILE» box for the sterilization
 * date and the hourglass for the use-by (expiry) date. Plain SVG strings, for print and labels.
 */
export const sterileSymbolSvg = (height = '1em') =>
  `<svg class="sym sym-sterile" style="height:${height};width:auto;vertical-align:-0.12em" viewBox="0 0 46 15" role="img" aria-label="STERILE"><rect x="0.6" y="0.6" width="44.8" height="13.8" fill="none" stroke="currentColor" stroke-width="1.2"/><text x="23" y="11" font-family="Arial,Helvetica,sans-serif" font-size="9.6" font-weight="700" text-anchor="middle" fill="currentColor">STERILE</text></svg>`;

export const expirySymbolSvg = (height = '1em') =>
  `<svg class="sym sym-expiry" style="height:${height};width:auto;vertical-align:-0.12em" viewBox="0 0 14 18" role="img" aria-label="Use by"><path d="M2 1h10M2 17h10M3 1.5c0 4 3.5 5.2 4 7.5c-.5 2.3-4 3.5-4 7.5M11 1.5c0 4-3.5 5.2-4 7.5c.5 2.3 4 3.5 4 7.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;

/** Plain-text marks for files (Excel): the same meaning without drawings. */
export const STERILE_MARK = 'STERILE';
export const EXPIRY_MARK = '⌛';

/** "STERILE 07/10/2026 ⌛ 07/04/2027" as HTML for prints and labels. */
export const sterileDatesHtml = (sterilizedOn?: string, sterileUntil?: string, height = '1em', short = false) => {
  // Labels are small: dd/mm/yy there.
  const date = (iso: string) => (short ? formatExpiry(iso).replace(/\/(\d{2})(\d{2})$/, '/$2') : formatExpiry(iso));
  return [
    sterilizedOn ? `<span class="sym-date">${sterileSymbolSvg(height)} ${date(sterilizedOn)}</span>` : '',
    sterileUntil ? `<span class="sym-date">${expirySymbolSvg(height)} ${date(sterileUntil)}</span>` : '',
  ]
    .filter(Boolean)
    .join(' ');
};
