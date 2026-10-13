// Developer check for the cloud sync, with two simulated phones and a fake Supabase server.
// No network and no real account is used. Usage: node tools/test-sync.mjs
//
// Each "phone" runs in its own Node process (own local storage, own app modules);
// the fake server keeps its rows in a temporary JSON file shared by both.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kassza-sync-'));
const serverFile = path.join(dir, 'server.json');
fs.writeFileSync(serverFile, JSON.stringify({ clock: 0, rows: [] }));

// ---------- One phone (child process) ----------

if (process.argv[2] === 'phone') {
  const [, , , name, script] = process.argv;
  const phoneFile = path.join(process.env.KASSZA_DIR, `${name}.json`);
  const server = process.env.KASSZA_SERVER;
  const mem = fs.existsSync(phoneFile) ? JSON.parse(fs.readFileSync(phoneFile, 'utf8')) : {};
  const persist = () => fs.writeFileSync(phoneFile, JSON.stringify(mem));
  globalThis.localStorage = {
    getItem: (k) => mem[k] ?? null,
    setItem: (k, v) => { mem[k] = String(v); persist(); },
    removeItem: (k) => { delete mem[k]; persist(); },
  };
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: process.env.KASSZA_OFFLINE !== '1' }, configurable: true });
  globalThis.document = { visibilityState: 'hidden', addEventListener() {}, head: { append() {} } };

  const readServer = () => JSON.parse(fs.readFileSync(server, 'utf8'));
  const writeServer = (s) => fs.writeFileSync(server, JSON.stringify(s));
  const ts = (n) => new Date(Date.UTC(2026, 9, 1) + n).toISOString();

  // Just enough of the supabase-js query builder for sync.js.
  function query(table) {
    const filters = [];
    let order = null;
    let range = null;
    let limit = null;
    const b = {
      select() { return b; },
      eq(col, v) { filters.push((r) => r[col] === v); return b; },
      gt(col, v) { filters.push((r) => r[col] > v); return b; },
      order(col) { order = col; return b; },
      range(from, to) { range = [from, to]; return b; },
      limit(n) { limit = n; return b; },
      upsert(rows) {
        const s = readServer();
        for (const row of rows) {
          s.clock += 1;
          const stored = { ...structuredClone(row), updated_at: ts(s.clock) };
          const at = s.rows.findIndex((r) => r.household_id === row.household_id && r.kind === row.kind && r.id === row.id);
          if (at >= 0) s.rows[at] = stored;
          else s.rows.push(stored);
        }
        writeServer(s);
        return Promise.resolve({ error: null });
      },
      then(resolve) {
        if (table === 'household_members') return resolve({ data: [{ household_id: 'h1' }], error: null });
        let rows = readServer().rows.filter((r) => filters.every((f) => f(r)));
        if (order) rows.sort((a, c) => a[order].localeCompare(c[order]));
        if (range) rows = rows.slice(range[0], range[1] + 1);
        if (limit) rows = rows.slice(0, limit);
        // A real database returns JSON with its own key order.
        return resolve({ data: structuredClone(rows), error: null });
      },
    };
    return b;
  }
  const fakeSession = { user: { email: `${name}@example.test` } };
  globalThis.window = {
    addEventListener() {},
    supabase: {
      createClient: () => ({
        auth: {
          onAuthStateChange() {},
          signInWithOtp: async () => ({ error: null }),
          verifyOtp: async () => ({ data: { session: fakeSession }, error: null }),
          getSession: async () => ({ data: { session: mem.loggedOut ? null : fakeSession } }),
          signOut: async () => ({ error: null }),
        },
        from: query,
      }),
    },
  };

  const store = await import(path.join(here, '../app/js/store.js'));
  const sync = await import(path.join(here, '../app/js/sync.js'));
  // Like opening the app: continue an earlier login (does nothing before the first login).
  await sync.start();
  const out = await new Function('store', 'sync', `return (async () => { ${script} })();`)(store, sync);
  console.log(JSON.stringify(out ?? null));
  process.exit(0);
}

// ---------- The scenarios ----------

function phone(name, script, env = {}) {
  const res = execFileSync(process.execPath, [fileURLToPath(import.meta.url), 'phone', name, script], {
    env: { ...process.env, KASSZA_DIR: dir, KASSZA_SERVER: serverFile, ...env },
    encoding: 'utf8',
  });
  return JSON.parse(res.trim().split('\n').at(-1));
}

let failed = 0;
const ok = (label, cond) => {
  console.log(cond ? 'PASS' : 'FAIL', label);
  if (!cond) failed++;
};
const count = `return Object.keys(store.records()).length;`;
const titles = `return store.allTransactions().filter((t) => t.source === 'manual').map((t) => t.title).sort();`;
const serverRows = () => JSON.parse(fs.readFileSync(serverFile, 'utf8')).rows;

// 1) Phone A has data, logs in: everything goes up.
phone('A', `
  store.addBankTransactions([
    { id: 'cib|2026-09-01|R1|-1000', bookingDate: '2026-09-01', date: '2026-09-01', type: 'BANKKÁRTYA TERHELÉS', ref: 'R1', amount: -1000, balance: 0, merchant: 'SPAR 1', title: 'SPAR 1', mcc: '5411', hint: null },
    { id: 'cib|2026-09-02|R2|-2000', bookingDate: '2026-09-02', date: '2026-09-02', type: 'BANKKÁRTYA TERHELÉS', ref: 'R2', amount: -2000, balance: 0, merchant: 'DM 2', title: 'DM 2', mcc: '5977', hint: null },
  ], { file: 'a.pdf', periodFrom: '2026-09-01', periodTo: '2026-09-02' });
  store.addManual({ kind: 'expense', amount: 3000, date: '2026-09-05', title: 'Piac', category: 'food', payment: 'cash', person: 'Zsolt' }, false);
  store.setCardOwner('1111', 'Zsolt');
  await sync.verifyCode('a', '123456');`);
const aCount = phone('A', count);
ok(`A's ${aCount} records are on the server`, serverRows().length === aCount);

// 2) Phone B (empty) logs in: gets everything.
phone('B', `await sync.verifyCode('b', '123456');`);
ok('B has the same records as A', phone('B', count) === aCount);
ok('B sees A\'s manual entry', phone('B', titles).join() === 'Piac');

// 3) B adds an entry, A gets it.
phone('B', `store.addManual({ kind: 'expense', amount: 500, date: '2026-09-06', title: 'Kifli', category: 'food', payment: 'cash', person: 'Feleség' }, false); await sync.syncNow();`);
phone('A', `await sync.start();`);
ok('A sees B\'s new entry', phone('A', titles).join() === 'Kifli,Piac');

// 4) A deletes an entry, B loses it too.
phone('A', `const t = store.allTransactions().find((x) => x.title === 'Piac'); store.deleteManual(t.id); await sync.syncNow();`);
phone('B', `await sync.start();`);
ok('delete reaches B', phone('B', titles).join() === 'Kifli');
ok('delete is kept as a tombstone on the server', serverRows().some((r) => r.deleted && r.kind === 'tx'));

// 5) Different changes on both phones at the same time: both survive.
phone('A', `store.setCategory('cib|2026-09-01|R1|-1000', 'household', false);`, { KASSZA_OFFLINE: '1' });
phone('B', `const t = store.allTransactions().find((x) => x.title === 'Kifli'); store.updateManual(t.id, { ...t, amount: 600, kind: 'expense' }); await sync.syncNow();`);
phone('A', `await sync.start();`);
phone('B', `await sync.start();`);
const view = `const t = store.getTransaction('cib|2026-09-01|R1|-1000'); const k = store.allTransactions().find((x) => x.title === 'Kifli'); return [t.category, k.amount];`;
ok('both changes are on A', phone('A', view).join() === 'household,-600');
ok('both changes are on B', phone('B', view).join() === 'household,-600');

// 6) A monthly repeat created on both phones is still one item per month.
phone('A', `store.addManual({ kind: 'expense', amount: 7990, date: '2026-09-03', title: 'Netflix', category: 'subscriptions', payment: 'cash', person: 'Közös' }, true); await sync.syncNow();`);
phone('B', `await sync.start(); store.ensureRecurring('2026-10-05'); await sync.syncNow();`);
phone('A', `store.ensureRecurring('2026-10-05'); await sync.syncNow();`);
phone('B', `await sync.start();`);
const netflix = `return store.allTransactions().filter((t) => t.title === 'Netflix').map((t) => t.date).sort();`;
ok('repeat: one copy per month on A', phone('A', netflix).join() === '2026-09-03,2026-10-03');
ok('repeat: one copy per month on B', phone('B', netflix).join() === '2026-09-03,2026-10-03');

// 7) Offline changes wait, and go up when online again.
phone('B', `store.addManual({ kind: 'income', amount: 10000, date: '2026-09-20', title: 'Ajándék', category: 'other_income', payment: 'cash', person: 'Közös' }, false); return await sync.syncNow();`, { KASSZA_OFFLINE: '1' });
ok('offline: nothing uploaded yet', !serverRows().some((r) => r.data?.title === 'Ajándék'));
phone('B', `await sync.start();`);
ok('online again: uploaded', serverRows().some((r) => r.data?.title === 'Ajándék'));

// 8) Log-out clears the phone but not the cloud; logging in again brings it all back.
const beforeLogout = phone('B', count);
const afterLogout = phone('B', `await sync.start(); await sync.logout(); ${count}`);
ok('log-out empties this phone', afterLogout === 0);
ok('log-out does not delete anything in the cloud', !serverRows().some((r) => r.deleted && r.data === null && r.kind === 'rule'));
phone('B', `await sync.verifyCode('b', '123456');`);
ok('logging in again restores everything', phone('B', count) === beforeLogout);

// 9) A quiet sync uploads nothing.
const quiet = phone('A', `await sync.start(); return await sync.syncNow();`);
ok(`nothing to upload when nothing changed (pushed ${quiet?.pushed})`, quiet?.pushed === 0);

fs.rmSync(dir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
