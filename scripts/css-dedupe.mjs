#!/usr/bin/env node
/**
 * Finds declarations in the global stylesheets that can never apply, and optionally removes them.
 *
 *   node scripts/css-dedupe.mjs          report what would go, exit 1 if anything would
 *   node scripts/css-dedupe.mjs --fix    remove it (and rules or @media blocks left empty)
 *
 * A declaration is dead when a later rule, in the same @media/@supports context and with exactly the
 * same selector, sets the same property with the same or higher importance: same selector means the
 * same specificity, so the later one always wins, whatever lies between them. That is all it removes:
 * - only the very same property name (a later `margin` does not remove an earlier `margin-top`);
 * - never a declaration whose later replacement might be ignored by an older browser (vendor
 *   prefixes, newer units and functions), so the earlier one stays as its fallback;
 * - never an !important one overridden by a plain one.
 * The files are read in cascade order: global.css's imports, then global.css itself.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import postcss from 'postcss';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const styles = join(root, 'src/styles');
const entry = join(styles, 'global.css');
const fix = process.argv.includes('--fix');

const entryCss = readFileSync(entry, 'utf8');
const files = [...entryCss.matchAll(/@import\s+['"](.+?)['"]/g)].map(m => join(styles, m[1])).concat(entry);
const trees = files.map(file => ({file, tree: postcss.parse(readFileSync(file, 'utf8'), {from: file})}));

// A value an older browser may not understand: keep what it overrides as the fallback.
const NEWER =
  /-(webkit|moz|ms|o)-|\b(dvh|svh|lvh|dvw|svw|lvw|cqw|cqh)\b|\b(clamp|min|max|color-mix|env|light-dark)\(|:has\(/i;

const contextOf = node => {
  const parts = [];
  for (let p = node.parent; p && p.type !== 'root'; p = p.parent) {
    if (p.type === 'atrule') parts.unshift(`@${p.name} ${p.params.replace(/\s+/g, ' ').trim()}`);
  }
  return parts.join(' | ');
};
const selectorKey = rule => rule.selector.replace(/\s+/g, ' ').trim();

// Every declaration in cascade order, keyed by context + selector + property.
const decls = [];
for (const {file, tree} of trees) {
  tree.walkRules(rule => {
    if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
    const key = `${contextOf(rule)} || ${selectorKey(rule)}`;
    rule.each(node => {
      if (node.type === 'decl') decls.push({file, node, key: `${key} || ${node.prop.toLowerCase()}`, rule});
    });
  });
}

// Walk backwards: remember the strongest later declaration for each key.
const later = new Map();
const dead = [];
for (let i = decls.length - 1; i >= 0; i--) {
  const d = decls[i];
  const next = later.get(d.key);
  if (next && next.rule !== d.rule && !(d.node.important && !next.important) && !NEWER.test(next.value)) dead.push(d);
  // The last declaration for a key is the one compared against (an earlier !important one that beats
  // it is simply never removed, which is safe).
  if (!next) later.set(d.key, {rule: d.rule, important: d.node.important, value: d.node.value});
}

const byFile = new Map();
for (const d of dead) byFile.set(d.file, (byFile.get(d.file) || 0) + 1);
for (const [file, n] of byFile) console.log(`${relative(root, file)}: ${n} dead declaration${n === 1 ? '' : 's'}`);
console.log(`${dead.length} dead declarations in all.`);

if (!fix) process.exit(dead.length ? 1 : 0);

for (const d of dead) d.node.remove();
for (const {file, tree} of trees) {
  let emptied = true;
  while (emptied) {
    emptied = false;
    tree.walk(node => {
      if (
        (node.type === 'rule' || (node.type === 'atrule' && node.nodes)) &&
        !node.nodes.some(n => n.type !== 'comment')
      ) {
        node.remove();
        emptied = true;
      }
    });
  }
  writeFileSync(file, tree.toString());
}
console.log('Removed.');
