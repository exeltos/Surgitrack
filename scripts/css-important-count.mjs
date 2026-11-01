#!/usr/bin/env node
/**
 * A ratchet for !important: the count may go down, never up. New CSS has to win by being written in the right
 * place (src/styles/README.md), not by adding another !important to the 600 that fight each other already.
 *
 *   node scripts/css-important-count.mjs            check against scripts/important-baseline.json
 *   node scripts/css-important-count.mjs --update   write the current count (after removing some)
 */
import {readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import postcss from 'postcss';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const baselineFile = join(root, 'scripts/important-baseline.json');
const files = [];
const walk = dir => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith('.css')) files.push(path);
  }
};
walk(join(root, 'src/styles'));

let count = 0;
for (const file of files)
  postcss.parse(readFileSync(file, 'utf8'), {from: file}).walkDecls(d => d.important && count++);

if (process.argv.includes('--update')) {
  writeFileSync(baselineFile, JSON.stringify({important: count}, null, 2) + '\n');
  console.log(`Baseline is now ${count}.`);
} else {
  const {important: allowed} = JSON.parse(readFileSync(baselineFile, 'utf8'));
  if (count > allowed) {
    console.error(`${count} !important declarations; the limit is ${allowed}. Do not add more (src/styles/README.md).`);
    process.exit(1);
  }
  console.log(
    `${count} !important declarations (limit ${allowed})${count < allowed ? ': lower the limit with --update' : ''}.`,
  );
}
