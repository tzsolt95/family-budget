// Keeps all data in the phone's local storage (phase 1: no cloud).

import { kindOf, suggestCategory, setUserRules, ruleKey, setItemRules, itemRuleKey } from './categories.js';
import { hintFor as cibHint } from './banks/cib.js';

const KEY = 'csaladi-kassza.v1';

function emptyState() {
  return { version: 1, transactions: {}, rules: {}, imports: [], cardOwners: {}, recurring: {}, itemRules: {} };
}

let state = load();
applyRules();
upgradeStoredData();

function applyRules() {
  setUserRules(state.rules);
  setItemRules(state.itemRules);
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...emptyState(), ...JSON.parse(raw) } : emptyState();
  } catch {
    return emptyState();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// Runs when the app opens: brings data saved by older app versions up to date.
// - CIB lines imported before bank hints existed get their hint.
// - Automatically sorted bank lines are sorted again, so new rules (e.g. the Baba
//   category) also apply to earlier months. Anything the user sorted is left alone.
function upgradeStoredData() {
  let changed = false;
  for (const tx of Object.values(state.transactions)) {
    if (tx.source !== 'bank') continue;
    if (!('hint' in tx) && tx.id.startsWith('cib|')) {
      tx.hint = cibHint(tx) ?? null;
      changed = true;
    }
    if (tx.categorySource !== 'auto') continue;
    const category = suggestCategory(tx);
    if (category !== tx.category) {
      tx.category = category;
      changed = true;
    }
  }
  if (changed) save();
}

const newId = (prefix) => `${prefix}|${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const allTransactions = () => Object.values(state.transactions);
export const getTransaction = (id) => state.transactions[id];
export const importHistory = () => [...state.imports].reverse();

// True when an uploaded statement covers this day, so a card payment should be on it.
export const statementCovers = (date) => state.imports.some((i) => i.periodFrom <= date && date <= i.periodTo);

// True when uploaded statements cover every day of the month (e.g. 1–14, 15–28, 29–30).
export function monthCovered(month) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  for (let d = 1; d <= days; d++) {
    if (!statementCovers(`${month}-${String(d).padStart(2, '0')}`)) return false;
  }
  return true;
}

// A card entry typed by hand that was later found on the bank statement is
// counted once, through the bank line. These are the items to show and sum.
export const countedTransactions = () => allTransactions().filter((t) => !t.linkedBankId);

// ---------- Card owners ----------

// Card owners are typed in by the user on the phone, so card digits never live in the code.
export function knownCards() {
  const cards = new Set(allTransactions().map((t) => t.cardLast4).filter(Boolean));
  return [...cards].sort().map((last4) => ({ last4, owner: state.cardOwners[last4] ?? '' }));
}

export function setCardOwner(last4, owner) {
  if (owner.trim()) state.cardOwners[last4] = owner.trim();
  else delete state.cardOwners[last4];
  save();
}

export function cardLabel(last4) {
  if (!last4) return '';
  const owner = state.cardOwners[last4];
  return owner ? `${owner} (••${last4})` : `kártya ••${last4}`;
}

export const cardOwner = (last4) => state.cardOwners[last4] ?? (last4 ? `••${last4}` : '');

// Names offered in the "Ki?" picker of manual entries.
export function people() {
  const owners = [...new Set(Object.values(state.cardOwners))];
  return [...(owners.length ? owners : ['Zsolt', 'Feleség']), 'Közös'];
}

// ---------- Bank import ----------

export function addBankTransactions(list, info) {
  let added = 0;
  for (const tx of list) {
    if (state.transactions[tx.id]) continue;
    state.transactions[tx.id] = {
      ...tx,
      source: 'bank',
      kind: kindOf(tx),
      category: suggestCategory(tx),
      categorySource: 'auto',
    };
    added++;
  }
  const linked = linkPendingManual();
  state.imports.push({ ...info, count: list.length, added, importedAt: new Date().toISOString() });
  const saved = save();
  return { added, skipped: list.length - added, linked, saved };
}

// Changes one transaction; with `remember`, also every auto-sorted item from the same shop.
export function setCategory(id, category, remember) {
  const tx = state.transactions[id];
  if (!tx) return 0;
  tx.category = category;
  tx.categorySource = 'user';
  let changed = 1;
  if (remember) {
    const key = ruleKey(tx);
    state.rules[key] = category;
    for (const other of allTransactions()) {
      if (other !== tx && other.kind === tx.kind && other.categorySource === 'auto' && ruleKey(other) === key) {
        other.category = category;
        changed++;
      }
    }
  }
  const manual = tx.linkedManualId && state.transactions[tx.linkedManualId];
  if (manual) manual.category = category;
  save();
  return changed;
}

// ---------- Manual entries ----------

const plain = (text) => (text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const dayDiff = (a, b) => Math.abs(Date.parse(`${a}T12:00:00`) - Date.parse(`${b}T12:00:00`)) / 86_400_000;

// Finds the bank line for a card/transfer entry, in the same direction:
// - same amount (±1 Ft) at most 3 days apart, or
// - a matching name, amount within 50% (foreign currency, price change), at most 7 days apart.
function findBankMatch(manual) {
  const words = plain(manual.title).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  let best = null;
  for (const bank of allTransactions()) {
    if (bank.source !== 'bank' || bank.linkedManualId || bank.kind !== manual.kind) continue;
    const days = dayDiff(bank.date, manual.date);
    if (days > 7) continue;
    const diff = Math.abs(Math.abs(bank.amount) - Math.abs(manual.amount));
    const exact = diff <= 1 && days <= 3;
    const nameHit = words.some((w) => plain(`${bank.title} ${bank.merchant ?? ''} ${bank.partner ?? ''}`).includes(w));
    if (!exact && !(nameHit && diff / Math.abs(manual.amount) <= 0.5)) continue;
    const score = (nameHit ? 0 : 1000) + diff + days;
    if (!best || score < best.score) best = { bank, score };
  }
  return best?.bank ?? null;
}

function link(manual, bank) {
  manual.linkedBankId = bank.id;
  bank.linkedManualId = manual.id;
  bank.category = manual.category;
  bank.categorySource = 'user';
}

function unlink(manual) {
  const bank = manual.linkedBankId && state.transactions[manual.linkedBankId];
  if (bank) delete bank.linkedManualId;
  delete manual.linkedBankId;
}

function linkPendingManual() {
  let linked = 0;
  for (const tx of allTransactions()) {
    if (tx.source !== 'manual' || tx.payment !== 'card' || tx.linkedBankId) continue;
    const bank = findBankMatch(tx);
    if (bank) {
      link(tx, bank);
      linked++;
    }
  }
  return linked;
}

// fields: { kind, amount (positive number), date, title, category, payment, person, note, items? }
// A receipt is a manual entry with `items`: [{ name, amount, category }].
function buildManual(fields, id, recurringId) {
  const items = fields.items?.length
    ? fields.items.map((i) => ({ name: i.name.trim(), amount: Math.abs(i.amount), category: i.category }))
    : undefined;
  return {
    id,
    source: 'manual',
    kind: fields.kind,
    amount: fields.kind === 'expense' ? -Math.abs(fields.amount) : Math.abs(fields.amount),
    date: fields.date,
    bookingDate: fields.date,
    title: fields.title.trim(),
    category: fields.category,
    categorySource: 'user',
    payment: fields.payment,
    person: fields.person,
    note: fields.note?.trim() || undefined,
    recurringId,
    items,
  };
}

// Remembers every item's category, so the same product is sorted the same way next time.
function rememberItems(items) {
  for (const item of items ?? []) {
    const key = itemRuleKey(item.name);
    if (key) state.itemRules[key] = item.category;
  }
}

// The biggest category on a receipt is shown as the receipt's own category.
export function mainCategory(items) {
  const totals = {};
  for (const i of items) totals[i.category] = (totals[i.category] ?? 0) + i.amount;
  return Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'other';
}

// Splits an item into category amounts (negative for spending). A bank line found for
// a receipt is split like the receipt; any difference stays in the main category.
export function categoryParts(tx) {
  const receipt = tx.items ? tx : (tx.linkedManualId && state.transactions[tx.linkedManualId]);
  if (!receipt?.items?.length) return [{ category: tx.category, amount: tx.amount }];
  const sign = tx.amount < 0 ? -1 : 1;
  const totals = {};
  for (const i of receipt.items) totals[i.category] = (totals[i.category] ?? 0) + sign * i.amount;
  const itemsSum = Object.values(totals).reduce((a, b) => a + b, 0);
  const main = mainCategory(receipt.items);
  totals[main] = Math.round((totals[main] + (tx.amount - itemsSum)) * 100) / 100;
  return Object.entries(totals).map(([category, amount]) => ({ category, amount }));
}

export function addManual(fields, repeatMonthly) {
  const id = newId('man');
  rememberItems(fields.items);
  let recurringId;
  if (repeatMonthly) {
    recurringId = newId('rec');
    state.recurring[recurringId] = {
      id: recurringId,
      ...fields,
      amount: Math.abs(fields.amount),
      day: Number(fields.date.slice(8, 10)),
      startMonth: fields.date.slice(0, 7),
      skipped: [],
      active: true,
    };
  }
  const tx = buildManual(fields, id, recurringId);
  state.transactions[id] = tx;
  if (tx.payment === 'card') {
    const bank = findBankMatch(tx);
    if (bank) link(tx, bank);
  }
  save();
  return tx;
}

export function updateManual(id, fields) {
  const old = state.transactions[id];
  if (!old || old.source !== 'manual') return null;
  unlink(old);
  rememberItems(fields.items);
  const tx = buildManual(fields, id, old.recurringId);
  state.transactions[id] = tx;
  if (tx.payment === 'card') {
    const bank = findBankMatch(tx);
    if (bank) link(tx, bank);
  }
  save();
  return tx;
}

export function deleteManual(id) {
  const tx = state.transactions[id];
  if (!tx || tx.source !== 'manual') return;
  unlink(tx);
  // A deleted repeat must not come back next time the app opens.
  const rec = tx.recurringId && state.recurring[tx.recurringId];
  if (rec) rec.skipped.push(tx.date.slice(0, 7));
  delete state.transactions[id];
  save();
}

// ---------- Monthly repeats ----------

export const getRecurring = (id) => state.recurring[id];

export function stopRecurring(id) {
  const rec = state.recurring[id];
  if (rec) {
    rec.active = false;
    save();
  }
}

function monthsBetween(from, to) {
  const out = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

function dateInMonth(month, day) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

// Adds this month's copy of every active repeat once its day has come.
// Returns how many items changed.
export function ensureRecurring(today) {
  let created = 0;
  for (const rec of Object.values(state.recurring)) {
    if (!rec.active) continue;
    const existing = new Set(allTransactions().filter((t) => t.recurringId === rec.id).map((t) => t.date.slice(0, 7)));
    for (const month of monthsBetween(rec.startMonth, today.slice(0, 7))) {
      const date = dateInMonth(month, rec.day);
      if (date > today || existing.has(month) || rec.skipped.includes(month)) continue;
      const tx = buildManual({ ...rec, date }, newId('man'), rec.id);
      state.transactions[tx.id] = tx;
      if (tx.payment === 'card') {
        const bank = findBankMatch(tx);
        if (bank) link(tx, bank);
      }
      created++;
    }
  }
  // Also retry waiting card entries, in case the matching rules found a bank line now.
  const linked = linkPendingManual();
  if (created || linked) save();
  return created + linked;
}

// Past names, newest first, for the name suggestions.
export function manualTitles() {
  return [...new Set(allTransactions()
    .filter((t) => t.source === 'manual')
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => t.title))];
}

// ---------- Backup ----------

export function exportBackup() {
  return JSON.stringify({ app: 'csaladi-kassza', exportedAt: new Date().toISOString(), ...state }, null, 2);
}

export function restoreBackup(text) {
  const data = JSON.parse(text);
  if (data.app !== 'csaladi-kassza' || typeof data.transactions !== 'object') {
    throw new Error('Ez nem a Családi Kassza mentése.');
  }
  state = {
    ...emptyState(),
    transactions: data.transactions,
    rules: data.rules ?? {},
    imports: data.imports ?? [],
    cardOwners: data.cardOwners ?? {},
    recurring: data.recurring ?? {},
    itemRules: data.itemRules ?? {},
  };
  applyRules();
  save();
  return Object.keys(state.transactions).length;
}

export function clearAll() {
  state = emptyState();
  applyRules();
  save();
}
