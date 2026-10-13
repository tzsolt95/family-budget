// Monthly numbers for the "Kimutatás" tab.

import * as store from './store.js';

const round = (n) => Math.round(n * 100) / 100;

export function monthKey(date) {
  return date.slice(0, 7);
}

export function shiftMonth(month, delta) {
  let [y, m] = month.split('-').map(Number);
  m += delta;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

// All amounts are positive numbers in Ft, except `saved`, which is
// "put away minus taken back" and can be negative.
export function monthSummary(month) {
  const txs = store.countedTransactions().filter((t) => monthKey(t.date) === month);
  const byCategory = {};
  let income = 0;
  let expense = 0;
  let putAway = 0;
  let takenBack = 0;
  let cash = 0;

  for (const tx of txs) {
    if (tx.kind === 'income') income += tx.amount;
    else if (tx.kind === 'saving') putAway += -tx.amount;
    else if (tx.kind === 'saving_withdrawal') takenBack += tx.amount;
    else if (tx.kind === 'cash') cash += -tx.amount;
    else if (tx.kind === 'expense') {
      // Receipts (and bank lines linked to them) are split by item category.
      for (const part of store.categoryParts(tx)) {
        byCategory[part.category] = (byCategory[part.category] ?? 0) - part.amount;
        expense -= part.amount;
      }
    }
  }

  const categories = Object.entries(byCategory)
    .map(([category, amount]) => ({ category, amount: round(amount) }))
    .filter((c) => c.amount > 0.5)
    .sort((a, b) => b.amount - a.amount);

  return {
    month,
    count: txs.length,
    // Complete: a statement covers the whole month, or it holds hand-typed entries.
    complete: store.monthCovered(month) || txs.some((t) => t.source === 'manual'),
    income: round(income),
    expense: round(expense),
    left: round(income - expense),
    putAway: round(putAway),
    takenBack: round(takenBack),
    saved: round(putAway - takenBack),
    cash: round(cash),
    categories,
  };
}

// The selected month and up to five before it, oldest first. Leading months that are
// empty or only partly known (a few card payments booked into the next statement) are left out.
export function recentMonths(month, count = 6) {
  const months = [];
  for (let i = count - 1; i >= 0; i--) months.push(monthSummary(shiftMonth(month, -i)));
  while (months.length > 1 && !months[0].complete) months.shift();
  return months;
}
