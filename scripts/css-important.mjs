#!/usr/bin/env node
/**
 * Drops the !important of declarations that the screenshot harness proved need it nowhere.
 *
 *   SCREENS_EVAL="$(cat scripts/screens/important-probe.js)" node scripts/screens/capture.mjs --out <dir> …
 *   node scripts/css-important.mjs <dir>/index.json … --candidates <probe.js>    report; write the second pass
 *   SCREENS_EVAL="$(cat <probe.js>)" node scripts/screens/capture.mjs --out <dir2> …
 *   node scripts/css-important.mjs <dir>/index.json … <dir2>/index.json --fix    drop them
 *
 * The probe, on every captured page, drops each !important on its own and compares what the browser
 * computes; it reports each declaration it could check ("context|selector|longhand") and those that
 * changed something. A declaration here loses its !important only when every longhand it sets was
 * checked on at least one page and changed nothing on any page. Anything the pages never showed
 * (a state like :hover, a screen size not captured, a rule that matched nothing) keeps it.
 * Check the result with a full before/after capture (scripts/screens/README.md).
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import postcss from 'postcss';
import {chromium} from 'playwright';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const styles = join(root, 'src/styles');
const entry = join(styles, 'global.css');
const fix = process.argv.includes('--fix');
const candidatesAt = process.argv.indexOf('--candidates');
const candidatesFile = candidatesAt > 0 ? process.argv[candidatesAt + 1] : undefined;
const indexes = process.argv.slice(2).filter(a => !a.startsWith('--') && a !== candidatesFile);
if (!indexes.length) {
  console.error('Give the index.json of a capture run with the important probe.');
  process.exit(2);
}

// What the pages showed.
// First pass ({seen, changed}): each declaration on its own. Second pass ({kept}): the candidates of
// the first pass dropped together; those that then changed something keep their !important.
const seen = new Set();
const changed = new Set();
const kept = new Set();
let pages = 0;
for (const file of indexes) {
  for (const shot of JSON.parse(readFileSync(file, 'utf8'))) {
    const probe = shot.state?.probe;
    if (!probe || typeof probe !== 'object') continue;
    pages++;
    probe.seen?.forEach(k => seen.add(k));
    probe.changed?.forEach(k => changed.add(k));
    probe.kept?.forEach(k => kept.add(k));
  }
}
if (!pages) {
  console.error('No probe results in these files.');
  process.exit(2);
}

// The same spelling as the probe's keys (the browser's serialization).
const space = s => s.replace(/\s+/g, ' ').trim();
const normSelector = s =>
  space(s)
    .replace(/\s*([>+~,])\s*/g, '$1')
    .replace(/\[([^\]=]+)=["']?([^"'\]]*)["']?\]/g, '[$1="$2"]')
    .replace(/(^|[^:]):(before|after|placeholder|selection|marker|first-line|first-letter)\b/g, '$1::$2');
const normContext = s => s.replace(/\s+/g, '');
const contextOf = node => {
  const parts = [];
  for (let p = node.parent; p && p.type !== 'root'; p = p.parent)
    if (p.type === 'atrule') parts.unshift(`@${p.name} ${normContext(p.params)}`);
  return parts.join(' | ');
};

const entryCss = readFileSync(entry, 'utf8');
const files = [...entryCss.matchAll(/@import\s+['"](.+?)['"]/g)].map(m => join(styles, m[1])).concat(entry);
const trees = files.map(file => ({file, tree: postcss.parse(readFileSync(file, 'utf8'), {from: file})}));

const decls = [];
for (const {file, tree} of trees)
  tree.walkDecls(decl => {
    if (!decl.important || decl.parent?.type !== 'rule') return;
    if (decl.parent.parent?.type === 'atrule' && /keyframes$/i.test(decl.parent.parent.name)) return;
    decls.push({file, decl});
  });

// The longhands each property sets, as the browser expands it.
const browser = await chromium.launch();
const page = await browser.newPage();
// Every declaration of the rules concerned: a later one in the same rule matters too (below).
const ruleDecls = [...new Set(decls.map(({decl}) => decl.parent))].flatMap(rule =>
  rule.nodes.filter(n => n.type === 'decl'),
);
const pairs = [...new Map(ruleDecls.map(decl => [`${decl.prop}:${decl.value}`, [decl.prop, decl.value]])).values()];
const longhands = new Map(
  await page.evaluate(list => {
    const el = document.createElement('div');
    return list.map(([prop, value]) => {
      el.removeAttribute('style');
      el.style.setProperty(prop, value);
      const names = [];
      for (let i = 0; i < el.style.length; i++) names.push(el.style[i]);
      return [`${prop}:${value}`, names.length ? names : [prop]];
    });
  }, pairs),
);
await browser.close();

const byFile = new Map();
const candidateKeys = new Set();
let removable = 0;
for (const {file, decl} of decls) {
  // The probe names a declaration as the browser serializes it: the property itself (a shorthand
  // where it can), or its longhands.
  const at = `${contextOf(decl.parent)}|${normSelector(decl.parent.selector)}|`;
  const keys = seen.has(at + decl.prop)
    ? [at + decl.prop]
    : longhands.get(`${decl.prop}:${decl.value}`).map(name => at + name);
  if (!keys.every(k => seen.has(k) && !changed.has(k) && !kept.has(k))) continue;
  // A later declaration of the same rule setting the same longhand: the browser drops it while this
  // one is !important, so the pages could not show it; without the !important it would win.
  const mine = new Set(longhands.get(`${decl.prop}:${decl.value}`));
  let later = false;
  for (let n = decl.next(); n; n = n.next())
    if (n.type === 'decl' && longhands.get(`${n.prop}:${n.value}`).some(name => mine.has(name))) later = true;
  if (later) continue;
  removable++;
  keys.forEach(k => candidateKeys.add(k));
  byFile.set(file, (byFile.get(file) || 0) + 1);
  if (fix) decl.important = false;
}

console.log(`${pages} pages checked; ${decls.length} !important declarations in the stylesheets.`);
for (const [file, n] of byFile) console.log(`${relative(root, file)}: ${n} not needed`);
console.log(`${removable} !important not needed on any page checked.`);
if (candidatesFile) {
  // The second pass's input: the group probe with these keys in place of __CANDIDATES__.
  const probe = readFileSync(join(root, 'scripts/screens/important-group-probe.js'), 'utf8');
  writeFileSync(
    candidatesFile,
    probe.replace('new Set(__CANDIDATES__)', `new Set(${JSON.stringify([...candidateKeys])})`),
  );
  console.log(`Second-pass probe with ${candidateKeys.size} keys written to ${candidatesFile}.`);
}
if (fix) {
  for (const {file, tree} of trees) writeFileSync(file, tree.toString());
  console.log('Dropped.');
}
