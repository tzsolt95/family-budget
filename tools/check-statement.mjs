// Developer check: parses CIB PDFs with the app's own parser and prints a summary.
// Usage: npm run check -- <statement.pdf> [more.pdf ...]
// Prints only totals and category counts, never the individual transactions.

import fs from 'node:fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractRows } from '../app/js/pdf-text.js';
import { parseCibStatement } from '../app/js/cib-parser.js';
import { suggestCategory, categoryById, kindOf } from '../app/js/categories.js';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Add meg a PDF fájl(oka)t.');
  process.exit(1);
}

let failed = false;
for (const file of files) {
  const pages = await extractRows(pdfjsLib, new Uint8Array(fs.readFileSync(file)));
  const { meta, transactions, check } = parseCibStatement(pages);
  console.log(`\n${file.split('/').at(-1)}: ${meta.periodFrom} – ${meta.periodTo}, ${transactions.length} tétel`);
  console.log(`  ellenőrzés: ${check.ok ? 'rendben' : 'HIBA'}`);
  for (const p of check.problems) console.log(`  - ${p}`);
  failed ||= !check.ok;

  const counts = {};
  for (const tx of transactions) {
    const label = `${kindOf(tx)} / ${categoryById(suggestCategory(tx)).label}`;
    counts[label] = (counts[label] ?? 0) + 1;
  }
  for (const [label, n] of Object.entries(counts).sort()) console.log(`  ${String(n).padStart(3)}  ${label}`);
  const ids = new Set(transactions.map((t) => t.id));
  if (ids.size !== transactions.length) {
    console.log('  HIBA: ismétlődő azonosítók');
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
