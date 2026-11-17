import {escapeHtml} from '../../core/escapeHtml';
import {getI18nLang, tr, trData} from '../../i18n';
import {TEST_KINDS} from '../../core/equipmentTests';
import type {EquipmentTestKind} from '../../core/libraries';

const ROWS = 14;

/**
 * The paper log of one sterilizer's (or washer's) tests, one A4 landscape page per test: the date, passed or
 * failed, a wide box to stick the indicator strip in (as with a Bowie-Dick sheet) and who did it.
 */
export function testLogHtml(hospital: string, equipment: string, kinds: readonly EquipmentTestKind[]) {
  const en = getI18nLang() === 'en';
  const washer = TEST_KINDS.find(kind => kind.id === kinds[0])?.equipment === 'WASHER';
  const pages = kinds
    .map(id => TEST_KINDS.find(kind => kind.id === id))
    .filter(Boolean)
    .map(kind => {
      const name = en ? kind!.en : kind!.el;
      const rows = Array.from(
        {length: ROWS},
        () => '<tr><td></td><td class="box"></td><td class="box"></td><td class="strip"></td><td></td></tr>',
      ).join('');
      return `<section class="page">
  <header><div><div class="brand">SurgiTrack</div><h1>${escapeHtml(washer ? tr('Έντυπο καταγραφής δοκιμών πλυντηρίου') : tr('Έντυπο καταγραφής δοκιμών κλιβάνου'))}</h1></div><div class="test">${escapeHtml(name)}<small>${escapeHtml(en ? kind!.hint.en : kind!.hint.el)}</small></div></header>
  <dl><div><dt>${escapeHtml(tr('Νοσοκομείο'))}</dt><dd>${escapeHtml(trData(hospital) || '')}</dd></div><div><dt>${escapeHtml(tr('Κλίβανος / συσκευή'))}</dt><dd>${escapeHtml(trData(equipment))}</dd></div><div><dt>${escapeHtml(tr('Μήνας / έτος'))}</dt><dd></dd></div></dl>
  <table><thead><tr><th class="date">${escapeHtml(tr('Ημερομηνία'))}</th><th class="box">${escapeHtml(tr('Επιτυχής'))}</th><th class="box">${escapeHtml(tr('Εσφαλμένη'))}</th><th>${escapeHtml(tr('Επικολλήστε τον δείκτη'))}</th><th class="who">${escapeHtml(tr('Ονοματεπώνυμο χρήστη'))}</th></tr></thead><tbody>${rows}</tbody></table>
  <p>${escapeHtml(washer ? tr('Σημειώστε με ✓ το αποτέλεσμα. Εσφαλμένη δοκιμή: το πλυντήριο δεν χρησιμοποιείται μέχρι επιτυχή επανάληψη.') : tr('Σημειώστε με ✓ το αποτέλεσμα. Εσφαλμένη δοκιμή: ο κλίβανος δεν χρησιμοποιείται μέχρι επιτυχή επανάληψη.'))}</p>
</section>`;
    })
    .join('');
  return `<!doctype html><html lang="${getI18nLang()}"><head><meta charset="utf-8"><title>${escapeHtml(tr('Δοκιμές · {0}', trData(equipment)))}</title><style>
@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#15232b;font-size:9pt}
.page{page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:.6mm solid #1d6b7a;padding-bottom:2.5mm}
.brand{font-size:12pt;font-weight:800;color:#1d6b7a;letter-spacing:.03em}h1{margin:1mm 0 0;font-size:14pt}
.test{text-align:right;font-size:12pt;font-weight:800}.test small{display:block;font-size:8pt;font-weight:400;color:#5f707b}
dl{display:grid;grid-template-columns:2fr 2fr 1fr;gap:4mm;margin:4mm 0}dl div{border-bottom:.3mm solid #9aa9b2;padding-bottom:1mm}dt{font-size:7pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6a7a84}dd{margin:.8mm 0 0;font-size:10pt;font-weight:700;min-height:4.5mm}
table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:.3mm solid #7d8d96;padding:1.5mm 2mm;text-align:left}th{background:#eef3f5;font-size:8pt}
th.date{width:28mm}th.box,td.box{width:22mm;text-align:center}th.who{width:62mm}td{height:9.5mm}td.strip{background:repeating-linear-gradient(90deg,transparent 0 9.5mm,#f3f6f7 9.5mm 10mm)}
p{margin:3mm 0 0;font-size:7.5pt;color:#5f707b}
</style></head><body>${pages}</body></html>`;
}
