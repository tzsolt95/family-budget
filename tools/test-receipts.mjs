// Developer check for the receipt reader, using made-up sample receipts.
// Usage: node tools/test-receipts.mjs
import fs from 'node:fs';
import { parseReceipt } from '../app/js/receipt-parser.js';

const dir = new URL('./receipt-samples/', import.meta.url);
const expected = {
  'spar-inline.txt': { shop: 'Spar', date: '2026-09-27', payment: 'card', total: 6973, count: 7 },
  'tesco-columns.txt': { shop: 'Tesco', date: '2026-10-05', payment: 'cash', total: 4196, count: 4 },
  'small-shop.txt': { shop: 'Kovács Pékség', date: '2026-10-08', payment: 'cash', total: 700, count: 2 },
};

let failed = 0;
for (const [file, want] of Object.entries(expected)) {
  const r = parseReceipt(fs.readFileSync(new URL(file, dir), 'utf8'));
  const got = { shop: r.shop, date: r.date, payment: r.payment, total: r.total, count: r.items.length };
  const bad = Object.keys(want).filter((k) => want[k] !== got[k]);
  if (r.sum !== r.total) bad.push(`sum ${r.sum} != total ${r.total}`);
  console.log(bad.length ? 'FAIL' : 'PASS', file, bad.length ? JSON.stringify({ got, bad }) : '');
  if (bad.length) { failed++; console.log(r.items); }
}
process.exit(failed ? 1 : 0);
