// Reader for CIB Bank "BANKSZÁMLA KIVONAT" PDF statements.
// Input: rows from extractRows(). Output: statement meta, transactions and a self-check.
// Registered in ./index.js, which describes what every bank reader must provide.

export const id = 'cib';
export const name = 'CIB Bank';

// True when the PDF is a CIB statement.
export function detect(pages) {
  const firstPage = (pages[0] ?? []).map(rowText).join('\n');
  return /BANKSZÁMLA KIVONAT/.test(firstPage) && /CIB24|CIB Bank/.test(firstPage);
}

const DATE_RE = /^(\d{4})\.(\d{2})\.(\d{2})\.?$/;
const AMOUNT_RE = /^-?\s?\d{1,3}(\.\d{3})*,\d{2}$/;

// Column positions (PDF points) of the transaction table.
const AMOUNT_MIN_X = 400;
const BALANCE_MIN_X = 515;
const DATE_MAX_X = 30;
const FOOTER_X = { min: 50, max: 70 };

export function parseHuAmount(text) {
  return Number(text.replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
}

function toIsoDate(text) {
  const m = DATE_RE.exec(text.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function compactDate(yyyymmdd) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

const rowText = (row) => row.items.map((i) => i.s).join(' ');

// The bank prints accented letters as `A"`, `E"` ... in shop names.
const ACCENTS = { A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú', a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };
function fixAccents(text) {
  return text.replace(/([AEIOUaeiou])"/g, (_, v) => ACCENTS[v]);
}

function cleanMerchant(raw) {
  const tokens = fixAccents(raw).trim().split(/\s+/);
  // The last two tokens are terminal / merchant ids, e.g. "SPAR 5190 S5190152 9847146".
  const isId = (t) => /\d/.test(t);
  if (tokens.length > 2 && isId(tokens.at(-1)) && isId(tokens.at(-2))) tokens.splice(-2);
  else if (tokens.length > 1 && /^\d{6,}$/.test(tokens.at(-1))) tokens.pop();
  return tokens.join(' ');
}

function isOwnAccountTransfer(type) {
  return /^Saját (számlák|sz\.) közti/i.test(type);
}

function parseHeadline(row) {
  const [first] = row.items;
  if (!first || first.x > DATE_MAX_X || !DATE_RE.test(first.s)) return null;
  const amountItem = row.items.find((i) => i.x >= AMOUNT_MIN_X && i.x < BALANCE_MIN_X && AMOUNT_RE.test(i.s));
  const balanceItem = row.items.find((i) => i.x >= BALANCE_MIN_X && AMOUNT_RE.test(i.s));
  if (!amountItem || !balanceItem) return null;
  const label = row.items
    .filter((i) => i !== first && i.x < AMOUNT_MIN_X)
    .map((i) => i.s)
    .join(' ');
  const [type, ref = ''] = label.split(/\s*;\s*/);
  return {
    bookingDate: toIsoDate(first.s),
    type: type.trim(),
    ref: ref.trim(),
    amount: parseHuAmount(amountItem.s),
    balance: parseHuAmount(balanceItem.s),
    lines: [],
  };
}

function addDetailRow(tx, row) {
  const [first] = row.items;
  if (first.x <= DATE_MAX_X && DATE_RE.test(first.s)) {
    tx.valueDate = toIsoDate(first.s);
    const rest = row.items.slice(1).map((i) => i.s).join(' ');
    if (rest) tx.lines.push(rest);
  } else {
    tx.lines.push(rowText(row));
  }
}

const CARD_LINE_RE = /\d{4} \d{4} \d{4} (\d{4})\s*A?(\d{8}) \d{6}; ([\d.]+) ([A-Z]{3})/;
const MERCHANT_LINE_RE = /^(\d{4}) \S*?([A-Z]{2}) (.*?); (.*)$/;
const ACCOUNT_RE = /^(\d{8}-\d{8}(-\d{8})?|HU\d{2}( \d{4}){6})$/;
const LABELLED_RE = /^(Közlemény|Partnerek közti|Megbízás azonosító|Tényleges|Csoportos jogcím|Levont|&&)/;

// Turns the raw detail lines into readable fields, and drops the card number.
function interpret(raw) {
  const tx = {
    bookingDate: raw.bookingDate,
    valueDate: raw.valueDate ?? raw.bookingDate,
    type: raw.type,
    ref: raw.ref,
    amount: raw.amount,
    balance: raw.balance,
  };

  if (/^BANKKÁRTYA/i.test(raw.type)) {
    const card = raw.lines.map((l) => CARD_LINE_RE.exec(l)).find(Boolean);
    if (card) {
      tx.cardLast4 = card[1];
      tx.purchaseDate = compactDate(card[2]);
      if (card[4] !== 'HUF') tx.originalAmount = `${card[3]} ${card[4]}`;
    }
    const shop = raw.lines.map((l) => MERCHANT_LINE_RE.exec(l)).find(Boolean);
    if (shop) {
      tx.mcc = shop[1];
      tx.city = fixAccents(shop[3]).trim();
      tx.merchant = cleanMerchant(shop[4]);
    }
  } else {
    for (const line of raw.lines) {
      const note = /^Közlemény:\s*(.*)$/.exec(line);
      const legal = /^Csoportos jogcím:\s*(.*)$/.exec(line);
      if (note) tx.note = note[1].trim();
      else if (legal) tx.legalTitle = legal[1].trim();
      else if (ACCOUNT_RE.test(line)) tx.partnerAccount = line;
      else if (!LABELLED_RE.test(line) && !tx.partner && !/^illeték/i.test(line)) {
        tx.partner = line.split(';')[0].trim();
      }
    }
  }

  tx.hint = hintFor(tx);
  tx.date = tx.purchaseDate ?? tx.bookingDate;
  tx.title = friendlyTitle(tx) || tx.merchant || tx.partner || tx.type;
  tx.id = `cib|${tx.bookingDate}|${tx.ref}|${tx.amount}`;
  return tx;
}

// Bank-neutral meaning of CIB's wording, used by the category rules.
function hintFor(tx) {
  if (isOwnAccountTransfer(tx.type)) return 'own_transfer';
  if (/TŐKETÖRLESZTÉS|^KAMAT TERHELÉSE/i.test(tx.type)) return 'loan';
  if (/^BANKKÁRTYA JÓVÁÍRÁS/i.test(tx.type)) return 'refund';
  if (/^Elszámolt kamat/i.test(tx.type)) return 'interest';
  if (/KÉSZPÉNZ ?FELV/i.test(tx.type) || tx.mcc === '6011') return 'cash_withdrawal';
  return undefined;
}

function friendlyTitle(tx) {
  if (isOwnAccountTransfer(tx.type)) return tx.amount < 0 ? 'Átvezetés megtakarításba' : 'Átvezetés a megtakarításból';
  if (/TŐKETÖRLESZTÉS/i.test(tx.type)) return 'Hiteltörlesztés (tőke)';
  if (/^KAMAT TERHELÉSE/i.test(tx.type)) return 'Hitel kamata';
  if (/^Elszámolt kamat/i.test(tx.type)) return 'Kamatjóváírás';
  if (/^revolut/i.test(tx.merchant ?? '')) return 'Revolut feltöltés';
  return null;
}

export function parse(pages) {
  const meta = {};
  const rawTxs = [];
  let current = null;

  for (const rows of pages) {
    let inTable = false;
    for (const row of rows) {
      const text = rowText(row);
      const [first] = row.items;

      if (!meta.periodFrom) {
        const period = /^IDŐSZAK:\s*(\S+)\s*-\s*(\S+)/.exec(text);
        if (period) {
          meta.periodFrom = toIsoDate(period[1]);
          meta.periodTo = toIsoDate(period[2]);
        }
      }
      if (!meta.account) {
        const account = /^SZÁMLA:\s*(.+)$/.exec(text);
        if (account) meta.account = account[1].trim();
      }
      if (/^NYITÓ EGYENLEG:/.test(text)) meta.opening = parseHuAmount(row.items.at(-1).s);
      if (/^ZÁRÓ EGYENLEG:/.test(text)) meta.closing = parseHuAmount(row.items.at(-1).s);

      if (/^KÖNYVELÉSI\//.test(text)) { inTable = true; continue; }
      if (/^ÖSSZESEN FORGALOM/.test(text)) {
        const m = /TERHELÉS:\s*(-?\s?[\d.,]+)\s*JÓVÁÍRÁS:\s*(-?\s?[\d.,]+)/.exec(text);
        if (m) {
          meta.totalDebit = -Math.abs(parseHuAmount(m[1]));
          meta.totalCredit = parseHuAmount(m[2]);
        }
        inTable = false;
        current = null;
        continue;
      }
      if (!inTable || /^ÉRTÉKNAP/.test(text)) continue;
      if (first.x >= FOOTER_X.min && first.x <= FOOTER_X.max) continue;

      const headline = parseHeadline(row);
      if (headline) {
        current = headline;
        rawTxs.push(current);
      } else if (current) {
        addDetailRow(current, row);
      }
    }
  }

  const transactions = rawTxs.map(interpret);
  return { meta, transactions, check: checkStatement(meta, transactions) };
}

// Compares what we read with the bank's own totals, so mistakes are visible.
function checkStatement(meta, transactions) {
  const problems = [];
  const close = (a, b) => Math.abs(a - b) < 0.005;
  const round = (n) => Math.round(n * 100) / 100;

  if (meta.opening === undefined) problems.push('Nem található nyitó egyenleg.');
  let running = meta.opening ?? 0;
  for (const tx of transactions) {
    running = round(running + tx.amount);
    if (!close(running, tx.balance)) {
      problems.push(`Az egyenleg nem egyezik itt: ${tx.bookingDate} ${tx.title}`);
      running = tx.balance;
    }
  }
  const debit = round(transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0));
  const credit = round(transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0));
  if (meta.totalDebit !== undefined && !close(debit, meta.totalDebit)) problems.push('A terhelések összege eltér a kivonattól.');
  if (meta.totalCredit !== undefined && !close(credit, meta.totalCredit)) problems.push('A jóváírások összege eltér a kivonattól.');
  if (meta.closing !== undefined && !close(running, meta.closing)) problems.push('A záró egyenleg eltér a kivonattól.');
  if (transactions.length === 0) problems.push('Nem található tranzakció. Biztosan CIB bankszámlakivonat?');

  return { ok: problems.length === 0, problems, debit, credit };
}
