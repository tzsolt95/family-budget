// Screen logic: tabs, monthly list, report, manual entries, receipts, PDF import, backup.

import * as store from './store.js';
import { KINDS, categoryById, categoriesForKind, isTransferKind, suggestForName, suggestItemCategory } from './categories.js';
import { parseReceipt, parsePrice } from './receipt-parser.js';
import { recentMonths } from './report.js';
import { supportedBanks } from './banks/index.js';

const $ = (sel) => document.querySelector(sel);

const huf = new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 });
const monthFmt = new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'long' });
const dayFmt = new Intl.DateTimeFormat('hu-HU', { month: 'long', day: 'numeric', weekday: 'long' });
const dateFmt = new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' });

const parseDate = (iso) => new Date(`${iso}T12:00:00`);
const monthOf = (tx) => tx.date.slice(0, 7);

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

const VIEWS = { '#report': 'report', '#import': 'import' };
const currentView = () => VIEWS[location.hash] ?? 'list';

function showView() {
  const view = currentView();
  $('#view-list').hidden = view !== 'list';
  $('#view-report').hidden = view !== 'report';
  $('#view-import').hidden = view !== 'import';
  $('#month-nav').hidden = view === 'import';
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.view === view));
  if (view === 'import') renderHistory();
  else renderCurrent();
  window.scrollTo(0, 0);
}

// ---------- Monthly list ----------

function availableMonths() {
  return [...new Set(store.countedTransactions().map(monthOf))].sort();
}

function renderMonthNav() {
  const months = availableMonths();
  if (!ui.month || !months.includes(ui.month)) ui.month = months.at(-1) ?? todayIso().slice(0, 7);
  const index = months.indexOf(ui.month);
  $('#month-label').textContent = monthFmt.format(parseDate(`${ui.month}-01`));
  $('#month-prev').disabled = index <= 0;
  $('#month-next').disabled = index === -1 || index >= months.length - 1;
}

// Redraws whichever of the two month-based tabs is open.
function renderCurrent() {
  renderMonthNav();
  if (currentView() === 'report') renderReport();
  else if (currentView() === 'list') renderList();
}

function renderList() {
  const inMonth = store.countedTransactions().filter((t) => monthOf(t) === ui.month);
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
  title.textContent = displayTitle(tx);
  const sub = document.createElement('div');
  sub.className = 'tx-sub';
  sub.textContent = subtitle(tx, cat);
  main.append(title, sub);

  const amount = document.createElement('span');
  amount.className = `tx-amount ${amountClass(tx)}`;
  amount.textContent = huf.format(tx.amount);

  row.append(icon, main, amount);
  return row;
}

// A bank line found for a hand-typed entry shows the hand-typed name.
function displayTitle(tx) {
  const manual = tx.linkedManualId && store.getTransaction(tx.linkedManualId);
  return manual ? manual.title : tx.title;
}

function subtitle(tx, cat) {
  if (tx.isGroup) return `${cat.label} · ${tx.items.length} db utalás`;
  if (tx.source === 'manual') {
    let how = '💵 készpénz';
    if (tx.payment === 'card') how = store.statementCovers(tx.date) ? '⚠️ nincs meg a kivonaton' : '💳 várja a kivonatot';
    const what = tx.items ? `🧾 ${tx.items.length} tétel` : cat.label;
    return [what, tx.person, how, tx.recurringId && '🔁'].filter(Boolean).join(' · ');
  }
  const receipt = tx.linkedManualId && store.getTransaction(tx.linkedManualId)?.items;
  return [receipt ? `🧾 ${receipt.length} tétel` : cat.label, tx.cardLast4 && store.cardOwner(tx.cardLast4),
    tx.linkedManualId && (receipt ? '🔗 blokkal' : '🔗 kézzel is felvéve')]
    .filter(Boolean).join(' · ');
}

function amountClass(tx) {
  if (tx.kind === 'cash') return 'muted';
  if (tx.kind === 'saving' || tx.kind === 'saving_withdrawal') return 'save';
  return tx.amount < 0 ? 'neg' : 'pos';
}

// ---------- Detail dialog ----------

function openDetails(id) {
  const tx = ui.groups.get(id) ?? store.getTransaction(id);
  if (!tx) return;
  ui.openId = id;
  $('#dlg-title').textContent = displayTitle(tx);
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
    tx.linkedManualId && ['Kézzel felvéve', displayTitle(tx)],
    tx.kind === 'cash' && ['Megjegyzés', 'Nem számít kiadásnak: a készpénzes vásárlásokat kézzel rögzítsd.'],
  ].filter(Boolean);
  $('#dlg-details').replaceChildren(...details.flatMap(([k, v]) => {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    return [dt, dd];
  }));

  const parts = tx.isGroup ? [] : store.categoryParts(tx);
  const partsList = $('#dlg-parts');
  partsList.hidden = parts.length < 2;
  partsList.replaceChildren(...parts.map((part) => {
    const li = document.createElement('li');
    const c = categoryById(part.category);
    const name = document.createElement('span');
    name.textContent = `${c.icon} ${c.label}`;
    const value = document.createElement('span');
    value.textContent = huf.format(part.amount);
    li.append(name, value);
    return li;
  }));

  const select = $('#dlg-category');
  select.replaceChildren(...categoriesForKind(tx.kind).map((c) => new Option(`${c.icon} ${c.label}`, c.id)));
  select.value = tx.category;
  const fixedKind = isTransferKind(tx.kind);
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
      renderCurrent();
    }
  }
  ui.openId = null;
}

// ---------- Kimutatás ----------

const pct = new Intl.NumberFormat('hu-HU', { style: 'percent', maximumFractionDigits: 0 });
const shortMonth = new Intl.DateTimeFormat('hu-HU', { month: 'short' });
const longMonth = new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'long' });
const monthName = (m, fmt = shortMonth) => fmt.format(parseDate(`${m}-01`));

// "+12 400 Ft az előző hónaphoz képest", coloured by whether the change is good.
function setDelta(el, now, before, upIsGood) {
  if (before === null) {
    el.textContent = '';
    return;
  }
  const diff = Math.round(now - before);
  el.className = diff === 0 ? '' : (diff > 0) === upIsGood ? 'good' : 'bad';
  el.textContent = diff === 0
    ? 'ugyanannyi, mint az előző hónapban'
    : `${diff > 0 ? '▲ +' : '▼ −'}${huf.format(Math.abs(diff))} az előző hónaphoz képest`;
}

function renderReport() {
  const months = recentMonths(ui.month);
  const now = months.at(-1);
  const prev = months.length > 1 && months.at(-2).complete ? months.at(-2) : null;

  $('#kpi-income').textContent = huf.format(now.income || 0);
  $('#kpi-expense').textContent = huf.format(now.expense || 0);
  $('#kpi-left').textContent = huf.format(now.left || 0);
  setDelta($('#kpi-income-delta'), now.income, prev ? prev.income : null, true);
  setDelta($('#kpi-expense-delta'), now.expense, prev ? prev.expense : null, false);
  setDelta($('#kpi-left-delta'), now.left, prev ? prev.left : null, true);
  const cashNote = $('#kpi-cash');
  cashNote.hidden = !now.cash;
  cashNote.textContent = `💵 Készpénzfelvétel: ${huf.format(now.cash)} (nem számít kiadásnak; a készpénzes vásárlások kézzel rögzítve számítanak)`;

  renderCategoryBars(now);
  renderMonthColumns(months);
  renderSavings(months);
}

function renderCategoryBars(summary) {
  const max = summary.categories[0]?.amount ?? 0;
  $('#cat-empty').hidden = summary.categories.length > 0;
  $('#cat-bars').replaceChildren(...summary.categories.map(({ category, amount }) => {
    const c = categoryById(category);
    const row = document.createElement('div');
    row.className = 'hbar';
    const label = document.createElement('span');
    label.className = 'hbar-label';
    label.textContent = `${c.icon} ${c.label}`;
    const value = document.createElement('span');
    value.className = 'hbar-value';
    value.textContent = huf.format(amount);
    const share = document.createElement('small');
    share.textContent = pct.format(amount / summary.expense);
    value.append(share);
    const track = document.createElement('div');
    track.className = 'hbar-track';
    const fill = document.createElement('div');
    fill.className = 'hbar-fill';
    fill.style.width = `${(amount / max) * 100}%`;
    track.append(fill);
    row.append(label, value, track);
    return row;
  }));
}

// "2026. szeptember: Bevétel 766 008 Ft · Kiadás …" - values bold, labels quiet.
function setReadout(el, title, parts) {
  el.replaceChildren(`${title}: `, ...parts.flatMap(([label, value], i) => {
    const strong = document.createElement('strong');
    strong.textContent = value;
    return [i ? ' · ' : '', `${label} `, strong];
  }));
}

function monthReadout(m) {
  setReadout($('#month-readout'), monthName(m.month, longMonth), [
    ['Bevétel', huf.format(m.income || 0)],
    ['Kiadás', huf.format(m.expense || 0)],
    ['Maradék', huf.format(m.left || 0)],
  ]);
}

function columnButton(m, onSelect) {
  const col = document.createElement('button');
  col.type = 'button';
  col.className = `col${m.month === ui.month ? ' active' : ''}`;
  col.addEventListener('pointerenter', () => onSelect(m));
  col.addEventListener('focus', () => onSelect(m));
  col.addEventListener('click', () => onSelect(m));
  return col;
}

function renderMonthColumns(months) {
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  $('#month-cols').replaceChildren(...months.map((m) => {
    const col = columnButton(m, monthReadout);
    col.setAttribute('aria-label', `${monthName(m.month, longMonth)}: bevétel ${huf.format(m.income)}, kiadás ${huf.format(m.expense)}`);
    const bars = document.createElement('div');
    bars.className = 'col-bars';
    for (const [cls, value] of [['income', m.income], ['expense', m.expense]]) {
      const bar = document.createElement('div');
      bar.className = `col-bar ${cls}`;
      bar.style.height = `${(value / max) * 100}%`;
      bars.append(bar);
    }
    const label = document.createElement('span');
    label.className = 'col-label';
    label.textContent = monthName(m.month);
    col.append(bars, label);
    return col;
  }));
  monthReadout(months.at(-1));
  $('#month-cols').onpointerleave = () => monthReadout(months.at(-1));

  const table = $('#month-table');
  const head = document.createElement('tr');
  for (const h of ['Hónap', 'Bevétel', 'Kiadás', 'Maradék', 'Megtak.']) {
    const th = document.createElement('th');
    th.textContent = h;
    head.append(th);
  }
  table.replaceChildren(head, ...months.map((m) => {
    const tr = document.createElement('tr');
    for (const v of [monthName(m.month, longMonth), m.income, m.expense, m.left, m.saved]) {
      const td = document.createElement('td');
      td.textContent = typeof v === 'number' ? huf.format(v || 0) : v;
      tr.append(td);
    }
    return tr;
  }));
}

function savingReadout(m) {
  setReadout($('#saving-readout'), monthName(m.month, longMonth), [
    ['Félretett', huf.format(m.putAway || 0)],
    ['Visszavett', huf.format(m.takenBack || 0)],
    ['Nettó', huf.format(m.saved || 0)],
  ]);
}

function renderSavings(months) {
  const now = months.at(-1);
  $('#sav-put').textContent = huf.format(now.putAway || 0);
  $('#sav-back').textContent = huf.format(now.takenBack || 0);
  const net = $('#sav-net');
  net.textContent = huf.format(now.saved || 0);
  net.className = now.saved < 0 ? 'neg' : '';

  const max = Math.max(1, ...months.map((m) => Math.abs(m.saved)));
  $('#saving-cols').replaceChildren(...months.map((m) => {
    const col = columnButton(m, savingReadout);
    col.setAttribute('aria-label', `${monthName(m.month, longMonth)}: nettó megtakarítás ${huf.format(m.saved)}`);
    const up = document.createElement('div');
    up.className = 'div-half up';
    const down = document.createElement('div');
    down.className = 'div-half down';
    const bar = document.createElement('div');
    bar.className = `div-bar ${m.saved >= 0 ? 'pos' : 'neg'}`;
    bar.style.height = `${(Math.abs(m.saved) / max) * 100}%`;
    (m.saved >= 0 ? up : down).append(bar);
    const label = document.createElement('span');
    label.className = 'col-label';
    label.textContent = monthName(m.month);
    col.append(up, down, label);
    return col;
  }));
  savingReadout(now);
  $('#saving-cols').onpointerleave = () => savingReadout(now);
}

// ---------- Manual entry dialog ----------

const entryForm = () => $('#entry-form');
let entryCategoryTouched = false;

function fillSelect(select, options, value) {
  select.replaceChildren(...options.map(([v, label]) => new Option(label, v)));
  if (value !== undefined) select.value = value;
}

function refreshEntryCategories(keep) {
  const form = entryForm();
  const kind = form.kind.value;
  const current = keep ?? form.category.value;
  const options = categoriesForKind(kind).map((c) => [c.id, `${c.icon} ${c.label}`]);
  fillSelect(form.category, options);
  form.category.value = options.some(([id]) => id === current) ? current : suggestForName(form.title.value, kind);
}

function refreshPaymentHint() {
  const form = entryForm();
  $('#payment-hint').textContent = form.payment.value === 'card'
    ? 'Ha később feltöltöd a bankkivonatot, az app megkeresi ezt a tételt, és csak egyszer számolja.'
    : 'Készpénz: nem jelenik meg a bankkivonaton, ezért külön számolódik.';
}

function openEntry(id) {
  const form = entryForm();
  const tx = id ? store.getTransaction(id) : null;
  form.reset();
  ui.openId = id ?? null;
  entryCategoryTouched = Boolean(tx);

  $('#entry-heading').textContent = tx ? 'Tétel szerkesztése' : 'Új tétel';
  form.kind.value = tx?.kind ?? 'expense';
  form.amount.value = tx ? String(Math.abs(tx.amount)) : '';
  form.title.value = tx?.title ?? '';
  form.date.value = tx?.date ?? todayIso();
  form.payment.value = tx?.payment ?? 'cash';
  form.note.value = tx?.note ?? '';
  fillSelect(form.person, store.people().map((p) => [p, p]), tx?.person ?? store.people()[0]);
  if (tx?.person && form.person.value !== tx.person) {
    form.person.append(new Option(tx.person, tx.person));
    form.person.value = tx.person;
  }
  refreshEntryCategories(tx?.category ?? 'other');
  if (!tx) form.category.value = 'other';
  refreshPaymentHint();

  $('#title-suggestions').replaceChildren(...store.manualTitles().slice(0, 30).map((t) => new Option(t)));

  const rec = tx?.recurringId && store.getRecurring(tx.recurringId);
  $('#repeat-row').hidden = Boolean(tx);
  $('#entry-extra').hidden = !tx;
  $('#stop-repeat-btn').hidden = !rec?.active;

  const status = $('#entry-status');
  const notes = [
    rec && (rec.active ? '🔁 Havonta ismétlődő tétel. A változtatás csak erre a hónapra vonatkozik.' : '🔁 Az ismétlés le van állítva.'),
    tx?.linkedBankId && '🔗 Megtalálva a bankkivonaton, ezért a banki tétel számít bele az összesítőbe.',
    tx && tx.payment === 'card' && !tx.linkedBankId && store.statementCovers(tx.date)
      && '⚠️ A feltöltött kivonaton nem találtam meg. Ellenőrizd a nevet, az összeget és a dátumot, különben kétszer számolódhat.',
  ].filter(Boolean);
  status.textContent = notes.join(' ');
  status.hidden = notes.length === 0;

  $('#entry-dialog').showModal();
  if (!tx) form.amount.focus();
}

function parseAmountInput(text) {
  const n = Number(text.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

function saveEntry(event) {
  const action = event.submitter?.value;
  const form = entryForm();
  const id = ui.openId;
  ui.openId = null;

  if (action === 'delete') {
    if (!confirm('Biztosan törlöd ezt a tételt?')) { event.preventDefault(); ui.openId = id; return; }
    store.deleteManual(id);
    toast('Tétel törölve');
  } else if (action === 'stop-repeat') {
    const tx = store.getTransaction(id);
    store.stopRecurring(tx.recurringId);
    toast('Az ismétlés leállítva. A korábbi tételek megmaradnak.');
  } else if (action === 'save') {
    const amount = parseAmountInput(form.amount.value);
    if (!(amount > 0)) {
      event.preventDefault();
      ui.openId = id;
      toast('Adj meg egy 0-nál nagyobb összeget.');
      form.amount.focus();
      return;
    }
    const fields = {
      kind: form.kind.value,
      amount,
      date: form.date.value,
      title: form.title.value,
      category: form.category.value,
      payment: form.payment.value,
      person: form.person.value,
      note: form.note.value,
    };
    const tx = id ? store.updateManual(id, fields) : store.addManual(fields, form.repeat.checked);
    if (!id && form.repeat.checked) store.ensureRecurring(todayIso());
    ui.month = tx.date.slice(0, 7);
    toast(tx.linkedBankId ? 'Mentve, és összekapcsolva a banki tétellel 🔗' : 'Mentve');
  }
  renderCurrent();
}

// ---------- Receipt dialog ----------

const receiptForm = () => $('#receipt-form');

function showReceiptStep(step) {
  $('#receipt-step-paste').hidden = step !== 'paste';
  $('#receipt-step-check').hidden = step !== 'check';
}

function openReceipt(id) {
  const form = receiptForm();
  const tx = id ? store.getTransaction(id) : null;
  form.reset();
  ui.openId = id ?? null;
  $('#receipt-heading').textContent = tx ? 'Blokk szerkesztése' : 'Blokk beillesztése';
  $('#receipt-extra').hidden = !tx;
  fillSelect(form.person, store.people().map((p) => [p, p]), tx?.person ?? store.people()[0]);
  if (tx) {
    fillReceipt({ shop: tx.title, date: tx.date, payment: tx.payment, total: Math.abs(tx.amount), items: tx.items }, true);
    showReceiptStep('check');
  } else {
    showReceiptStep('paste');
  }
  const status = $('#receipt-status');
  status.textContent = tx?.linkedBankId ? '🔗 Megtalálva a bankkivonaton: a banki tétel a blokk kategóriái szerint oszlik meg.' : '';
  status.hidden = !tx?.linkedBankId;
  $('#receipt-dialog').showModal();
}

function itemRow(item) {
  const row = document.createElement('div');
  row.className = 'item-row';
  const name = document.createElement('input');
  name.className = 'item-name';
  name.value = item.name ?? '';
  name.placeholder = 'Megnevezés';
  const amount = document.createElement('input');
  amount.className = 'item-amount';
  amount.inputMode = 'decimal';
  amount.value = item.amount ? String(item.amount) : '';
  amount.placeholder = 'Ft';
  const select = document.createElement('select');
  select.className = 'item-cat';
  fillSelect(select, categoriesForKind('expense').map((c) => [c.id, `${c.icon} ${c.label}`]), item.category);
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'item-del';
  del.setAttribute('aria-label', 'Tétel törlése');
  del.textContent = '✕';
  row.append(name, amount, del, select);
  return row;
}

function fillReceipt(data, keepCategories) {
  const form = receiptForm();
  form.shop.value = data.shop ?? '';
  form.date.value = data.date ?? todayIso();
  form.total.value = data.total ? String(data.total) : '';
  form.payment.value = data.payment ?? 'card';
  const shopCategory = suggestForName(form.shop.value, 'expense');
  const items = data.items?.length ? data.items : [{ name: '', amount: 0 }];
  $('#receipt-items').replaceChildren(...items.map((i) => itemRow({
    ...i,
    category: keepCategories && i.category ? i.category : suggestItemCategory(i.name, shopCategory),
  })));
  updateReceiptCheck();
}

function readItemRows() {
  return [...document.querySelectorAll('#receipt-items .item-row')].map((row) => ({
    name: row.querySelector('.item-name').value.trim(),
    amount: parsePrice(row.querySelector('.item-amount').value || '0'),
    category: row.querySelector('.item-cat').value,
  }));
}

function updateReceiptCheck() {
  const items = readItemRows().filter((i) => i.amount > 0);
  const sum = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  const total = parsePrice(receiptForm().total.value || '0');
  const diff = Math.round((total - sum) * 100) / 100;
  const ok = diff === 0 && total > 0;
  const el = $('#receipt-check');
  el.className = `receipt-check ${ok ? 'ok' : 'warn'}`;
  el.textContent = ok
    ? `✓ A tételek összege egyezik a végösszeggel: ${huf.format(sum)}`
    : `⚠️ Tételek összesen: ${huf.format(sum)} · Végösszeg: ${huf.format(total || 0)} · Eltérés: ${huf.format(diff || 0)}`;
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) receiptForm().text.value = text;
    else toast('A vágólap üres. Másold ki előbb a blokk szövegét.');
  } catch {
    toast('Nem sikerült beilleszteni. Nyomd hosszan a szövegmezőt → Beillesztés.');
  }
}

function readReceiptText() {
  const text = receiptForm().text.value;
  if (!text.trim()) {
    toast('Előbb illeszd be a blokk szövegét.');
    return;
  }
  const parsed = parseReceipt(text);
  fillReceipt(parsed, false);
  showReceiptStep('check');
  if (!parsed.items.length) toast('Nem találtam tételeket. Írd be őket kézzel, vagy csak a végösszeget.');
  $('#receipt-dialog').scrollTop = 0;
}

function saveReceipt(event) {
  const action = event.submitter?.value;
  const form = receiptForm();
  const id = ui.openId;
  const keepOpen = (message) => {
    event.preventDefault();
    if (message) toast(message);
  };

  if (action === 'delete') {
    if (!confirm('Biztosan törlöd ezt a blokkot?')) return keepOpen();
    store.deleteManual(id);
    toast('Blokk törölve');
  } else if (action === 'save') {
    const total = parsePrice(form.total.value || '0');
    if (!(total > 0)) return keepOpen('Add meg a blokk végösszegét.');
    let items = readItemRows().filter((i) => i.amount > 0);
    for (const i of items) if (!i.name) i.name = categoryById(i.category).label;
    const sum = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
    const diff = Math.round((total - sum) * 100) / 100;
    if (diff < 0) return keepOpen('A tételek összege több, mint a végösszeg. Javítsd a tételeket vagy a végösszeget.');
    if (diff > 0) {
      const ok = items.length === 0 || confirm(`A tételekből ${huf.format(diff)} hiányzik. Felvegyem „Egyéb tétel” néven?`);
      if (!ok) return keepOpen();
      const category = items.length ? 'other' : suggestForName(form.shop.value, 'expense');
      items = [...items, { name: 'Egyéb tétel', amount: diff, category }];
    }
    const fields = {
      kind: 'expense',
      amount: total,
      date: form.date.value,
      title: form.shop.value.trim() || 'Blokk',
      category: store.mainCategory(items),
      payment: form.payment.value,
      person: form.person.value,
      items,
    };
    const tx = id ? store.updateManual(id, fields) : store.addManual(fields, false);
    ui.month = tx.date.slice(0, 7);
    toast(tx.linkedBankId ? 'Blokk mentve, és összekapcsolva a banki tétellel 🔗' : 'Blokk mentve');
  }
  ui.openId = null;
  renderCurrent();
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
      const [{ extractRows }, { parseStatement }, pdfjsLib] = await Promise.all([
        import('./pdf-text.js'),
        import('./banks/index.js'),
        loadPdfJs(),
      ]);
      const pages = await extractRows(pdfjsLib, new Uint8Array(await file.arrayBuffer()));
      const { bank, meta, transactions, check } = parseStatement(pages);
      if (transactions.length === 0) throw new Error(check.problems[0] ?? 'Nem található tranzakció.');

      const { added, skipped, linked, saved } = store.addBankTransactions(transactions, {
        file: file.name, bank, periodFrom: meta.periodFrom, periodTo: meta.periodTo, ok: check.ok,
      });
      if (!saved) throw new Error('Nem sikerült menteni: megtelt a tárhely.');
      lastMonth = transactions.at(-1).date.slice(0, 7);
      renderResult(box, file.name, bank, meta, check, added, skipped, linked);
    } catch (err) {
      box.className = 'result warn';
      box.textContent = `${file.name}: ${err.message || 'Hiba a beolvasás közben.'}`;
    }
  }
  if (lastMonth) ui.month = lastMonth;
  renderHistory();
}

function renderResult(box, name, bank, meta, check, added, skipped, linked) {
  box.className = `result ${check.ok ? 'ok' : 'warn'}`;
  const period = meta.periodFrom ? `${meta.periodFrom.replaceAll('-', '.')} – ${meta.periodTo.replaceAll('-', '.')}` : '';
  const strong = document.createElement('strong');
  strong.textContent = name;
  const lines = [
    `Bank: ${bank}`,
    period && `Időszak: ${period}`,
    `Új tétel: ${added}${skipped ? `, már meglévő (kihagyva): ${skipped}` : ''}`,
    linked && `🔗 Kézzel felvett tételből megtalálva: ${linked}`,
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
    li.textContent = `${when}: ${imp.bank ?? 'CIB Bank'}, ${imp.periodFrom ?? '?'} – ${imp.periodTo ?? '?'} (${imp.added} új / ${imp.count})${imp.ok ? '' : ' ⚠️'}`;
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
  renderCurrent();
});
$('#month-next').addEventListener('click', () => {
  const months = availableMonths();
  ui.month = months[months.indexOf(ui.month) + 1] ?? ui.month;
  renderCurrent();
});

document.querySelector('.chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  ui.filter = chip.dataset.filter;
  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
  renderCurrent();
});

$('#tx-list').addEventListener('click', (e) => {
  const row = e.target.closest('.tx');
  if (!row) return;
  const tx = store.getTransaction(row.dataset.id);
  const linkedReceipt = tx?.linkedManualId && store.getTransaction(tx.linkedManualId);
  if (tx?.items) openReceipt(tx.id);
  else if (linkedReceipt?.items) openReceipt(linkedReceipt.id);
  else if (tx?.source === 'manual') openEntry(tx.id);
  else openDetails(row.dataset.id);
});
$('#tx-dialog form').addEventListener('submit', saveDetails);

$('#add-btn').addEventListener('click', () => $('#add-dialog').showModal());
$('#add-dialog form').addEventListener('submit', (e) => {
  if (e.submitter?.value === 'manual') openEntry(null);
  if (e.submitter?.value === 'receipt') openReceipt(null);
});
receiptForm().addEventListener('submit', saveReceipt);
$('#receipt-paste-btn').addEventListener('click', pasteFromClipboard);
$('#receipt-read-btn').addEventListener('click', readReceiptText);
$('#receipt-add-item').addEventListener('click', () => {
  const row = itemRow({ name: '', amount: 0, category: suggestForName(receiptForm().shop.value, 'expense') });
  $('#receipt-items').append(row);
  row.querySelector('.item-name').focus();
  updateReceiptCheck();
});
$('#receipt-items').addEventListener('click', (e) => {
  if (!e.target.closest('.item-del')) return;
  e.target.closest('.item-row').remove();
  updateReceiptCheck();
});
receiptForm().addEventListener('input', (e) => {
  if (e.target.matches('.item-amount, [name=total]')) updateReceiptCheck();
});
entryForm().addEventListener('submit', saveEntry);
entryForm().addEventListener('change', (e) => {
  if (e.target.name === 'kind') refreshEntryCategories();
  if (e.target.name === 'payment') refreshPaymentHint();
  if (e.target.name === 'category') entryCategoryTouched = true;
});
entryForm().title.addEventListener('input', () => {
  if (!entryCategoryTouched) entryForm().category.value = suggestForName(entryForm().title.value, entryForm().kind.value);
});

// Monthly repeats are added when the app opens or comes back to the screen.
function addDueRepeats() {
  if (store.ensureRecurring(todayIso()) && currentView() !== 'import') renderCurrent();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') addDueRepeats();
});

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

$('#supported-banks').textContent = supportedBanks();
store.ensureRecurring(todayIso());
showView();
