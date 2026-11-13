#!/usr/bin/env node
/**
 * The JavaScript a first visit downloads before anything shows: the scripts and module preloads that
 * dist/index.html and dist/scan.html name, gzipped. Heavy libraries (barcode decoder, jsPDF, html2canvas,
 * label fonts) load only when used; a static import of one of them would land here and fail this check.
 *
 *   npm run build && npm run check:size
 */
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';

const BUDGET_KB = 300; // gzip; about 246 kB today

const dist = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
let failed = false;
for (const page of ['index.html', 'scan.html']) {
  const file = join(dist, page);
  if (!existsSync(file)) {
    console.error(`${page} not found: run npm run build first`);
    process.exit(1);
  }
  const html = readFileSync(file, 'utf8');
  const scripts = [
    ...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g),
    ...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g),
  ].map(m => m[1]);
  let total = 0;
  for (const src of new Set(scripts)) {
    const size = gzipSync(readFileSync(join(dist, src))).length;
    total += size;
    console.log(`  ${page}  ${src}  ${(size / 1000).toFixed(1)} kB`);
  }
  const kb = total / 1000;
  console.log(`${page}: ${kb.toFixed(1)} kB gzip of JavaScript at first load (budget ${BUDGET_KB} kB)`);
  if (kb > BUDGET_KB) failed = true;
}
if (failed) {
  console.error('Over budget: load the new dependency with import() where it is used.');
  process.exit(1);
}
