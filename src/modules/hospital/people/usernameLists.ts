import {escapeHtml} from '../../../core/escapeHtml';
import type {ExportTable} from '../../../core/exportTable';
import {markPrintHtml} from '../../../core/sampleDataMark';

export type UsernameRow = {department: string; name: string; userCode: string};

const byDepartmentThenName = (a: UsernameRow, b: UsernameRow) =>
  a.department.localeCompare(b.department, 'el') || a.name.localeCompare(b.name, 'el');

/** Department, full name and username, in department order, for Excel and CSV (never a password or a number). */
export const usernameTable = (rows: UsernameRow[], el: boolean, subtitle?: string): ExportTable => ({
  title: el ? 'Ονόματα χρήστη ανά τμήμα' : 'Usernames by department',
  subtitle,
  headers: el ? ['Τμήμα', 'Ονοματεπώνυμο', 'Όνομα χρήστη'] : ['Department', 'Full name', 'Username'],
  rows: [...rows].sort(byDepartmentThenName).map(r => [r.department, r.name, r.userCode]),
});

/**
 * One printed page per department (A4), each with the names and usernames of its people, to hand to the department:
 * the sheet says how to sign in the first time and carries no password.
 */
export const usernameSheetsHtml = (rows: UsernameRow[], el: boolean, lang: string, hospital?: string) => {
  const groups = new Map<string, UsernameRow[]>();
  for (const row of [...rows].sort(byDepartmentThenName))
    groups.set(row.department, [...(groups.get(row.department) || []), row]);
  const t = (greek: string, english: string) => escapeHtml(el ? greek : english);
  const sections = [...groups.entries()]
    .map(
      ([department, people]) => `<section>
<header><div><h1>${escapeHtml(department)}</h1><p>${t('Ονόματα χρήστη SurgiTrack', 'SurgiTrack usernames')}${hospital ? ` · ${escapeHtml(hospital)}` : ''}</p></div><small>${people.length} ${t('άτομα', 'people')}</small></header>
<table><thead><tr><th class="n">#</th><th>${t('Ονοματεπώνυμο', 'Full name')}</th><th>${t('Όνομα χρήστη', 'Username')}</th></tr></thead>
<tbody>${people.map((p, i) => `<tr><td class="n">${i + 1}</td><td>${escapeHtml(p.name)}</td><td class="u">${escapeHtml(p.userCode)}</td></tr>`).join('')}</tbody></table>
<p class="how">${t(
        'Στην πρώτη σύνδεση γράψτε το όνομα χρήστη (όχι email) και ως αρχικό κωδικό τον αριθμό του κινητού σας. Αμέσως μετά ορίστε δικό σας κωδικό: τουλάχιστον 10 χαρακτήρες, με γράμμα και αριθμό, όχι κάποιος πολύ κοινός.',
        'At the first sign-in enter the username (not an email) and your mobile number as the initial password. Then set a password of your own: at least 10 characters, with a letter and a number, not a common one.',
      )}</p>
</section>`,
    )
    .join('');
  return markPrintHtml(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${t('Ονόματα χρήστη ανά τμήμα', 'Usernames by department')}</title>
<style>
@page{size:A4 portrait;margin:14mm 14mm}
*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#1c2b33;font-size:11pt}
section{break-after:page}section:last-child{break-after:auto}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:.6mm solid #1d6b7a;padding-bottom:3mm;margin-bottom:5mm}
h1{margin:0;font-size:17pt}header p{margin:1mm 0 0;color:#5b6b75;font-size:9.5pt}header small{color:#5b6b75}
table{width:100%;border-collapse:collapse}thead{display:table-header-group}
th{background:#eef4f6;text-align:left;padding:2mm 2.5mm;font-size:9pt;letter-spacing:.05em;border-bottom:.35mm solid #9fb3bd}
td{padding:2.4mm 2.5mm;border-bottom:.2mm solid #dde5ea}tr{break-inside:avoid}
.n{width:9mm;color:#6a7a84;text-align:right}.u{font-family:Consolas,Menlo,monospace;font-weight:700;letter-spacing:.06em;font-size:12pt}
.how{margin-top:7mm;padding:3mm 4mm;background:#f4f7fa;border-radius:2mm;font-size:9.5pt;line-height:1.5;color:#3d4f5a}
@media screen{body{background:#e9eef1;padding:6mm}section{background:#fff;max-width:210mm;margin:0 auto 6mm;padding:12mm}}
</style></head><body>${sections || `<p>${t('Δεν υπάρχουν χρήστες.', 'There are no users.')}</p>`}</body></html>`);
};
