#!/usr/bin/env node
/**
 * Moves one section's rules out of src/styles/overrides.css into src/styles/sections/<name>.css, without
 * changing what any page looks like.
 *
 *   node scripts/css-section.mjs <name> <folder | class-regex>          report what would move and what stays
 *   node scripts/css-section.mjs <name> <folder | class-regex> --fix    move it
 *
 * e.g. node scripts/css-section.mjs sterilization src/modules/sterilization
 *      node scripts/css-section.mjs shell '^(topbar|sidebar)-'
 *
 * A rule belongs to the section when every selector in its list has a class of the section: one only the
 * folder's files use, or one matching the regex. The section
 * file is imported last (after overrides.css and the earlier section files), so a moved rule now comes after
 * every rule that used to follow it. That can change the result only where two declarations tie: the same
 * property (or a shorthand of it), the same importance, the same specificity, media queries that can both
 * apply, and subjects that can be the same element. A rule with such a tie stays in overrides.css.
 *
 * In the section file, rules with the same media query are grouped and rules with the same selector merged,
 * but only where the rules they jump over cannot tie with them, as above.
 */
import {readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync} from 'node:fs';
import {join, relative, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import postcss from 'postcss';
import ts from 'typescript';

const ROOT = join(fileURLToPath(import.meta.url), '../..');
const STYLES = join(ROOT, 'src/styles');
const ENTRY = join(STYLES, 'global.css');
const OVERRIDES = join(STYLES, 'overrides.css');

const [name, pattern] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const FIX = process.argv.includes('--fix');
if (!name || !pattern) {
  console.error('usage: node scripts/css-section.mjs <name> <class-regex> [--fix]');
  process.exit(2);
}
// The section: classes matching a regex, or (given a folder) the classes only the files in that folder use.
// Several folders: comma-separated (e.g. src/modules/department,src/components/department).
const folders = pattern.split(',').map(dir => join(ROOT, dir.replace(/\/+$/, '')));
const sectionDirs = folders.every(dir => existsSync(dir)) ? folders : undefined;
const sectionRegex = sectionDirs ? undefined : new RegExp(pattern);
const target = join(STYLES, 'sections', `${name}.css`);
const importLine = `@import './sections/${name}.css';`;

// ---------- selectors ----------

/** Splits on top-level occurrences of the given characters (outside parentheses, brackets and strings). */
const splitTop = (text, test) => {
  const parts = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote && text[i - 1] !== '\\') quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (!depth && test(c, i)) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
};
const selectorList = selector =>
  splitTop(selector, c => c === ',')
    .map(s => s.trim())
    .filter(Boolean);

/** Specificity as [ids, classes, types]. */
const specificity = selector => {
  let a = 0;
  let b = 0;
  let c = 0;
  let s = selector;
  // Functional pseudo-classes: :where() counts nothing, the others count their most specific argument.
  const fn = /:(not|is|has|where|matches|nth-child|nth-last-child)\(/i;
  let m;
  while ((m = fn.exec(s))) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < s.length && depth; i++) depth += s[i] === '(' ? 1 : s[i] === ')' ? -1 : 0;
    const inner = s.slice(m.index + m[0].length, i - 1);
    const kind = m[1].toLowerCase();
    if (kind === 'where') {
      /* nothing */
    } else if (kind.startsWith('nth')) {
      b++;
      const of = /\bof\s+(.+)$/.exec(inner);
      if (of) {
        const best = selectorList(of[1]).map(specificity).sort(compareSpec).pop();
        [a, b, c] = [a + best[0], b + best[1], c + best[2]];
      }
    } else {
      const best = selectorList(inner).map(specificity).sort(compareSpec).pop() || [0, 0, 0];
      [a, b, c] = [a + best[0], b + best[1], c + best[2]];
    }
    s = s.slice(0, m.index) + ' ' + s.slice(i);
  }
  s = s.replace(/\[[^\]]*\]/g, () => (b++, ' '));
  s = s.replace(
    /::?(before|after|first-line|first-letter|placeholder|selection|marker|backdrop|-webkit-[\w-]+|-moz-[\w-]+)\b/gi,
    () => (c++, ' '),
  );
  s = s.replace(/#[\w-]+/g, () => (a++, ' '));
  s = s.replace(/\.[\w-]+/g, () => (b++, ' '));
  s = s.replace(/:[\w-]+/g, () => (b++, ' '));
  s = s.replace(/(^|[\s>+~(])([a-zA-Z][\w-]*)/g, (_, p) => (c++, p));
  return [a, b, c];
};
function compareSpec(x, y) {
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}
const sameSpec = (x, y) => !compareSpec(x, y);

/** The element a selector styles: its last compound, as tag, classes and pseudo-element. */
const subjectOf = selector => {
  const compounds = splitTop(selector.trim(), c => c === ' ' || c === '>' || c === '+' || c === '~').filter(s =>
    s.trim(),
  );
  const last = compounds[compounds.length - 1] || '';
  const plain = last.replace(/:(not|is|has|where)\((?:[^()]|\([^()]*\))*\)/gi, '').replace(/\[[^\]]*\]/g, '');
  const pseudo = (/::?(before|after|placeholder|marker|selection|backdrop|-webkit-[\w-]+)/i.exec(plain) || [])[1];
  const tag = (/^([a-zA-Z][\w-]*)/.exec(plain) || [])[1]?.toLowerCase();
  const classes = [...plain.matchAll(/\.([\w-]+)/g)].map(x => x[1]);
  return {tag, classes, pseudo: pseudo?.toLowerCase() || ''};
};

// Which classes the code ever puts on one element together: the words of one className (or of one string
// elsewhere). A class written next to a value only known at run time (`row ${className}`) may meet any class.
const together = new Map();
const open = new Set();
/** Classes that can travel: given to a component as its className, or kept in a variable or constant. */
const passed = new Set();
const listFiles = dir =>
  readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return listFiles(path);
    return ['.ts', '.tsx'].includes(extname(path)) ? [path] : [];
  });
const wordsOf = text => text.split(/\s+/).filter(w => /^[a-z][\w-]*$/i.test(w));
/** Where each word appears. */
const usedIn = new Map();
let currentFile = '';
const group = words => {
  for (const w of words) {
    if (!usedIn.has(w)) usedIn.set(w, new Set());
    usedIn.get(w).add(currentFile);
  }
  for (const w of words) {
    if (!together.has(w)) together.set(w, new Set());
    for (const v of words) together.get(w).add(v);
  }
};
/** The literal words of an expression, and whether some part of it is not a literal. */
const literalWords = node => {
  const words = [];
  const prefixes = [];
  let unknown = false;
  const visit = n => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) words.push(...wordsOf(n.text));
    else if (ts.isTemplateExpression(n)) {
      const parts = [n.head.text, ...n.templateSpans.map(span => span.literal.text)];
      parts.forEach((part, i) => {
        words.push(...wordsOf(part));
        // `status-${s}`: a word running into the value is the start of a class built at run time.
        const prefix = i < parts.length - 1 && /(?:^|\s)([a-z][\w-]*)$/i.exec(part);
        if (prefix && (prefix[1].endsWith('-') ? prefix[1].length > 1 : prefix[1].length > 3)) prefixes.push(prefix[1]);
        if (i < parts.length - 1) visit(n.templateSpans[i].expression);
      });
    } else if (ts.isConditionalExpression(n)) {
      visit(n.whenTrue);
      visit(n.whenFalse);
    } else if (ts.isBinaryExpression(n)) {
      visit(n.left);
      visit(n.right);
    } else if (ts.isParenthesizedExpression(n) || ts.isJsxExpression(n)) {
      if (n.expression) visit(n.expression);
    } else if (ts.isArrowFunction(n)) {
      visit(n.body);
    } else if (ts.isCallExpression(n) || ts.isArrayLiteralExpression(n)) {
      n.forEachChild(visit);
    } else if (ts.isPropertyAccessExpression(n)) {
      // A string method (`.trim()`, `.join(' ')`) keeps the string's words.
      visit(n.expression);
    } else if (!ts.isToken(n) || ts.isIdentifier(n)) unknown = true;
  };
  visit(node);
  return {words: [...words, ...prefixes.map(p => `${p}*`)], unknown};
};
/**
 * Areas: a module or component folder. An element of one area can sit inside an element of another only when
 * one of them imports the other (directly or not), or one is the app's frame, which holds every page.
 */
const areaOf = file => {
  const rel = relative(join(ROOT, 'src'), file).split('/');
  return rel[0] === 'modules' || rel[0] === 'components' ? `${rel[0]}/${rel[1].replace(/\.tsx?$/, '')}` : rel[0];
};
const FRAMES = new Set(['app', 'components/layout', 'main.tsx']);
const imports = new Map();
const addImport = (from, to) => {
  if (from === to) return;
  if (!imports.has(from)) imports.set(from, new Set());
  imports.get(from).add(to);
};
for (const file of listFiles(join(ROOT, 'src'))) {
  const text = readFileSync(file, 'utf8');
  currentFile = file;
  for (const m of text.matchAll(/(?:from|import\()\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const base = join(file, '..', m[1]);
    const to = [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')].find(
      f => existsSync(f) && statSync(f).isFile(),
    );
    if (to) addImport(file, to);
  }
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const walk = node => {
    if (ts.isJsxAttribute(node) && node.name.getText() === 'className' && node.initializer) {
      const {words, unknown} = literalWords(node.initializer);
      group(words);
      if (unknown) for (const w of words) open.add(w);
      // On a component (<Panel className=…>) the classes land next to the component's own.
      if (/^[A-Z]/.test(node.parent.parent.tagName.getText())) for (const w of words) passed.add(w);
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      group(wordsOf(node.text));
      for (const w of wordsOf(node.text)) passed.add(w);
    }
    if (ts.isTemplateExpression(node)) {
      const {words, unknown} = literalWords(node);
      group(words);
      if (unknown) for (const w of words) open.add(w);
      for (const w of words) passed.add(w);
      return;
    }
    node.forEachChild(walk);
  };
  walk(source);
}
const reachCache = new Map();
const reaches = from => {
  if (reachCache.has(from)) return reachCache.get(from);
  const seen = new Set([from]);
  const stack = [from];
  // Only components render anything (.tsx); the frame imports every page, but a page importing a helper from
  // the frame does not put the frame inside the page.
  const renders = file => file.endsWith('.tsx') && !FRAMES.has(areaOf(file));
  while (stack.length) {
    for (const next of imports.get(stack.pop()) || []) {
      if (!seen.has(next) && renders(next)) (seen.add(next), stack.push(next));
    }
  }
  reachCache.set(from, seen);
  return seen;
};
const filesOf = c => {
  const files = [...(usedIn.get(c) || [])];
  for (const [key, where] of usedIn) if (key.endsWith('*') && c.startsWith(key.slice(0, -1))) files.push(...where);
  return new Set(files);
};
/** Whether an element with class c and one with class d can be the same element or one inside the other. */
const canNest = (c, d) => {
  const a = filesOf(c);
  const b = filesOf(d);
  if (!a.size || !b.size) return true;
  return [...a].some(x =>
    [...b].some(
      y =>
        areaOf(x) === areaOf(y) ||
        FRAMES.has(areaOf(x)) ||
        FRAMES.has(areaOf(y)) ||
        !x.endsWith('.tsx') ||
        !y.endsWith('.tsx') ||
        reaches(x).has(y) ||
        reaches(y).has(x),
    ),
  );
};
const classesIn = selector =>
  [...selector.replace(/:(not|where)\((?:[^()]|\([^()]*\))*\)/gi, '').matchAll(/\.([\w-]+)/g)].map(m => m[1]);

/** The classes a class can meet on one element ('*': any), counting the prefixes it may be built from. */
const companionsCache = new Map();
const companions = c => {
  if (companionsCache.has(c)) return companionsCache.get(c);
  const keys = [c, ...[...together.keys()].filter(k => k.endsWith('*') && c.startsWith(k.slice(0, -1)))];
  const result = new Set();
  for (const key of keys) {
    for (const v of together.get(key) || []) {
      result.add(v);
      // A companion prefix covers every class built from it.
      if (v.endsWith('*')) result.add(v);
    }
    if (open.has(key)) for (const v of passed) result.add(v);
  }
  if (keys.every(k => !together.has(k))) result.add('*');
  companionsCache.set(c, result);
  return result;
};
const canShareElement = (x, y) => {
  if (x.pseudo !== y.pseudo) return false;
  if (x.tag && y.tag && x.tag !== y.tag) return false;
  if (!x.classes.length || !y.classes.length) return true;
  if (x.classes.some(c => y.classes.includes(c))) return true;
  // A class built at run time (`status-${s}`) is not in any string whole: then assume it can.
  const meets = (c, d) =>
    c === d ||
    [companions(c), companions(d)].some(set => set.has('*')) ||
    [...companions(c)].some(v => v === d || (v.endsWith('*') && d.startsWith(v.slice(0, -1)))) ||
    [...companions(d)].some(v => v === c || (v.endsWith('*') && c.startsWith(v.slice(0, -1))));
  // One element carries both rules' classes, so each pair of them must be able to meet.
  return x.classes.every(c => y.classes.every(d => meets(c, d)));
};

// ---------- media ----------

const rangeOf = context => {
  let min = 0;
  let max = Infinity;
  for (const m of context.matchAll(/min-width:\s*([\d.]+)px/g)) min = Math.max(min, +m[1]);
  for (const m of context.matchAll(/max-width:\s*([\d.]+)px/g)) max = Math.min(max, +m[1]);
  const print = /@media[^|]*\bprint\b/.test(context);
  return {min, max, print};
};
const canBothApply = (x, y) => {
  const a = rangeOf(x);
  const b = rangeOf(y);
  if (a.print !== b.print) return false;
  return !(a.max < b.min || b.max < a.min);
};

// ---------- properties ----------

const family = prop => {
  const p = prop.toLowerCase().replace(/^-(webkit|moz|ms)-/, '');
  if (p.startsWith('--')) return p;
  if (/^(top|right|bottom|left|inset)(-|$)/.test(p)) return 'inset';
  if (/^(gap|row-gap|column-gap|grid-gap)$/.test(p)) return 'gap';
  if (/^(place|align|justify)-/.test(p)) return p.replace(/^place-/, '').replace(/^(align|justify)-/, '');
  if (/^(width|min-width|max-width)$/.test(p)) return p;
  if (/^(height|min-height|max-height)$/.test(p)) return p;
  return p.split('-')[0];
};

// ---------- the cascade ----------

const contextOf = node => {
  const parts = [];
  for (let p = node.parent; p && p.type !== 'root'; p = p.parent) {
    if (p.type === 'atrule') parts.unshift(`@${p.name} ${p.params.replace(/\s+/g, ' ').trim()}`);
  }
  return parts.join(' | ');
};
const inKeyframes = node => {
  for (let p = node.parent; p && p.type !== 'root'; p = p.parent)
    if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return true;
  return false;
};

const entryCss = readFileSync(ENTRY, 'utf8');
const files = [...entryCss.matchAll(/@import\s+['"](.+?)['"]/g)].map(m => join(STYLES, m[1]));
const trees = new Map(files.map(file => [file, postcss.parse(readFileSync(file, 'utf8'), {from: file})]));

/** Every rule in cascade order, with what is needed to compare it. */
const describe = (rule, file) => {
  const selectors = selectorList(rule.selector);
  const decls = rule.nodes
    .filter(n => n.type === 'decl')
    .map(d => ({family: family(d.prop), important: !!d.important}));
  return {
    rule,
    file,
    context: contextOf(rule),
    selectors: selectors.map(s => ({spec: specificity(s), subject: subjectOf(s), classes: classesIn(s)})),
    decls,
  };
};
const cascade = [];
for (const [file, tree] of trees) {
  tree.walkRules(rule => {
    if (!inKeyframes(rule)) cascade.push(describe(rule, file));
  });
}

/** Whether swapping the order of two rules could change any element's computed value. */
const tie = (x, y) => {
  if (!canBothApply(x.context, y.context)) return false;
  const shared = x.decls.filter(d => y.decls.some(e => e.family === d.family && e.important === d.important));
  if (!shared.length) return false;
  return x.selectors.some(s =>
    y.selectors.some(
      t =>
        sameSpec(s.spec, t.spec) &&
        canShareElement(s.subject, t.subject) &&
        // Every class of both selectors is on the element or around it, so all of them meet in one tree.
        s.classes.every(c => t.classes.every(d => canNest(c, d))),
    ),
  );
};

// ---------- what moves ----------

const sectionClass = name => {
  if (sectionRegex) return sectionRegex.test(name);
  const files = [...(usedIn.get(name) || [])];
  // A class built at run time counts by the prefix it is built from.
  for (const [key, where] of usedIn) if (key.endsWith('*') && name.startsWith(key.slice(0, -1))) files.push(...where);
  return files.length > 0 && files.every(file => sectionDirs.some(dir => file.startsWith(dir + '/')));
};
const inSection = item =>
  item.file === OVERRIDES &&
  item.selectors.length > 0 &&
  selectorList(item.rule.selector).every(s => [...s.matchAll(/\.([\w-]+)/g)].some(m => sectionClass(m[1])));

let moving = new Set(cascade.filter(inSection));
const kept = new Map();
// A moved rule jumps over every rule after it that is not moving: drop the ones that tie, until none does.
for (let changed = true; changed;) {
  changed = false;
  for (let i = 0; i < cascade.length; i++) {
    const item = cascade[i];
    if (!moving.has(item)) continue;
    for (let j = i + 1; j < cascade.length; j++) {
      const other = cascade[j];
      if (moving.has(other)) continue;
      if (tie(item, other)) {
        moving.delete(item);
        kept.set(item, other);
        changed = true;
        break;
      }
    }
  }
}
const moved = cascade.filter(item => moving.has(item));

console.log(`${moved.length} rules move to ${relative(ROOT, target)}; ${kept.size} stay in overrides.css:`);
for (const [item, other] of kept) {
  console.log(`  ${item.rule.selector.replace(/\s+/g, ' ').slice(0, 90)}`);
  console.log(
    `      ties with ${other.rule.selector.replace(/\s+/g, ' ').slice(0, 80)} (${relative(ROOT, other.file)}:${other.rule.source.start.line})`,
  );
}
if (!FIX) process.exit(0);

// ---------- build the section file ----------

/** The comment right above a rule, when it is not also heading a rule that stays. */
const leadingComment = rule => {
  const prev = rule.prev();
  if (prev?.type !== 'comment') return undefined;
  return prev;
};

/** Groups: one per media context, in order; a rule joins an earlier group only when it ties with nothing it passes. */
const groups = [];
const placed = [];
for (const item of moved) {
  const clone = item.rule.clone();
  const comment = leadingComment(item.rule);
  const entry = {
    ...item,
    clone,
    comment: comment && !moved.some(m => m !== item && m.rule === comment.next()) ? comment.clone() : undefined,
  };
  // Last group with the same context; the items placed after it are the ones this rule would jump over.
  let groupIndex = -1;
  for (let g = groups.length - 1; g >= 0; g--) {
    if (groups[g].context === item.context) {
      groupIndex = g;
      break;
    }
  }
  let group = groupIndex >= 0 ? groups[groupIndex] : undefined;
  if (group) {
    const passed = placed.filter(p => p.groupIndex > groupIndex);
    if (passed.some(p => tie(p, item))) group = undefined;
  }
  if (!group) {
    group = {context: item.context, items: []};
    groups.push(group);
    groupIndex = groups.length - 1;
  }
  // Same selector already in the group, with nothing tying in between: add the declarations to it.
  const selectorKey = item.rule.selector.replace(/\s+/g, ' ').trim();
  const sameIndex = group.items.findIndex(g => g.rule.selector.replace(/\s+/g, ' ').trim() === selectorKey);
  const same = group.items[sameIndex];
  const between = same ? placed.slice(placed.indexOf(same) + 1) : [];
  if (same && !between.some(p => p !== item && tie(p, item))) {
    if (entry.comment) same.clone.append(entry.comment);
    for (const node of clone.nodes) {
      if (node.type === 'decl') {
        // The later declaration of a property wins, unless the earlier one is !important and this one is not.
        same.clone.each(d => {
          if (d.type === 'decl' && d.prop === node.prop && !(d.important && !node.important)) d.remove();
        });
        if (same.clone.nodes.some(d => d.type === 'decl' && d.prop === node.prop && d.important && !node.important))
          continue;
      }
      same.clone.append(node.clone());
    }
    same.decls = [...same.decls, ...item.decls];
    continue;
  }
  entry.groupIndex = groupIndex;
  group.items.push(entry);
  placed.push(entry);
}

const out = postcss.root();
out.append(
  postcss.comment({
    text: `${name[0].toUpperCase()}${name.slice(1)}. Moved together from overrides.css; cascade order is intentional.`,
  }),
);
for (const group of groups) {
  let parent = out;
  for (const part of group.context ? group.context.split(' | ') : []) {
    const [, at, params] = /^@(\S+)\s*(.*)$/.exec(part);
    const node = postcss.atRule({name: at, params});
    parent.append(node);
    parent = node;
  }
  for (const item of group.items) {
    if (item.comment) parent.append(item.comment);
    parent.append(item.clone);
  }
}

// Remove the moved rules (and comments heading only them), then empty @media blocks.
for (const item of moved) {
  const prev = item.rule.prev();
  if (prev?.type === 'comment') {
    const next = item.rule.next();
    const headsMore = next && next.type !== 'comment' && !moved.some(m => m.rule === next);
    if (!headsMore) prev.remove();
  }
  item.rule.remove();
}
const overrides = trees.get(OVERRIDES);
for (let emptied = true; emptied;) {
  emptied = false;
  overrides.walkAtRules(node => {
    if (node.nodes && !node.nodes.some(n => n.type !== 'comment')) {
      node.remove();
      emptied = true;
    }
  });
}
writeFileSync(OVERRIDES, overrides.toString());

if (!existsSync(join(STYLES, 'sections'))) mkdirSync(join(STYLES, 'sections'));
const existing = existsSync(target) ? readFileSync(target, 'utf8') + '\n' : '';
if (existing) {
  console.error(`${relative(ROOT, target)} exists already: move into a new name.`);
  process.exit(1);
}
writeFileSync(target, out.toString() + '\n');
if (!entryCss.includes(importLine)) writeFileSync(ENTRY, entryCss.trimEnd() + '\n' + importLine + '\n');
console.log(`Moved. Run prettier on ${relative(ROOT, target)} and overrides.css, then css:dead.`);
