// Categories and the rules that suggest a category for a bank transaction.
// Bank readers (banks/*.js) pass a bank-neutral `hint`, so these rules work for every bank.

export const KINDS = {
  expense: 'Kiadás',
  income: 'Bevétel',
  saving: 'Megtakarítás',
  saving_withdrawal: 'Megtakarítás feloldása',
  cash: 'Készpénzfelvétel',
};

// Kinds that move money around without being real income or spending.
export const isTransferKind = (kind) => kind === 'saving' || kind === 'saving_withdrawal' || kind === 'cash';

export const CATEGORIES = [
  { id: 'food', label: 'Élelmiszer', icon: '🛒', kind: 'expense' },
  { id: 'household', label: 'Háztartás', icon: '🏠', kind: 'expense' },
  { id: 'baby', label: 'Baba', icon: '👶', kind: 'expense' },
  { id: 'utilities', label: 'Rezsi', icon: '💡', kind: 'expense' },
  { id: 'restaurant', label: 'Étterem, rendelés', icon: '🍽️', kind: 'expense' },
  { id: 'entertainment', label: 'Szórakozás', icon: '🎬', kind: 'expense' },
  { id: 'transport', label: 'Közlekedés', icon: '🚌', kind: 'expense' },
  { id: 'subscriptions', label: 'Előfizetések', icon: '🔁', kind: 'expense' },
  { id: 'health', label: 'Egészség', icon: '💊', kind: 'expense' },
  { id: 'clothing', label: 'Ruházat', icon: '👕', kind: 'expense' },
  { id: 'loan', label: 'Hitel', icon: '🏦', kind: 'expense' },
  { id: 'insurance', label: 'Biztosítás', icon: '🛡️', kind: 'expense' },
  { id: 'other', label: 'Egyéb', icon: '📦', kind: 'expense' },
  { id: 'salary', label: 'Fizetés', icon: '💼', kind: 'income' },
  { id: 'refund', label: 'Visszatérítés', icon: '↩️', kind: 'income' },
  { id: 'interest', label: 'Kamat', icon: '📈', kind: 'income' },
  { id: 'other_income', label: 'Egyéb bevétel', icon: '💰', kind: 'income' },
  { id: 'saving', label: 'Megtakarítás', icon: '🐷', kind: 'saving' },
  { id: 'saving_withdrawal', label: 'Megtakarítás feloldása', icon: '🔓', kind: 'saving_withdrawal' },
  { id: 'cash_withdrawal', label: 'Készpénzfelvétel', icon: '💵', kind: 'cash' },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));
export const categoryById = (id) => BY_ID.get(id) ?? BY_ID.get('other');
export const categoriesForKind = (kind) => CATEGORIES.filter((c) => c.kind === kind);

// The user's own choices ("always put this shop here") win over everything.
let userRules = {};
export function setUserRules(rules) {
  userRules = rules ?? {};
}
export const ruleKey = (tx) => (tx.title ?? '').toUpperCase().replace(/\s+\d+$/, '').trim();

// Shop names win over the card category code (MCC), because they are more specific.
const KEYWORDS = [
  ['baby', /(PELENKA|BRENDON|BABACENTER|BABYCENTER|BABA-?MAMA|MAMASHOP|BABAOUTLET|BABY ?SHOP|BABAPIAC|BABAAGY|PAMPERS|HUGGIES)/i],
  ['restaurant', /\b(WOLT|FOODORA|NETPINCER|MCD|MCDONALD|KFC|BURGER KING|SUBWAY|CUKR[AÁ]SZDA|ÉTTEREM|ETTEREM|BISTRO|PIZZA)/i],
  ['food', /\b(SPAR|INTERSPAR|TESCO|LIDL|ALDI|AUCHAN|PENNY|CBA|COOP|PRIMA|PEK|PÉK|BAKERY|ZOLDSEG|ZÖLDSÉG|PIAC|HENTES)\b/i],
  ['household', /\b(DM|ROSSMANN|MÜLLER|MULLER|IKEA|JYSK|OBI|PRAKTIKER|BAUHAUS|PEPCO|TEDI|ACTION)\b/i],
  ['utilities', /\b(MVM|ELMŰ|ELMU|FŐTÁV|FOTAV|FCSM|VÍZMŰ|VIZMU|TELEKOM|VODAFONE|YETTEL|DIGI|ONE HUNGARY|NHKV)/i],
  ['transport', /\b(MÁV|MAV|BKK|VOLÁN|VOLAN|BOLT|UBER|MOL|OMV|SHELL|LUKOIL|PARKOL)/i],
  ['subscriptions', /\b(NETFLIX|SPOTIFY|CLAUDE|ANTHROPIC|OPENAI|APPLE\.COM|ICLOUD|GOOGLE|YOUTUBE|HBO|DISNEY|MAX\.COM|AMAZON PRIME)/i],
  ['entertainment', /\b(CINEMA|MOZI|JEGY\.HU|TICKET|EVENTIM|SZINHAZ|SZÍNHÁZ|MÚZEUM|MUZEUM)/i],
  ['health', /\b(BENU|PATIKA|GYÓGY|GYOGY|PHARMA|DENT|ORVOS|LABOR)/i],
  ['clothing', /\b(DEICHMANN|H&M|ZARA|C&A|RESERVED|SINSAY|CCC|DECATHLON|LPP|NEW YORKER)/i],
  ['insurance', /BIZTOSÍT|BIZTOSIT/i],
];

// Merchant Category Codes printed on every card purchase.
const MCC_RANGES = [
  ['food', [5411, 5422, 5441, 5451, 5462, 5499]],
  ['restaurant', [5811, 5812, 5813, 5814]],
  ['entertainment', [7995, 7832, 7841, 7922, 7929, 7932, 7933, 7941, 7991, 7992, 7993, 7994, 7996, 7997, 7998, 7999]],
  ['transport', [4011, 4111, 4112, 4121, 4131, 4784, 4789, 5541, 5542, 5983, 7511, 7523, 7531, 7538, 7542]],
  ['utilities', [4814, 4816, 4900]],
  ['subscriptions', [4899, 5815, 5816, 5817, 5818, 5968]],
  ['health', [5122, 5912, 5975, 5976, 8011, 8021, 8031, 8041, 8042, 8043, 8049, 8050, 8062, 8071, 8099]],
  ['baby', [5641]],
  ['clothing', [5611, 5621, 5631, 5651, 5655, 5661, 5681, 5691, 5697, 5698, 5699, 5941]],
  ['household', [5200, 5211, 5231, 5251, 5261, 5310, 5311, 5331, 5399, 5712, 5714, 5718, 5719, 5722, 5732, 5977, 5992]],
  ['insurance', [5960, 6300]],
];
const MCC = new Map(MCC_RANGES.flatMap(([cat, codes]) => codes.map((code) => [String(code), cat])));

// ATM withdrawals are not spending: the cash is spent later and entered by hand.
const isCashWithdrawal = (tx) => tx.amount < 0
  && (tx.hint === 'cash_withdrawal' || tx.mcc === '6011' || /\bATM\b/i.test(tx.merchant ?? ''));

export function kindOf(tx) {
  if (tx.hint === 'own_transfer') return tx.amount < 0 ? 'saving' : 'saving_withdrawal';
  if (isCashWithdrawal(tx)) return 'cash';
  return tx.amount < 0 ? 'expense' : 'income';
}

export function suggestCategory(tx) {
  const kind = kindOf(tx);
  if (kind === 'saving' || kind === 'saving_withdrawal') return kind;
  if (kind === 'cash') return 'cash_withdrawal';

  const learned = userRules[ruleKey(tx)];
  if (learned && categoryById(learned).kind === kind) return learned;

  const text = [tx.merchant, tx.partner, tx.note, tx.legalTitle].filter(Boolean).join(' ');

  if (kind === 'income') {
    if (/MUNKABÉR|MUNKABER|BÉR|FIZETÉS/i.test(text)) return 'salary';
    if (tx.hint === 'refund') return 'refund';
    if (tx.hint === 'interest') return 'interest';
    return 'other_income';
  }

  if (tx.hint === 'loan') return 'loan';
  for (const [cat, re] of KEYWORDS) if (re.test(text)) return cat;
  if (tx.mcc && MCC.has(tx.mcc)) return MCC.get(tx.mcc);
  return 'other';
}

// Category guess for a hand-typed name, e.g. "Claude Pro" -> Előfizetések.
export function suggestForName(name, kind) {
  const guess = suggestCategory({ title: name, merchant: name, amount: kind === 'income' ? 1 : -1 });
  return categoryById(guess).kind === kind ? guess : (kind === 'income' ? 'other_income' : 'other');
}

// ---------- Receipt items ----------

const plainUpper = (text) => (text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

// Product words seen on Hungarian receipts (accents removed, so "KENYÉR" and "KENYER" both match).
const ITEM_KEYWORDS = [
  // Food that only sounds like baby products.
  ['food', /(BABAPISKOTA|BABY ?SPENOT|BEBI ?SPENOT|BABY ?SPINACH|BEBI ?REPA|BABY ?REPA|BABAKUKORICA|BABY ?CORN|BABYBEL|BABY ?BEL\b|BABY ?ROMAI|BEBI ?SALATA|BABY ?SALATA)/],
  ['baby', /(PELENKA|PAMPERS|HUGGIES|LIBERO|BABYDREAM|BABY ?DREAM|BABYLOVE|BABY ?LOVE|\bBABA|\bBABY|\bBEBI|BEBIETEL|TAPSZER|APTAMIL|NUTRILON|\bHIPP\b|\bBEBA\b|HUMANA|MILUMIL|CUMI|ETETOCUMI|CUMISUVEG|POPSIKREM|POPSI|BUDOSZ|RAGOKA|RUGDALOZO|BODY ?\d|PARNA ?BABA)/],
  ['household', /(MOSOPOR|MOSOGEL|MOSOSZER|OBLITO|MOSOGAT|TISZTITO|SUROLO|FERTOTLEN|HYPO|WC|TOALETT|PAPIR ?ZSEBKENDO|ZSEBKENDO|SZALVETA|KONYHAI ?TEKERCS|PAPIRTORLO|SZEMETES|ZSAK|FOLIA|ALUFOLIA|SUTOPAPIR|ELEM\b|IZZO|GYERTYA|TORLOKENDO|SAMPON|BALZSAM|TUSFURDO|SZAPPAN|FOGKREM|FOGKEFE|DEZODOR|DEO\b|BOROTVA|VATTA|TAMPON|BETET|TESTAPOLO|KREM\b|SZIVACS|ZACSKO|SZATYOR|TASAK|REKLAMSZATYOR)/],
  ['health', /(VITAMIN|TABLETTA|KAPSZULA|GYOGY|SEBTAPASZ|TAPASZ|LAZCSILLAPITO|FAJDALOM|ORRSPRAY|SZEMCSEPP)/],
  ['clothing', /(ZOKNI|POLO|HARISNYA|ALSONADRAG|NADRAG|PULOVER|SAPKA|KESZTYU|CIPO|PAPUCS)/],
  ['entertainment', /(JATEK|LEGO|KONYV|UJSAG|MAGAZIN|SORSJEGY|LOTTO|KAPARO)/],
  ['food', /(TEJ|KENYER|ZSEMLE|KIFLI|KALACS|CSIGA|BAGETT|POGACSA|SAJT|TURO|VAJ|MARGARIN|JOGHURT|KEFIR|TEJFOL|TEJSZIN|TOJAS|CSIRKE|PULYKA|SERTES|MARHA|DARALT|SONKA|KOLBASZ|SZALAMI|VIRSLI|PARIZSI|HAL\b|TONHAL|LAZAC|ALMA|BANAN|NARANCS|CITROM|SZOLO|KORTE|EPER|DINNYE|BARACK|PARADICSOM|PAPRIKA|UBORKA|BURGONYA|KRUMPLI|HAGYMA|FOKHAGYMA|SALATA|REPA|KAPOSZTA|BROKKOLI|GOMBA|RIZS|TESZTA|SPAGETTI|LISZT|CUKOR|\bSO\b|OLAJ|ECET|KAVE|TEA\b|KAKAO|CSOKI|CSOKOLADE|KEKSZ|OSTYA|CHIPS|ROPI|MOGYORO|DIO|MUZLI|PEHELY|UDITO|COLA|SZORP|GYUMOLCSLE|\bLE\b|VIZ|ASVANYVIZ|SOR\b|BOR\b|PEZSGO|PALINKA|JEGKREM|PIZZA|LEVES|KONZERV|BAB\b|BORSO|KUKORICA|LEKVAR|MEZ\b|KETCHUP|MAJONEZ|MUSTAR|FUSZER|BORS\b|PAPRIKAPOR|ZOLDSEG|GYUMOLCS|PEKARU|SUTEMENY|TORTA|FANK|BUKTA|PITE|REJTO|CROISSANT|SZENDVICS)/],
];

let itemRules = {};
export function setItemRules(rules) {
  itemRules = rules ?? {};
}
export const itemRuleKey = (name) => plainUpper(name).replace(/[\d.,%]+\s*(KG|G|L|ML|DB|CL)?\b/g, '').replace(/\s+/g, ' ').trim();

// Category for one receipt line: the user's earlier choice, then product words,
// then the shop's own category (e.g. everything at DM is Háztartás by default).
export function suggestItemCategory(name, shopCategory) {
  const learned = itemRules[itemRuleKey(name)];
  if (learned) return learned;
  const p = plainUpper(name);
  for (const [cat, re] of ITEM_KEYWORDS) if (re.test(p)) return cat;
  return shopCategory && categoryById(shopCategory).kind === 'expense' ? shopCategory : 'food';
}
