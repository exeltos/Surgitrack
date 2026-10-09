#!/usr/bin/env node
/**
 * The illustrated user manual as a PDF, built from the in-app Help Center text (src/core/help/helpManual.ts)
 * and fresh screenshots from the screenshot harness, so the PDF always matches the app.
 *
 *   node scripts/manual/build.mjs [--lang el|en] [--out docs/SurgiTrack-manual-el.pdf] [--no-shots]
 *
 * --no-shots reuses the screenshots of the previous run.
 */
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const CACHE = join(ROOT, 'node_modules/.cache/surgitrack-manual');
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i < 0 ? fallback : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
};
const LANG = arg('lang', 'el') === 'en' ? 'en' : 'el';
const OUT = resolve(String(arg('out', join(ROOT, `docs/SurgiTrack-manual-${LANG}.pdf`))));
const SHOTS = join(CACHE, `shots-${LANG}`);
const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;

const T = {
  el: {
    title: 'Εγχειρίδιο χρήσης',
    subtitle: 'Ιχνηλασιμότητα χειρουργικών εργαλείων και Σετ',
    contents: 'Περιεχόμενα',
    who: 'Για ποιον',
    steps: 'Βήμα προς βήμα',
    checks: 'Έλεγχοι',
    tip: 'Συμβουλή',
    glossary: 'Γλωσσάρι',
    version: 'Έκδοση',
    page: 'Σελίδα',
    roles: 'Ρόλοι',
    roleRows: [
      ['Διαχειριστής νοσοκομείου', 'Χρήστες, τμήματα, Studio και όλες οι οθόνες του νοσοκομείου.'],
      ['Προϊστάμενος Αποστείρωσης', 'Ό,τι ο Χρήστης Αποστείρωσης, και καταχώριση Σετ και εργαλείων, σύνθεση, Service.'],
      ['Χρήστης Αποστείρωσης', 'Παραλαβή, έλεγχος και σύνθεση, κλίβανος, αποδέσμευση, παράδοση.'],
      ['Χρήστης Τμήματος', 'Τα Σετ και τα εργαλεία του τμήματός του: αποστολή, παραλαβή, καταμέτρηση, αναφορές.'],
      ['Παρατηρητής', 'Βλέπει όλο το νοσοκομείο χωρίς να αλλάζει τίποτα.'],
    ],
  },
  en: {
    title: 'User manual',
    subtitle: 'Surgical instrument and Set traceability',
    contents: 'Contents',
    who: 'Who it is for',
    steps: 'Step by step',
    checks: 'Checks',
    tip: 'Tip',
    glossary: 'Glossary',
    version: 'Version',
    page: 'Page',
    roles: 'Roles',
    roleRows: [
      ['Hospital admin', 'Users, departments, Studio and every screen of the hospital.'],
      [
        'Sterilization supervisor',
        'Everything a Sterilization user does, plus registering Sets and instruments, composition, Service.',
      ],
      ['Sterilization user', 'Receipt, check and composition, sterilizer, release, delivery.'],
      ['Department user', 'Their department’s Sets and instruments: dispatch, receipt, count, problem reports.'],
      ['Viewer', 'Sees the whole hospital without changing anything.'],
    ],
  },
}[LANG];

/** Which role and screenshot illustrate each Help Center section. */
const SHOT_FOR = {
  '/asset-card': ['admin', 'sets-detail'],
  '/department': ['department', 'department'],
  '/replacements': ['admin', 'issues-tab-replacements'],
  '/hospitals': null,
};

async function loadManual() {
  const esbuild = await import('esbuild');
  const outfile = join(CACHE, 'manual.mjs');
  mkdirSync(CACHE, {recursive: true});
  await esbuild.build({
    entryPoints: [join(ROOT, 'src/core/help/helpManual.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'warning',
  });
  return import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
}

function screenshots() {
  if (arg('no-shots', false) && existsSync(SHOTS)) return;
  for (const role of ['ADMIN', 'DEPARTMENT']) {
    const run = spawnSync(
      process.execPath,
      [
        join(ROOT, 'scripts/screens/capture.mjs'),
        '--lang',
        LANG,
        '--role',
        role,
        '--viewport',
        'desktop',
        '--no-extras',
        '--max-height',
        '900',
        '--out',
        SHOTS,
        ...(role === 'ADMIN' ? ['--rebuild'] : []),
      ],
      {stdio: 'inherit', cwd: ROOT},
    );
    if (run.status !== 0) process.exit(run.status ?? 1);
  }
  // Traceability with a search done, so the page shows its timeline.
  const search = `(async () => {
    const input = document.querySelector('.content input');
    if (!input) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'S000330');
    input.dispatchEvent(new Event('input', {bubbles: true}));
    await new Promise(r => setTimeout(r, 150));
    [...document.querySelectorAll('button')].find(b => /Αναζήτηση|Search/.test(b.textContent))?.click();
    await new Promise(r => setTimeout(r, 500));
  })()`;
  spawnSync(
    process.execPath,
    [
      join(ROOT, 'scripts/screens/capture.mjs'),
      '--lang',
      LANG,
      '--role',
      'ADMIN',
      '--viewport',
      'desktop',
      '--no-extras',
      '--max-height',
      '900',
      '--only',
      'traceability',
      '--out',
      SHOTS,
    ],
    {stdio: 'inherit', cwd: ROOT, env: {...process.env, SCREENS_BEFORE: search}},
  );
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
const slug = route => route.replace(/^\//, '').replace(/\//g, '-');

function shotFor(section) {
  if (section.guide) return null;
  const pick = section.to in SHOT_FOR ? SHOT_FOR[section.to] : ['admin', slug(section.to)];
  if (!pick) return null;
  const file = join(SHOTS, `${LANG}_${pick[0]}_desktop_${pick[1]}.png`);
  return existsSync(file) ? `data:image/png;base64,${readFileSync(file).toString('base64')}` : null;
}

function html({helpManual, glossary}) {
  const sections = helpManual.filter(s => s.to !== '/hospitals');
  const today = new Date().toLocaleDateString(LANG === 'el' ? 'el-GR' : 'en-GB');
  const body = sections
    .map((s, i) => {
      const img = shotFor(s);
      const chapters = s.chapters.map(c => `<h3>${esc(c[LANG][0])}</h3><p>${esc(c[LANG][1])}</p>`).join('');
      const steps = s.steps[LANG].map(x => `<li>${esc(x)}</li>`).join('');
      const checks = s.checks
        ? `<h3>${T.checks}</h3><ul>${s.checks[LANG].map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
        : '';
      const tip = s.tip ? `<aside class="tip"><b>${T.tip}.</b> ${esc(s.tip[LANG])}</aside>` : '';
      return `<section id="s${i}">
        <p class="eyebrow">${i + 1}</p><h2>${esc(s.title[LANG])}</h2>
        <p class="lead">${esc(s.summary[LANG])}</p>
        <p class="who"><b>${T.who}:</b> ${esc(s.audience[LANG])}</p>
        <div class="steps"><h3>${T.steps}</h3><ol>${steps}</ol></div>
        ${img ? `<figure><img src="${img}" alt=""></figure>` : ''}
        ${chapters}
        ${checks}${tip}
      </section>`;
    })
    .join('');
  const toc = sections.map((s, i) => `<li><a href="#s${i}">${i + 1}. ${esc(s.title[LANG])}</a></li>`).join('');
  const roles = T.roleRows.map(([r, d]) => `<tr><th>${esc(r)}</th><td>${esc(d)}</td></tr>`).join('');
  const terms = glossary.map(g => `<dt>${esc(g.term)}</dt><dd>${esc(g[LANG])}</dd>`).join('');
  return `<!doctype html><html lang="${LANG}"><head><meta charset="utf-8"><title>SurgiTrack · ${T.title}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm 20mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, 'Segoe UI', Arial, sans-serif; color: #1d2939; font-size: 10.5pt; line-height: 1.5; margin: 0; }
    .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
    .cover .mark { width: 22mm; height: 22mm; border-radius: 5mm; background: #167187; color: #fff; display: grid; place-items: center; font: 700 30pt Inter, Arial; }
    .cover h1 { font-size: 34pt; margin: 10mm 0 2mm; color: #17384a; }
    .cover p { font-size: 14pt; color: #475467; margin: 0; }
    .cover .meta { margin-top: 18mm; font-size: 10pt; color: #667085; }
    h2 { font-size: 19pt; color: #17384a; margin: 0 0 2mm; }
    h3 { font-size: 11.5pt; color: #155a6e; margin: 5mm 0 1mm; }
    p { margin: 0 0 2mm; }
    .eyebrow { color: #167187; font-weight: 700; font-size: 10pt; letter-spacing: .08em; margin: 0; }
    .lead { font-size: 12pt; color: #344054; }
    .who { color: #475467; font-size: 9.5pt; }
    section { page-break-before: always; }
    figure { margin: 4mm 0; border: 1px solid #dce7eb; border-radius: 3mm; overflow: hidden; }
    figure img { width: 100%; display: block; }
    .steps { background: #eef6f8; border-radius: 3mm; padding: 1mm 5mm 3mm; margin-top: 4mm; page-break-inside: avoid; }
    .tip { border-left: 3pt solid #b7791f; background: #fff8eb; padding: 3mm 4mm; margin-top: 4mm; page-break-inside: avoid; }
    ol, ul { margin: 1mm 0; padding-left: 6mm; }
    .toc { page-break-after: always; }
    .toc ol { list-style: none; padding: 0; columns: 2; column-gap: 10mm; }
    .toc li { margin: 1.5mm 0; }
    .toc a { color: #1d2939; text-decoration: none; }
    table { border-collapse: collapse; width: 100%; margin-top: 4mm; }
    th, td { text-align: left; vertical-align: top; padding: 2mm 3mm; border-bottom: 1px solid #e3e8ee; }
    th { width: 52mm; color: #17384a; }
    dl { columns: 2; column-gap: 10mm; }
    dt { font-weight: 700; color: #17384a; margin-top: 3mm; break-after: avoid; }
    dd { margin: 0; break-inside: avoid; }
  </style></head><body>
  <div class="cover"><div class="mark">S</div><h1>SurgiTrack</h1><p>${T.title}</p><p>${T.subtitle}</p>
    <p class="meta">${T.version} ${esc(version)} · ${today} · www.surgitrack.eu</p></div>
  <div class="toc"><h2>${T.contents}</h2><ol>${toc}<li><a href="#glossary">${T.glossary}</a></li></ol>
    <h2 style="margin-top:10mm">${T.roles}</h2><table>${roles}</table></div>
  ${body}
  <section id="glossary"><h2>${T.glossary}</h2><dl>${terms}</dl></section>
  </body></html>`;
}

async function main() {
  screenshots();
  const manual = await loadManual();
  const page = html(manual);
  mkdirSync(dirname(OUT), {recursive: true});
  writeFileSync(join(CACHE, `manual-${LANG}.html`), page);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
  const tab = await browser.newPage();
  await tab.setContent(page, {waitUntil: 'load'});
  await tab.pdf({
    path: OUT,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="font: 8pt Arial; color: #98a2b3; width: 100%; padding: 0 16mm; display: flex; justify-content: space-between;"><span>SurgiTrack · ${T.title}</span><span>${T.page} <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: {top: '18mm', bottom: '20mm', left: '16mm', right: '16mm'},
  });
  await browser.close();
  console.log(`Manual: ${OUT}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
