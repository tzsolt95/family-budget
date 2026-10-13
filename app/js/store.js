// Keeps all data in the phone's local storage (phase 1: no cloud).

import { kindOf, suggestCategory, setUserRules, ruleKey } from './categories.js';

const KEY = 'csaladi-kassza.v1';

function emptyState() {
  return { version: 1, transactions: {}, rules: {}, imports: [], cardOwners: {} };
}

let state = load();
setUserRules(state.rules);

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

export const allTransactions = () => Object.values(state.transactions);
export const getTransaction = (id) => state.transactions[id];
export const importHistory = () => [...state.imports].reverse();

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
  state.imports.push({ ...info, count: list.length, added, importedAt: new Date().toISOString() });
  const saved = save();
  return { added, skipped: list.length - added, saved };
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
  save();
  return changed;
}

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
  };
  setUserRules(state.rules);
  save();
  return Object.keys(state.transactions).length;
}

export function clearAll() {
  state = emptyState();
  setUserRules(state.rules);
  save();
}
