// Phase 2: login with an e-mail code, and syncing this phone with the shared Supabase database.
//
// How the sync works (offline first):
//   * The phone keeps working from local storage, even with no internet.
//   * "snapshot" remembers what the cloud had for every record at the last sync.
//   * Push: every record that differs from the snapshot is uploaded (deleted ones as tombstones).
//   * Pull: records the server changed since the last pull are downloaded and applied.
//   * The server stamps each change with its own clock (updated_at), so phone clocks never matter.

import * as store from './store.js';

// These two values are public by design: on their own they cannot read anything,
// Row Level Security in the database decides who sees what (see supabase/schema.sql).
const SUPABASE_URL = 'https://ryhzgnxhtockxiusjuhs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TwRX-3ZXvKcqkDx1w0-zfQ_7jU-E6-u';

const SYNC_KEY = 'csaladi-kassza.sync.v1';
const PUSH_CHUNK = 300;
const PULL_PAGE = 1000;
// Pull a little before the last cursor too: a change saved at nearly the same moment
// can become visible slightly later than its timestamp.
const PULL_OVERLAP_MS = 5 * 60 * 1000;

let client = null;
let session = null;
let householdId = null;
let syncing = null;
let again = false;
let applying = false;
const statusListeners = new Set();
let status = { state: 'off', message: '' };

// ---------- Small helpers ----------

// JSON with sorted keys, so the same data always gives the same text on both phones.
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter((k) => value[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function splitKey(key) {
  const at = key.indexOf('|');
  return { kind: key.slice(0, at), id: key.slice(at + 1) };
}

function loadSyncState() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_KEY)) ?? {};
  } catch {
    return {};
  }
}

function saveSyncState(s) {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(s));
  } catch {
    // Storage full: the next sync simply compares again.
  }
}

function setStatus(state, message = '', result = null) {
  status = { state, message, result, at: new Date() };
  for (const fn of statusListeners) fn(status);
}

export const onStatus = (fn) => {
  statusListeners.add(fn);
  fn(status);
};
export const currentUser = () => session?.user ?? null;

// ---------- Supabase client ----------

function loadLibrary() {
  if (window.supabase?.createClient) return Promise.resolve(window.supabase);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('../vendor/supabase/supabase.js', import.meta.url).href;
    script.onload = () => resolve(window.supabase);
    script.onerror = () => reject(new Error('Nem sikerült betölteni a szinkronizálást. Van internet?'));
    document.head.append(script);
  });
}

async function getClient() {
  if (!client) {
    const lib = await loadLibrary();
    client = lib.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    client.auth.onAuthStateChange((_event, newSession) => {
      session = newSession;
    });
  }
  return client;
}

// ---------- Login ----------

const friendly = (error) => {
  const text = `${error?.message ?? error}`;
  if (/nincs engedélyezve|Database error saving new user|not allowed|Signups not allowed/i.test(text)) {
    return 'Ez az e-mail-cím nincs engedélyezve. Csak a családtagok léphetnek be.';
  }
  if (/rate limit|too many|security purposes/i.test(text)) return 'Túl sok próbálkozás. Várj néhány percet, és próbáld újra.';
  if (/expired|invalid|token/i.test(text)) return 'A kód hibás vagy lejárt. Kérj új kódot.';
  if (/fetch|network|Failed to/i.test(text)) return 'Nincs internetkapcsolat.';
  return text;
};

export async function requestCode(email) {
  const sb = await getClient();
  const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
  if (error) throw new Error(friendly(error));
}

export async function verifyCode(email, code) {
  const sb = await getClient();
  const { data, error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
  if (error) throw new Error(friendly(error));
  session = data.session;
  await connect();
}

export async function logout() {
  const sb = await getClient();
  await sb.auth.signOut().catch(() => {});
  session = null;
  householdId = null;
  localStorage.removeItem(SYNC_KEY);
  store.clearLocal();
  setStatus('off');
}

// ---------- Connecting ----------

async function findHousehold() {
  const sb = await getClient();
  const { data, error } = await sb.from('household_members').select('household_id').limit(1);
  if (error) throw new Error(friendly(error));
  if (!data?.length) throw new Error('A fiókod még nincs háztartáshoz rendelve. Szólj Zsoltnak.');
  return data[0].household_id;
}

async function connect() {
  householdId = await findHousehold();
  const s = loadSyncState();
  // A different household (or user) than last time: start the comparison from scratch.
  if (s.householdId !== householdId) saveSyncState({ householdId, snapshot: {}, cursor: null });
  await syncNow();
}

// Called when the app opens: continues an earlier login, if there was one.
export async function start() {
  if (!loadSyncState().householdId) {
    setStatus('off');
    return;
  }
  try {
    const sb = await getClient();
    const { data } = await sb.auth.getSession();
    session = data.session;
    if (!session) {
      setStatus('off', 'Lejárt a belépés. Lépj be újra.');
      return;
    }
    await connect();
  } catch (err) {
    setStatus('error', friendly(err));
  }
}

// ---------- Sync ----------

async function push(sb, s, local, startTexts) {
  const rows = [];
  const keys = new Set([...Object.keys(local), ...Object.keys(s.snapshot)]);
  for (const key of keys) {
    const text = startTexts[key];
    if (text === s.snapshot[key]) continue;
    const { kind, id } = splitKey(key);
    rows.push({
      key,
      text,
      row: { household_id: householdId, kind, id, data: key in local ? local[key] : null, deleted: !(key in local) },
    });
  }
  for (let i = 0; i < rows.length; i += PUSH_CHUNK) {
    const chunk = rows.slice(i, i + PUSH_CHUNK);
    const { error } = await sb.from('records').upsert(chunk.map((r) => r.row), { onConflict: 'household_id,kind,id' });
    if (error) throw new Error(friendly(error));
    for (const r of chunk) {
      if (r.row.deleted) delete s.snapshot[r.key];
      else s.snapshot[r.key] = r.text;
    }
    saveSyncState(s);
  }
  return rows.length;
}

async function pull(sb, s, startTexts) {
  const since = s.cursor ? new Date(Date.parse(s.cursor) - PULL_OVERLAP_MS).toISOString() : null;
  const changes = [];
  let cursor = s.cursor;
  for (let from = 0; ; from += PULL_PAGE) {
    let query = sb.from('records').select('kind,id,data,deleted,updated_at').eq('household_id', householdId);
    if (since) query = query.gt('updated_at', since);
    const { data, error } = await query.order('updated_at', { ascending: true }).range(from, from + PULL_PAGE - 1);
    if (error) throw new Error(friendly(error));
    for (const row of data) {
      const key = `${row.kind}|${row.id}`;
      const remoteText = row.deleted ? undefined : stable(row.data);
      if (!cursor || row.updated_at > cursor) cursor = row.updated_at;
      if (remoteText === s.snapshot[key]) continue;
      // Changed on this phone during the sync: keep it, it is uploaded next time.
      const nowText = currentText(key);
      if (nowText !== startTexts[key]) continue;
      changes.push({ kind: row.kind, id: row.id, data: row.data, deleted: row.deleted });
      if (row.deleted) delete s.snapshot[key];
      else s.snapshot[key] = remoteText;
    }
    if (data.length < PULL_PAGE) break;
  }
  if (changes.length) {
    applying = true;
    try {
      store.applyRecords(changes);
    } finally {
      applying = false;
    }
  }
  s.cursor = cursor;
  saveSyncState(s);
  return changes.length;
}

function currentText(key) {
  const data = store.records()[key];
  return data === undefined ? undefined : stable(data);
}

async function runSync() {
  const sb = await getClient();
  const s = { snapshot: {}, cursor: null, ...loadSyncState() };
  const local = store.records();
  const startTexts = Object.fromEntries(Object.entries(local).map(([k, v]) => [k, stable(v)]));
  const pushed = await push(sb, s, local, startTexts);
  const pulled = await pull(sb, s, startTexts);
  return { pushed, pulled };
}

// Uploads local changes and downloads the other phone's. Safe to call often.
export async function syncNow() {
  if (!householdId) return null;
  if (!navigator.onLine) {
    setStatus('offline', 'Nincs internet. A változások a következő kapcsolódáskor szinkronizálódnak.');
    return null;
  }
  if (syncing) {
    again = true;
    return syncing;
  }
  setStatus('syncing');
  syncing = runSync()
    .then((result) => {
      setStatus('ok', '', result);
      return result;
    })
    .catch((err) => {
      setStatus('error', friendly(err));
      return null;
    })
    .finally(() => {
      syncing = null;
      if (again) {
        again = false;
        scheduleSync(500);
      }
    });
  return syncing;
}

let timer = null;
function scheduleSync(delay = 2500) {
  if (!householdId) return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
}

// Every local save is uploaded a moment later; changes coming from the cloud are not sent back.
store.onChange(() => {
  if (!applying) scheduleSync();
});
window.addEventListener('online', () => scheduleSync(500));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') scheduleSync(300);
});
setInterval(() => {
  if (document.visibilityState === 'visible') syncNow();
}, 60_000);
