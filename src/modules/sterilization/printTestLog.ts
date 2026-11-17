import {escapeHtml} from '../../core/escapeHtml';
import {getI18nLang, tr, trData} from '../../i18n';
import {TEST_KINDS, itemTestStandings, testKindsOf} from '../../core/equipmentTests';
import {parseDisplayDate} from '../../core/displayDate';
import type {EquipmentTest, EquipmentTestKind, TestedEquipment} from '../../core/libraries';

type Machine = {el: string; tests?: EquipmentTest[]; testKinds?: EquipmentTestKind[]; outOfService?: unknown};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * The day's test sheet of all the sterilizers (or washers), in the style of the composition sheet: a line per
 * machine and test it is held to (its daily tests, and a weekly one when due or done today), with a box to stick
 * the indicator in. What was recorded today is filled in already: the time, the result and the user's full name.
 */
export function dailyTestLogHtml(
  hospital: string,
  machines: readonly Machine[],
  equipment: TestedEquipment = 'STERILIZER',
  now = new Date(),
) {
  const en = getI18nLang() === 'en';
  const washer = equipment === 'WASHER';
  const day = now.toLocaleDateString(en ? 'en-GB' : 'el-GR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const lines: string[] = [];
  for (const machine of machines) {
    if (machine.outOfService) continue;
    const kinds = testKindsOf(machine, equipment);
    const standings = itemTestStandings(machine, now.getTime(), equipment);
    const rows = kinds
      .map(id => TEST_KINDS.find(kind => kind.id === id)!)
      .filter(Boolean)
      .map(kind => {
        const today = (machine.tests || [])
          .filter(test => test.kind === kind.id)
          .find(test => {
            const at = parseDisplayDate(test.at);
            return !!at && sameDay(at, now);
          });
        const due = standings.find(s => s.kind === kind.id)?.due;
        return {kind, today, show: kind.days === 1 || !!today || !!due};
      })
      .filter(row => row.show);
    rows.forEach(({kind, today}, i) => {
      const machineCell =
        i === 0 ? `<td class="machine" rowspan="${rows.length}">${escapeHtml(trData(machine.el))}</td>` : '';
      const result = today
        ? `<td class="res ${today.result === 'PASS' ? 'ok' : 'bad'}">${escapeHtml(today.result === 'PASS' ? tr('Επιτυχής') : tr('Εσφαλμένη'))}</td>`
        : `<td class="res"><span class="box"></span>${escapeHtml(tr('Επιτυχής'))}<span class="box gap"></span>${escapeHtml(tr('Εσφαλμένη'))}</td>`;
      lines.push(
        `<tr>${machineCell}<td class="name">${escapeHtml(en ? kind.en : kind.el)}<small>${escapeHtml(en ? kind.hint.en : kind.hint.el)}</small></td><td class="time">${escapeHtml(today ? today.at.slice(-5) : '')}</td>${result}<td class="strip"></td><td class="who">${escapeHtml(today ? trData(today.by) : '')}</td></tr>`,
      );
    });
  }
  const title = washer ? tr('Ημερήσιο έντυπο δοκιμών πλυντηρίων') : tr('Ημερήσιο έντυπο δοκιμών κλιβάνων');
  const meta = [
    [tr('Νοσοκομείο'), trData(hospital) || '—'],
    [tr('Ημερομηνία'), day],
    [washer ? tr('Πλυντήρια') : tr('Κλίβανοι'), String(machines.filter(m => !m.outOfService).length)],
  ]
    .map(([k, v]) => `<div><b>${escapeHtml(k)}</b><span>${escapeHtml(v)}</span></div>`)
    .join('');
  return `<!doctype html><html lang="${getI18nLang()}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
@page{size:A4 landscape;margin:10mm 11mm 12mm;@bottom-right{content:counter(page) " / " counter(pages);font:7pt Arial,sans-serif;color:#667}}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#15232b;font-size:9pt}
.top{padding-bottom:3mm;border-bottom:.6mm solid #1d6b7a}
.brand{font-size:13pt;font-weight:800;letter-spacing:.03em;color:#1d6b7a}.doc{font-size:7pt;font-weight:700;letter-spacing:.12em;color:#5f707b;text-transform:uppercase;margin-top:2mm}
h1{margin:1mm 0 0;font-size:15pt;line-height:1.15}
.meta{display:grid;grid-template-columns:2fr 2fr 1fr;margin:4mm 0;border:.25mm solid #d7e0e5;border-radius:2mm;overflow:hidden}.meta div{padding:2mm 3mm;border-right:.25mm solid #e3e9ec}.meta div:last-child{border-right:0}.meta b{display:block;font-size:6.5pt;font-weight:700;letter-spacing:.06em;color:#6a7a84;text-transform:uppercase;margin-bottom:.6mm}.meta span{font-size:9pt;font-weight:700}
table{width:100%;border-collapse:collapse;table-layout:fixed}thead th{background:#eef3f5;color:#5f707b;font-size:6.5pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;text-align:left;padding:2mm;border-bottom:.3mm solid #c9d4da}
td{padding:1.6mm 2mm;border-bottom:.25mm solid #e1e7ea;height:13mm;vertical-align:middle}
tr{page-break-inside:avoid;break-inside:avoid}
th.machine{width:38mm}td.machine{font-weight:800;font-size:10pt;border-right:.25mm solid #e1e7ea;background:#f8fafb}
th.name{width:44mm}td.name{font-weight:700}td.name small{display:block;font-weight:400;font-size:7pt;color:#6a7a84;margin-top:.5mm}
th.time{width:16mm}th.res{width:44mm}th.who{width:46mm}
td.res{font-size:8pt;color:#3d4f5a}td.res.ok{color:#1b7a43;font-weight:700}td.res.bad{color:#b4232a;font-weight:700}
.box{display:inline-block;width:3.2mm;height:3.2mm;border:.3mm solid #7d8d96;border-radius:.6mm;margin:0 1mm -.6mm 0}.box.gap{margin-left:3mm}
td.strip{border-left:.25mm dashed #b8c4ca;border-right:.25mm dashed #b8c4ca}td.who{font-weight:700}
.foot{display:flex;justify-content:space-between;margin-top:3mm;font-size:7pt;color:#6a7a84}
</style></head><body>
<div class="top"><div class="brand">SurgiTrack</div><div class="doc">${escapeHtml(title)}</div><h1>${escapeHtml(day)}</h1></div>
<div class="meta">${meta}</div>
<table><thead><tr><th class="machine">${escapeHtml(washer ? tr('Πλυντήριο') : tr('Κλίβανος'))}</th><th class="name">${escapeHtml(tr('Δοκιμή'))}</th><th class="time">${escapeHtml(tr('Ώρα'))}</th><th class="res">${escapeHtml(tr('Αποτέλεσμα'))}</th><th>${escapeHtml(tr('Επικολλήστε τον δείκτη'))}</th><th class="who">${escapeHtml(tr('Ονοματεπώνυμο χρήστη'))}</th></tr></thead><tbody>${lines.join('')}</tbody></table>
<div class="foot"><span>${escapeHtml(tr('Ό,τι καταγράφηκε σήμερα στην εφαρμογή είναι ήδη συμπληρωμένο· τα υπόλοιπα συμπληρώνονται με το χέρι.'))}</span><span>${escapeHtml(washer ? tr('Εσφαλμένη δοκιμή: το πλυντήριο δεν χρησιμοποιείται μέχρι επιτυχή επανάληψη.') : tr('Εσφαλμένη δοκιμή: ο κλίβανος δεν χρησιμοποιείται μέχρι επιτυχή επανάληψη.'))}</span></div>
</body></html>`;
}
