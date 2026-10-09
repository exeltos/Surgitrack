#!/usr/bin/env node
/**
 * English completeness of the UI. Every literal tr('…') text needs an entry in src/i18n/en.ts, and every
 * entry there must still be used somewhere in src/ (dynamic texts such as data labels go through trData
 * and the glossary, so an entry counts as used when its Greek text appears anywhere in the source).
 * Exits 1 on any finding. Usage: node scripts/i18n-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const enFile = path.join(root, 'src/i18n/en.ts');
const en = fs.readFileSync(enFile, 'utf8');

const unescape = s => s.replace(/\\(['"`\\])/g, '$1');
const keys = new Set();
const keyRe = /^\s{2}(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|([^\s:'"]+)):/gm;
for (let m; (m = keyRe.exec(en));) keys.add(unescape(m[1] ?? m[2] ?? m[3]));

const files = [];
const walk = dir => {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.tsx?$/.test(entry.name) && file !== enFile) files.push(file);
  }
};
walk(path.join(root, 'src'));

const missing = new Map();
const sources = [];
const callRe = /\btr\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\$]|\\.)*)`)/g;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  sources.push(text);
  // Tests may name data texts (department or sterilizer names); they count as use, not as UI to translate.
  if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
  for (let m; (m = callRe.exec(text));) {
    const key = unescape(m[1] ?? m[2] ?? m[3]);
    // Only Greek texts are translated; codes and English-only texts pass through as they are.
    if (!/[Ͱ-Ͽ]/.test(key) || keys.has(key)) continue;
    const line = text.slice(0, m.index).split('\n').length;
    if (!missing.has(key)) missing.set(key, `${path.relative(root, file)}:${line}`);
  }
}
const all = sources.join('\n');
const unused = [...keys].filter(key => !all.includes(key));

for (const [key, where] of missing) console.log(`missing English: ${where}  ${key}`);
for (const key of unused) console.log(`unused entry in en.ts: ${key}`);
console.log(`${keys.size} entries · ${missing.size} missing · ${unused.length} unused`);
process.exit(missing.size || unused.length ? 1 : 0);
