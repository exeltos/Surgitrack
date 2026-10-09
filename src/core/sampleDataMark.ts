/**
 * Exports and prints made from sample data (Demo mode, or a prospect's evaluation Demo) say so: a
 * "DEMO" mark across every printed page and in every downloaded file, so a Demo sheet can never
 * pass for a real hospital record. The workspace gate turns it on for those hospitals.
 */
import {tr} from '../i18n';
import type {ExportTable} from './exportTable';

let marked = false;

export const setSampleDataMark = (on: boolean) => {
  marked = on;
};
export const sampleDataMarked = () => marked;

/** The table with "DEMO" in its title and a line saying the data are sample data. */
export const markTable = (table: ExportTable): ExportTable =>
  marked
    ? {
        ...table,
        title: `DEMO · ${table.title}`,
        subtitle: [table.subtitle, tr('Δοκιμαστικά δεδομένα')].filter(Boolean).join(' · '),
      }
    : table;

const MARK = () =>
  `<style>.st-demo-mark{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:2147483647}` +
  `.st-demo-mark span{transform:rotate(-30deg);font:800 120px/1 Arial,sans-serif;letter-spacing:12px;color:rgba(190,30,30,.13);` +
  `-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
  `.st-demo-note{position:fixed;left:0;right:0;bottom:2mm;text-align:center;font:700 9px Arial,sans-serif;color:#be1e1e;pointer-events:none;z-index:2147483647}</style>` +
  `<div class="st-demo-mark" aria-hidden="true"><span>DEMO</span></div>` +
  `<div class="st-demo-note">DEMO · ${tr('Δοκιμαστικά δεδομένα')}</div>`;

/** A print page with the DEMO mark (before its closing body tag, or at its end). */
export const markPrintHtml = (html: string) => {
  if (!marked || html.includes('st-demo-mark')) return html;
  const at = html.lastIndexOf('</body>');
  return at >= 0 ? html.slice(0, at) + MARK() + html.slice(at) : html + MARK();
};
