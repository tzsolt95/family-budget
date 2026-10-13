// Screen logic: tabs, monthly list, PDF import, backup.

import * as store from './store.js';
import { KINDS, categoryById, categoriesForKind } from './categories.js';

const $ = (sel) => document.querySelector(sel);

const huf = new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 });
const monthFmt = new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'long' });
const dayFmt = new Intl.DateTimeFormat('hu-HU', { month: 'long', day: 'numeric', weekday: 'long' });
const dateFmt = new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' });

const parseDate = (iso) => new Date(`${iso}T12:00:00`);
const monthOf = (tx) => tx.date.slice(0, 7);

const ui = { month: null, filter: 'all', openId: null, groups: new Map() };

// The bank's automatic round-up savings ("WITHSAVE") come many times a day.
const isAutoSaving = (tx) => tx.kind === 'saving' && /WITHSAVE/i.test(tx.note ?? '');

// Combines a day's automatic savings into one list row.
function groupAutoSavings(list) {
  ui.groups.clear();
  const out = [];
  for (const tx of list) {
    if (!isAutoSaving(tx)) {
      out.push(tx);
      continue;
    }
    const id = `auto|${tx.date}`;
    let group = ui.groups.get(id);
    if (!group) {
      group = {
        id, isGroup: true, items: [], amount: 0,
        kind: 'saving', category: 'saving', title: 'Automatikus megtakarítás',
        date: tx.date, bookingDate: tx.bookingDate,
      };
      ui.groups.set(id, group);
      out.push(group);
    }
    group.items.push(tx);
    group.amount = Math.round((group.amount + tx.amount) * 100) / 100;
  }
  return out;
}

// ---------- Tabs ----------

function showView() {
  const view = location.hash === '#import' ? 'import' : 'list';
  $('#view-list').hidden = view !== 'list';
  $('#view-import').hidden = view !== 'import';
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.view === view));
  if (view === 'list') renderList();
  else renderHistory();
  window.scrollTo(0, 0);
}

// ---------- Monthly list ----------

function availableMonths() {
  return [...new Set(store.allTransactions().map(monthOf))].sort();
}

function renderList() {
  const months = availableMonths();
  if (!ui.month || !months.includes(ui.month)) ui.month = months.at(-1) ?? new Date().toISOString().slice(0, 7);
  const index = months.indexOf(ui.month);
  $('#month-label').textContent = monthFmt.format(parseDate(`${ui.month}-01`));
  $('#month-prev').disabled = index <= 0;
  $('#month-next').disabled = index === -1 || index >= months.length - 1;

  const inMonth = store.allTransactions().filter((t) => monthOf(t) === ui.month);
  const total = (kind) => inMonth.filter((t) => t.kind === kind).reduce((s, t) => s + t.amount, 0);
  // `|| 0` turns -0 into 0, so an empty month shows "0 Ft" instead of "-0 Ft".
  $('#sum-income').textContent = huf.format(total('income') || 0);
  $('#sum-expense').textContent = huf.format(-total('expense') || 0);
  $('#sum-saving').textContent = huf.format(-(total('saving') + total('saving_withdrawal')) || 0);

  const shown = groupAutoSavings(inMonth
    .filter((t) => ui.filter === 'all'
      || t.kind === ui.filter
      || (ui.filter === 'saving' && t.kind === 'saving_withdrawal'))
    .sort((a, b) => b.date.localeCompare(a.date) || b.bookingDate.localeCompare(a.bookingDate)));

  const list = $('#tx-list');
  list.replaceChildren();
  let group = null;
  let lastDay = null;
  for (const tx of shown) {
    if (tx.date !== lastDay) {
      lastDay = tx.date;
      const heading = document.createElement('div');
      heading.className = 'day';
      heading.textContent = dayFmt.format(parseDate(tx.date));
      group = document.createElement('div');
      group.className = 'group';
      list.append(heading, group);
    }
    group.append(txRow(tx));
  }
  $('#empty-state').hidden = shown.length > 0;
}

function txRow(tx) {
  const cat = categoryById(tx.category);
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'tx';
  row.dataset.id = tx.id;

  const icon = document.createElement('span');
  icon.className = 'tx-icon';
  icon.textContent = cat.icon;

  const main = document.createElement('span');
  main.className = 'tx-main';
  const title = document.createElement('div');
  title.className = 'tx-title';
  title.textContent = tx.title;
  const sub = document.createElement('div');
  sub.className = 'tx-sub';
  sub.textContent = tx.isGroup
    ? `${cat.label} · ${tx.items.length} db utalás`
    : [cat.label, tx.cardLast4 && store.cardOwner(tx.cardLast4)].filter(Boolean).join(' · ');
  main.append(title, sub);

  const amount = document.createElement('span');
  amount.className = `tx-amount ${amountClass(tx)}`;
  amount.textContent = huf.format(tx.amount);

  row.append(icon, main, amount);
  return row;
}

function amountClass(tx) {
  if (tx.kind === 'saving' || tx.kind === 'saving_withdrawal') return 'save';
  return tx.amount < 0 ? 'neg' : 'pos';
}

// ---------- Detail dialog ----------

function openDetails(id) {
  const tx = ui.groups.get(id) ?? store.getTransaction(id);
  if (!tx) return;
  ui.openId = id;
  $('#dlg-title').textContent = tx.title;
  const amount = $('#dlg-amount');
  amount.textContent = huf.format(tx.amount);
  amount.className = `dlg-amount ${amountClass(tx)}`;

  const details = tx.isGroup ? [
    ['Típus', KINDS[tx.kind]],
    ['Dátum', dateFmt.format(parseDate(tx.date))],
    ['Utalások', `${tx.items.length} db`],
    ['Összegek', tx.items.map((t) => huf.format(-t.amount)).join(', ')],
    ['Magyarázat', 'A bank automatikusan félretett apró összegei, naponta egy sorba összevonva.'],
  ] : [
    ['Típus', KINDS[tx.kind]],
    ['Dátum', dateFmt.format(parseDate(tx.date))],
    tx.bookingDate !== tx.date && ['Könyvelve', dateFmt.format(parseDate(tx.bookingDate))],
    ['Banki leírás', tx.type],
    tx.city && ['Hely', tx.city],
    tx.cardLast4 && ['Kártya', store.cardLabel(tx.cardLast4)],
    tx.originalAmount && ['Eredeti összeg', tx.originalAmount],
    tx.note && ['Közlemény', tx.note],
  ].filter(Boolean);
  $('#dlg-details').replaceChildren(...details.flatMap(([k, v]) => {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    return [dt, dd];
  }));

  const select = $('#dlg-category');
  select.replaceChildren(...categoriesForKind(tx.kind).map((c) => new Option(`${c.icon} ${c.label}`, c.id)));
  select.value = tx.category;
  const fixedKind = tx.kind === 'saving' || tx.kind === 'saving_withdrawal';
  select.disabled = fixedKind;
  $('#dlg-remember').closest('label').hidden = fixedKind;

  $('#tx-dialog').showModal();
}

function saveDetails(event) {
  if (event.submitter?.value === 'save' && ui.openId && !ui.groups.has(ui.openId)) {
    const tx = store.getTransaction(ui.openId);
    const category = $('#dlg-category').value;
    if (tx && category !== tx.category) {
      const changed = store.setCategory(ui.openId, category, $('#dlg-remember').checked);
      toast(changed > 1 ? `${changed} tétel átsorolva: ${categoryById(category).label}` : 'Kategória mentve');
      renderList();
    }
  }
  ui.openId = null;
}

// ---------- PDF import ----------

let pdfjsPromise = null;
function loadPdfJs() {
  pdfjsPromise ??= import('../vendor/pdfjs/pdf.min.mjs').then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    return lib;
  });
  return pdfjsPromise;
}

async function importPdfFiles(files) {
  const results = $('#import-results');
  results.replaceChildren();
  let lastMonth = null;

  for (const file of files) {
    const box = document.createElement('div');
    box.className = 'result';
    box.textContent = `${file.name}: beolvasás…`;
    results.append(box);
    try {
      const [{ extractRows }, { parseCibStatement }, pdfjsLib] = await Promise.all([
        import('./pdf-text.js'),
        import('./cib-parser.js'),
        loadPdfJs(),
      ]);
      const pages = await extractRows(pdfjsLib, new Uint8Array(await file.arrayBuffer()));
      const { meta, transactions, check } = parseCibStatement(pages);
      if (transactions.length === 0) throw new Error(check.problems[0] ?? 'Nem található tranzakció.');

      const { added, skipped, saved } = store.addBankTransactions(transactions, {
        file: file.name, periodFrom: meta.periodFrom, periodTo: meta.periodTo, ok: check.ok,
      });
      if (!saved) throw new Error('Nem sikerült menteni: megtelt a tárhely.');
      lastMonth = transactions.at(-1).date.slice(0, 7);
      renderResult(box, file.name, meta, check, added, skipped);
    } catch (err) {
      box.className = 'result warn';
      box.textContent = `${file.name}: ${err.message || 'Hiba a beolvasás közben.'}`;
    }
  }
  if (lastMonth) ui.month = lastMonth;
  renderHistory();
}

function renderResult(box, name, meta, check, added, skipped) {
  box.className = `result ${check.ok ? 'ok' : 'warn'}`;
  const period = meta.periodFrom ? `${meta.periodFrom.replaceAll('-', '.')} – ${meta.periodTo.replaceAll('-', '.')}` : '';
  const strong = document.createElement('strong');
  strong.textContent = name;
  const lines = [
    period && `Időszak: ${period}`,
    `Új tétel: ${added}${skipped ? `, már meglévő (kihagyva): ${skipped}` : ''}`,
    check.ok ? '✓ Az összegek egyeznek a kivonattal.' : '⚠️ Eltérés a kivonathoz képest:',
  ].filter(Boolean);
  box.replaceChildren(strong, ...lines.flatMap((l) => [document.createElement('br'), l]));
  if (!check.ok) {
    const ul = document.createElement('ul');
    for (const p of check.problems.slice(0, 5)) {
      const li = document.createElement('li');
      li.textContent = p;
      ul.append(li);
    }
    box.append(ul);
  }
}

function renderCards() {
  const cards = store.knownCards();
  $('#cards-card').hidden = cards.length === 0;
  $('#card-list').replaceChildren(...cards.map(({ last4, owner }) => {
    const label = document.createElement('label');
    label.className = 'field card-field';
    label.textContent = `Kártya ••${last4}`;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = owner;
    input.placeholder = 'Kié? (pl. Zsolt)';
    input.autocomplete = 'off';
    input.addEventListener('change', () => {
      store.setCardOwner(last4, input.value);
      toast('Kártya neve mentve');
    });
    label.append(input);
    return label;
  }));
}

function renderHistory() {
  renderCards();
  const list = $('#import-history');
  const items = store.importHistory();
  list.replaceChildren(...items.map((imp) => {
    const li = document.createElement('li');
    const when = dateFmt.format(new Date(imp.importedAt));
    li.textContent = `${when}: ${imp.periodFrom ?? '?'} – ${imp.periodTo ?? '?'} (${imp.added} új / ${imp.count})${imp.ok ? '' : ' ⚠️'}`;
    return li;
  }));
  if (items.length === 0) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Még nem volt feltöltés.';
    list.append(li);
  }
}

// ---------- Backup ----------

function downloadBackup() {
  const blob = new Blob([store.exportBackup()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `csaladi-kassza-mentes-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

async function restore(file) {
  if (!confirm('A visszatöltés lecseréli a jelenlegi adatokat a mentésben lévőkre. Folytatod?')) return;
  try {
    const count = store.restoreBackup(await file.text());
    ui.month = null;
    toast(`Visszatöltve: ${count} tétel`);
    renderHistory();
  } catch (err) {
    toast(err.message || 'Hibás mentés fájl.');
  }
}

// ---------- Helpers ----------

let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

// ---------- Wiring ----------

window.addEventListener('hashchange', showView);

$('#month-prev').addEventListener('click', () => {
  const months = availableMonths();
  ui.month = months[months.indexOf(ui.month) - 1] ?? ui.month;
  renderList();
});
$('#month-next').addEventListener('click', () => {
  const months = availableMonths();
  ui.month = months[months.indexOf(ui.month) + 1] ?? ui.month;
  renderList();
});

document.querySelector('.chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  ui.filter = chip.dataset.filter;
  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
  renderList();
});

$('#tx-list').addEventListener('click', (e) => {
  const row = e.target.closest('.tx');
  if (row) openDetails(row.dataset.id);
});
$('#tx-dialog form').addEventListener('submit', saveDetails);

$('#pdf-input').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  if (files.length) await importPdfFiles(files);
});
$('#backup-btn').addEventListener('click', downloadBackup);
$('#restore-input').addEventListener('change', async (e) => {
  const [file] = e.target.files;
  e.target.value = '';
  if (file) await restore(file);
});
$('#clear-btn').addEventListener('click', () => {
  if (!confirm('Biztosan törölsz minden adatot erről a telefonról? Ez nem vonható vissza.')) return;
  store.clearAll();
  ui.month = null;
  toast('Minden adat törölve');
  renderHistory();
});

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
navigator.storage?.persist?.().catch(() => {});

showView();
