#!/usr/bin/env node
/**
 * Finds class selectors in the global stylesheets that no source file can produce, and optionally removes them.
 *
 *   node scripts/css-unused.mjs            list the unused classes and rules, exit 1 if there are any
 *   node scripts/css-unused.mjs --json     the same, as JSON
 *   node scripts/css-unused.mjs --why a b  why each class counts as used
 *   node scripts/css-unused.mjs --prefixes the prefixes and suffixes taken from dynamic strings, with where they are
 *   node scripts/css-unused.mjs --fix      remove the unused selectors and rules (and @media blocks left empty)
 *
 * A class counts as used when any string in the code could produce it. The code is read with the TypeScript
 * parser, so only strings count (string literals, template literal parts, JSX attribute values), not
 * identifiers or comments. Deliberately generous:
 * - every word of every string counts, case-insensitively and with `_` and `-` treated alike (enum values
 *   lowered into class names);
 * - a word just before `${` in a template, or at the end of a string joined with `+`, is a prefix: every class
 *   starting with it counts (`status-${s}`, `'chip-' + tone`); the same for a word after `}` (a suffix);
 *   not when the expression only adds text starting with a space or punctuation (`box${on ? ' on' : ''}`) or is
 *   an id or a timestamp (`po${uniqueStamp()}`), and a prefix needs a letter (two without a trailing `-`);
 * - a word ending in `-` or `_` anywhere is a prefix too;
 * - classList / querySelector strings are ordinary strings, so they count.
 * A selector is unused when it needs a class that is unused. Classes inside :not(), :is(), :where() and :has()
 * are ignored, so such selectors are kept. A rule goes when all of its selectors are unused; in a selector list
 * with used and unused parts only the unused parts go.
 */
import {readFileSync, writeFileSync, readdirSync, statSync, existsSync} from 'node:fs';
import {join, relative, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import postcss from 'postcss';
import ts from 'typescript';

const ROOT = join(fileURLToPath(import.meta.url), '../..');
const CSS_FILES = ['src/styles/global.css', ...listFiles('src/styles/layers', ['.css']).sort()];
const SOURCE_DIRS = ['src', 'scripts/screens'];
const HTML_FILES = ['index.html', ...listFiles('public', ['.html'])];
/** Classes added by libraries, not by our code: lucide-react puts `lucide lucide-<icon>` on every icon. */
const LIBRARY_PREFIXES = ['lucide'];

const args = new Set(process.argv.slice(2));
const FIX = args.has('--fix');
const JSON_OUT = args.has('--json');

function listFiles(dir, exts) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  const out = [];
  for (const name of readdirSync(abs)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(abs, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(relative(ROOT, p), exts));
    else if (exts.includes(extname(name))) out.push(relative(ROOT, p));
  }
  return out;
}

const norm = s => s.toLowerCase().replace(/_/g, '-');
const WORD = /[A-Za-z0-9_-]+/g;
const words = new Set();
/** Prefix or suffix -> where it was first seen. */
const prefixes = new Map();
const suffixes = new Map();
const remember = (map, key, where) => map.has(key) || map.set(key, where);

/**
 * A prefix or suffix needs a letter, and two letters unless it ends (or starts) with `-` or `_`: `o-${status}` is a
 * class name, `c${n}`, `-${i}` and `${x}4` are ids and keys.
 */
const affixOk = w => (w.match(/[a-z]/g) ?? []).length >= (/^[-_]|[-_]$/.test(w) ? 1 : 2);

function addText(text, where, {prefixAtEnd = false, suffixAtStart = false} = {}) {
  const found = text.match(WORD) ?? [];
  for (const w of found) {
    words.add(norm(w));
    if (/[-_]$/.test(w) && affixOk(norm(w))) remember(prefixes, norm(w), where);
  }
  const first = found.length ? norm(found[0]) : '';
  const last = found.length ? norm(found.at(-1)) : '';
  if (prefixAtEnd && /[A-Za-z0-9_-]$/.test(text) && affixOk(last)) remember(prefixes, last, where);
  if (suffixAtStart && /^[A-Za-z0-9_-]/.test(text) && affixOk(first)) remember(suffixes, first, where);
}

/**
 * Whether an expression placed right next to a word can extend it into a longer class name. Not when it only adds
 * text that starts with a space or punctuation (`box${on ? ' on' : ''}`), and not when it is an id or a timestamp.
 */
function canExtend(expr, sf) {
  if (!expr) return false;
  const text = expr.getText(sf);
  if (/Date\.now|uniqueStamp|Math\.random|crypto\.|import\.meta/.test(text)) return false;
  let e = expr;
  while (ts.isParenthesizedExpression(e)) e = e.expression;
  if (ts.isConditionalExpression(e)) {
    const branchText = b => {
      while (ts.isParenthesizedExpression(b)) b = b.expression;
      if (ts.isStringLiteral(b) || ts.isNoSubstitutionTemplateLiteral(b)) return b.text;
      if (ts.isTemplateExpression(b)) return b.head.text || null;
      return null;
    };
    const branches = [branchText(e.whenTrue), branchText(e.whenFalse)];
    if (branches.every(t => t !== null && !/^[A-Za-z0-9_-]/.test(t))) return false;
  }
  return true;
}

function scanSource(file) {
  const text = readFileSync(join(ROOT, file), 'utf8');
  const kind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const visit = node => {
    const where = () => `${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent;
      const joined = parent && ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.PlusToken;
      addText(node.text, where(), {
        prefixAtEnd: joined && parent.left === node && canExtend(parent.right, sf),
        suffixAtStart: joined && parent.right === node && canExtend(parent.left, sf),
      });
    } else if (ts.isTemplateExpression(node)) {
      // head ${e0} middle ${e1} ... tail: the text before an expression is a prefix, the text after it a suffix.
      addText(node.head.text, where(), {prefixAtEnd: canExtend(node.templateSpans[0]?.expression, sf)});
      node.templateSpans.forEach((span, i) => {
        const next = node.templateSpans[i + 1]?.expression;
        addText(span.literal.text, where(), {
          prefixAtEnd: next ? canExtend(next, sf) : false,
          suffixAtStart: canExtend(span.expression, sf),
        });
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

for (const dir of SOURCE_DIRS) for (const f of listFiles(dir, ['.ts', '.tsx', '.mjs', '.js'])) scanSource(f);
for (const f of HTML_FILES) addText(readFileSync(join(ROOT, f), 'utf8'), f);

function whyUsed(name) {
  const n = norm(name);
  if (words.has(n)) return 'word';
  if (LIBRARY_PREFIXES.some(p => n.startsWith(p))) return 'library';
  for (const [p, where] of prefixes) if (n.startsWith(p)) return `prefix "${p}" (${where})`;
  for (const [s, where] of suffixes) if (n.endsWith(s)) return `suffix "${s}" (${where})`;
  return null;
}
const classUsed = name => whyUsed(name) !== null;

if (args.has('--prefixes')) {
  for (const [p, where] of [...prefixes].sort()) console.log(`prefix ${p}  ${where}`);
  for (const [p, where] of [...suffixes].sort()) console.log(`suffix ${p}  ${where}`);
  process.exit(0);
}
const WHY = process.argv.indexOf('--why');
if (WHY > 0) {
  for (const name of process.argv.slice(WHY + 1)) console.log(`${name}: ${whyUsed(name) ?? 'unused'}`);
  process.exit(0);
}

/** Classes a selector needs, outside of pseudo-class functions (:not(), :is(), ...). */
function requiredClasses(selector) {
  let depth = 0;
  let flat = '';
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    if (c === '\\') {
      if (depth === 0) flat += selector.slice(i, i + 2);
      i++;
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0) flat += c;
  }
  flat = flat.replace(/\[[^\]]*\]/g, ' '); // attribute selectors: [class*="x"] is not a class selector
  return [...flat.matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)].map(m => m[1]);
}

/** Splits a selector list on top-level commas, keeping the separators. */
function splitSelectors(selector) {
  const parts = [];
  const seps = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '\\') i++;
    else if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(selector.slice(start, i));
      const m = /^,\s*/.exec(selector.slice(i));
      seps.push(m[0]);
      i += m[0].length - 1;
      start = i + 1;
    }
  }
  parts.push(selector.slice(start));
  return {parts: parts.map(p => p.trim()), seps};
}

const insideKeyframes = node => {
  for (let p = node.parent; p; p = p.parent) if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return true;
  return false;
};

const report = [];
const unusedClasses = new Set();
let totalRules = 0;
let totalSelectors = 0;
for (const file of CSS_FILES) {
  const abs = join(ROOT, file);
  const source = readFileSync(abs, 'utf8');
  const root = postcss.parse(source, {from: abs});
  const entry = {
    file,
    rulesRemoved: 0,
    selectorsRemoved: 0,
    linesBefore: source.split('\n').length,
    linesAfter: 0,
    items: [],
  };
  root.walkRules(rule => {
    if (insideKeyframes(rule)) return;
    const {parts, seps} = splitSelectors(rule.selector);
    const unused = parts.map(sel => {
      const missing = requiredClasses(sel).filter(c => !classUsed(c));
      missing.forEach(c => unusedClasses.add(c));
      return missing.length > 0;
    });
    if (!unused.some(Boolean)) return;
    const line = rule.source?.start?.line;
    if (unused.every(Boolean)) {
      entry.rulesRemoved++;
      entry.items.push({line, removed: parts});
      if (FIX) rule.remove();
    } else {
      entry.selectorsRemoved += unused.filter(Boolean).length;
      entry.items.push({line, removed: parts.filter((_, i) => unused[i]), kept: parts.filter((_, i) => !unused[i])});
      if (FIX) {
        const sep = seps.find(s => s.includes('\n')) ?? seps[0] ?? ', ';
        rule.selector = parts.filter((_, i) => !unused[i]).join(sep);
      }
    }
  });
  if (FIX) {
    let changed = true;
    while (changed) {
      changed = false;
      root.walkAtRules(at => {
        if (
          /^(media|supports|container|layer)$/i.test(at.name) &&
          at.nodes &&
          !at.nodes.some(n => n.type !== 'comment')
        ) {
          at.remove();
          changed = true;
        }
      });
    }
    const out = root.toString();
    entry.linesAfter = out.split('\n').length;
    if (out !== source) writeFileSync(abs, out);
  }
  totalRules += entry.rulesRemoved;
  totalSelectors += entry.selectorsRemoved;
  report.push(entry);
}

if (JSON_OUT) {
  console.log(JSON.stringify({unusedClasses: [...unusedClasses].sort(), files: report}, null, 2));
} else {
  for (const e of report) {
    if (!e.items.length) continue;
    console.log(
      `\n${e.file}: ${e.rulesRemoved} rules, ${e.selectorsRemoved} selectors in shared lists${FIX ? ` (lines ${e.linesBefore} -> ${e.linesAfter})` : ''}`,
    );
    for (const it of e.items)
      console.log(`  ${it.line}: ${it.removed.join(', ')}${it.kept ? `   (kept: ${it.kept.join(', ')})` : ''}`);
  }
  console.log(
    `\n${unusedClasses.size} unused classes; ${totalRules} rules and ${totalSelectors} selectors ${FIX ? 'removed' : 'removable'}.`,
  );
}
if (!FIX && (totalRules || totalSelectors)) process.exitCode = 1;
