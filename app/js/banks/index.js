// The list of banks whose PDF statements the app can read.
//
// To add a bank, create banks/<bank>.js exporting:
//   id       short text used in transaction ids, e.g. 'revolut'
//   name     shown to the user, e.g. 'Revolut'
//   detect(pages) -> true when the PDF is this bank's statement
//   parse(pages)  -> { meta, transactions, check }   (see banks/cib.js)
// Each transaction may carry a bank-neutral `hint` for the category rules:
//   'own_transfer' | 'loan' | 'refund' | 'interest' | 'cash_withdrawal'
// Then import it below and add it to BANKS. Nothing else needs to change.

import * as cib from './cib.js';

export const BANKS = [cib];

export const supportedBanks = () => BANKS.map((b) => b.name).join(', ');

export function parseStatement(pages) {
  const bank = BANKS.find((b) => b.detect(pages));
  if (!bank) {
    throw new Error(`Ezt a bankszámlakivonatot az app még nem ismeri. Jelenleg támogatott: ${supportedBanks()}.`);
  }
  return { bank: bank.name, ...bank.parse(pages) };
}
