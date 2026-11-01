#!/usr/bin/env node
/**
 * Finds rules that remove the focus outline (outline: none / 0) for an element that has no other visible
 * :focus style anywhere in the styles (a box-shadow, a border or a background change), which leaves keyboard
 * users without a sign of where they are. Exits 1 when it finds one, so CI keeps new ones out.
 *
 *   node scripts/css-focus.mjs [--list]    --list prints every outline reset with what replaces it
 */
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import postcss from 'postcss';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const files = [];
const walk = dir => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith('.css')) files.push(path);
  }
};
walk(join(root, 'src/styles'));

const list = process.argv.includes('--list');
const visible = new Set([
  'box-shadow',
  'border',
  'border-color',
  'background',
  'background-color',
  'outline',
  'outline-color',
]);
const FOCUS = /:focus(-visible|-within)?/g;
/** A selector without its focus pseudo-classes and without the "html body" prefix used to win specificity. */
const baseOf = selector =>
  selector
    .replace(/:not\([^)]*\)/g, '')
    .replace(FOCUS, '')
    .replace(/^html body\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

const parsed = files.map(file => ({file, root: postcss.parse(readFileSync(file, 'utf8'), {from: file})}));

// 1. What shows focus: the bases of every rule for :focus / :focus-visible that changes something visible.
const shown = new Set();
// Wrappers that light up when anything inside has focus (:focus-within), which covers the field inside.
const within = new Set();
for (const {root: tree} of parsed)
  tree.walkRules(rule => {
    const changes = rule.nodes.some(
      n =>
        n.type === 'decl' &&
        visible.has(n.prop) &&
        !(n.prop.startsWith('outline') && /^(none|0)\b/.test(n.value.trim())),
    );
    if (!changes) return;
    for (const selector of rule.selectors) {
      if (!/:focus/.test(selector)) continue;
      shown.add(baseOf(selector));
      if (/:focus-within\s*$/.test(selector.trim()) || /:focus-within(?![^ ]*\s)/.test(selector.trim()))
        within.add(baseOf(selector));
    }
  });
// A global rule such as ":focus-visible { outline: ... }" shows focus on everything not reset to nothing.
const globalFocus = [...shown].includes('') || shown.has('*');

// 2. Each outline reset: either it is itself a :focus rule that changes something, or its element has one.
const bad = [];
for (const {file, root: tree} of parsed)
  tree.walkRules(rule => {
    const decls = rule.nodes.filter(n => n.type === 'decl');
    const reset = decls.find(d => d.prop === 'outline' && /^(none|0)\b/.test(d.value.trim()));
    if (!reset) return;
    const where = `${relative(root, file)}:${reset.source.start.line}`;
    const ownRule = rule.selectors.some(sel => FOCUS.test(sel));
    FOCUS.lastIndex = 0;
    const own = ownRule && decls.some(d => visible.has(d.prop) && d !== reset);
    const covered = sel => shown.has(baseOf(sel)) || [...within].some(w => baseOf(sel).startsWith(w + ' '));
    const elsewhere = rule.selectors.every(covered);
    const ok = own || elsewhere;
    if (list) console.log(`${ok ? 'ok  ' : 'NONE'} ${where}  ${rule.selector.replace(/\s+/g, ' ').slice(0, 80)}`);
    if (!ok && !globalFocus) bad.push(`${where}  ${rule.selector.replace(/\s+/g, ' ').slice(0, 90)}`);
  });
if (bad.length) {
  console.error(`${bad.length} outline reset(s) with no visible :focus style for the element:`);
  bad.forEach(b => console.error('  ' + b));
  process.exit(1);
}
console.log('Every outline reset has a visible :focus style for its element.');
