/**
 * Exports and prints made from sample data (Demo mode, or a prospect's evaluation Demo) say so: a
 * "DEMO" mark across every printed page and in every downloaded file, so a Demo sheet can never
 * pass for a real hospital record. The workspace gate turns it on for those hospitals.
 */
import {tr} from '../i18n';
import type {ExportTable} from './exportTable';
import {printFrameCss} from './printStamp';

let marked = false;

export const setSampleDataMark = (on: boolean) => {
  marked = on;
};

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

const FRAMED = '<!--st-print-frame-->';
const beforeBody = (html: string, extra: string) => {
  const at = html.lastIndexOf('</body>');
  return at >= 0 ? html.slice(0, at) + extra + html.slice(at) : html + extra;
};

/**
 * A print page as it goes to paper: an A4 page gets the common foot (hospital, printed when and by whom, page X / Y;
 * see printStamp), and sample data the DEMO mark. A label, and an A4 form with no page margin, keep their page as it is.
 */
export const markPrintHtml = (html: string) => {
  let out = html;
  // An A4 page with no margin (the count form lays out its own head and foot) has nowhere to put the foot.
  const a4 = /@page\s*\{[^}]*size:\s*A4/i.test(out) && !/@page\s*\{[^}]*margin:\s*0\s*[;}]/i.test(out);
  if (a4 && !out.includes(FRAMED)) out = beforeBody(out, FRAMED + printFrameCss());
  if (marked && !out.includes('st-demo-mark')) out = beforeBody(out, MARK());
  return out;
};
