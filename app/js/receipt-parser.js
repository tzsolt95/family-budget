// Reads the text of a Hungarian till receipt (copied with iPhone Live Text)
// into shop, date, payment method, items and total.
//
// Live Text output varies: usually "NAME  VAT-CODE  PRICE" on one line, but wide
// receipts sometimes come out as a block of names followed by a block of prices.
// Both layouts are handled; anything else is fixed by hand on the check screen.

const plain = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

const KNOWN_SHOPS = [
  'INTERSPAR', 'SPAR', 'TESCO', 'LIDL', 'ALDI', 'PENNY', 'AUCHAN', 'CBA', 'COOP', 'PRIMA', 'REAL',
  'DM', 'ROSSMANN', 'MULLER', 'IKEA', 'JYSK', 'OBI', 'PRAKTIKER', 'BAUHAUS', 'PEPCO', 'TEDI', 'ACTION',
  'DECATHLON', 'DEICHMANN', 'BENU', 'MOL', 'OMV', 'SHELL',
];

// Lines that are never items.
const NOT_ITEM = /(ADOSZAM|ADOSZ\.|NYUGTA|PENZTAR|AP\s?SZAM|AP:|NAV|ELLENORZO|ATVETT|VISSZAJARO|KEREKITES|RESZOSSZEG|OSSZESEN|FIZETENDO|VEGOSSZEG|BANKKARTYA|KARTYA|KESZPENZ|MASTERCARD|VISA|MAESTRO|TERMINAL|ENGEDELY|TRANZ|AUTH|KOSZONJUK|VISZONTLATASRA|\bAFA\b|\bADO\b|NETTO|BRUTTO|^[A-E]0{2}\b|DATUM|IDOPONT|SORSZAM|BIZONYLAT|TEL\.|TELEFON|WWW\.|HTTP|E-MAIL|KFT|ZRT|BT\.|\bUTCA\b|\bU\.\s|\bUT\b|\bTER\b)/;
const TOTAL_LINE = /(OSSZESEN|FIZETENDO|VEGOSSZEG|OSSZEG\s*:|TOTAL)/;
const DISCOUNT = /(KEDVEZM|ENGEDM|AKCIO|KUPON|RABATT|LEARAZ|KEDV\.)/;
const DEPOSIT = /(VISSZAVALT|BETETDIJ|\bDRS\b|BETET\b)/;
const QUANTITY_LINE = /^\s*\d+([.,]\d+)?\s*(DB|KG|G|L|X)?\s*[X*]\s*-?\d[\d\s.]*([.,]\d{2})?\s*(FT)?\s*$/;

// "1 299", "1.299", "1299", "-200", "1 299,00", "599 Ft"
const PRICE = String.raw`-?\d{1,3}(?:[ .]\d{3})+(?:,\d{2})?|-?\d+(?:,\d{2})?`;
const ITEM_LINE = new RegExp(String.raw`^(.*?[A-ZÁÉÍÓÖŐÚÜŰa-záéíóöőúüű].*?)\s+(?:[A-E]0{2}\s+)?(${PRICE})\s*(?:Ft|FT)?\s*[A-E]?$`);
const PRICE_ONLY = new RegExp(String.raw`^(?:[A-E]0{2}\s+)?(${PRICE})\s*(?:Ft|FT)?\s*[A-E]?$`);

export function parsePrice(text) {
  const t = text.trim().replace(/\s+/g, '');
  const n = /,\d{2}$/.test(t)
    ? Number(t.replace(/\./g, '').replace(',', '.'))
    : Number(t.replace(/[.,]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function findTotal(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (!TOTAL_LINE.test(plain(lines[i]))) continue;
    const same = new RegExp(String.raw`(${PRICE})\s*(?:Ft|FT)?\s*$`).exec(lines[i]);
    if (same && parsePrice(same[1]) > 0) return { total: parsePrice(same[1]), index: i };
    const next = lines[i + 1] && PRICE_ONLY.exec(lines[i + 1]);
    if (next) return { total: parsePrice(next[1]), index: i };
  }
  return { total: null, index: lines.length };
}

function findDate(text) {
  const m = /(20\d{2})\s?[.\-/]\s?(\d{1,2})\s?[.\-/]\s?(\d{1,2})/.exec(text);
  if (!m) return null;
  const [, y, mo, d] = m;
  const month = Number(mo), day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function findPayment(text) {
  const t = plain(text);
  if (/BANKKARTYA|KARTYA|MASTERCARD|VISA|MAESTRO|APPLE PAY|GOOGLE PAY|PAYPASS/.test(t)) return 'card';
  if (/KESZPENZ/.test(t)) return 'cash';
  return null;
}

function findShop(lines) {
  for (const line of lines.slice(0, 8)) {
    const p = plain(line);
    const known = KNOWN_SHOPS.find((s) => new RegExp(String.raw`\b${s}\b`).test(p));
    if (known) return known === 'MULLER' ? 'Müller' : known.charAt(0) + known.slice(1).toLowerCase();
  }
  const first = lines.find((l) => /[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]{3}/.test(l) && !/^\s*(NYUGTA|SZÁMLA)/i.test(l));
  return first ? first.replace(/\s+(Kft|Zrt|Bt)\.?.*$/i, '').trim() : '';
}

function cleanName(name) {
  return name.replace(/\s+[A-E]0{2}$/, '').replace(/\s{2,}/g, ' ').trim();
}

// Folds discount and bottle-deposit lines into the item above them.
function foldAdjustments(rows) {
  const items = [];
  for (const row of rows) {
    const p = plain(row.name);
    const isDiscount = DISCOUNT.test(p) || row.amount < 0;
    const isDeposit = DEPOSIT.test(p);
    const previous = items.at(-1);
    if ((isDiscount || isDeposit) && previous) {
      previous.amount = Math.round((previous.amount + (isDiscount ? -Math.abs(row.amount) : row.amount)) * 100) / 100;
      continue;
    }
    if (row.amount > 0) items.push({ ...row });
  }
  return items.filter((i) => i.amount > 0);
}

export function parseReceipt(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\t/g, ' ').trim()).filter(Boolean);
  const { total, index: totalIndex } = findTotal(lines);
  const body = lines.slice(0, totalIndex);

  // Layout 1: name and price on the same line.
  const rows = [];
  for (const line of body) {
    const p = plain(line);
    if (QUANTITY_LINE.test(p)) continue;
    const m = ITEM_LINE.exec(line);
    if (!m) continue;
    if (NOT_ITEM.test(p) && !DISCOUNT.test(p) && !DEPOSIT.test(p)) continue;
    const amount = parsePrice(m[2]);
    if (!Number.isFinite(amount) || Math.abs(amount) > 10_000_000) continue;
    rows.push({ name: cleanName(m[1]), amount });
  }

  // Layout 2: a block of names, then a block of prices (wide receipts).
  if (rows.length < 2) {
    const names = [];
    const prices = [];
    for (const line of body) {
      const p = plain(line);
      if (QUANTITY_LINE.test(p)) continue;
      const price = PRICE_ONLY.exec(line);
      if (price) prices.push(parsePrice(price[1]));
      else if (/[A-Z]{2}/.test(p) && (!NOT_ITEM.test(p) || DISCOUNT.test(p) || DEPOSIT.test(p))) names.push(cleanName(line));
    }
    // Header lines (shop, address) come before the items, so align from the end.
    if (prices.length >= 2 && names.length >= prices.length) {
      const itemNames = names.slice(names.length - prices.length);
      rows.splice(0, rows.length, ...itemNames.map((name, i) => ({ name, amount: prices[i] })));
    }
  }

  const items = foldAdjustments(rows);
  const sum = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  return {
    shop: findShop(lines),
    date: findDate(text),
    payment: findPayment(lines.slice(totalIndex).join('\n') || text),
    total: total ?? (items.length ? sum : null),
    items,
    sum,
  };
}
