(() => {

const DB_NAME = 'springboard';
const STORE = 'kv';
const CONFIG_KEY = 'config';

const STYLES = `
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f6f6f4;
    color: #222;
    font: 14px/1.4 ui-monospace, monospace;
  }
  main {
    width: min(680px, 92vw);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: #888;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  textarea {
    width: 100%;
    height: 40vh;
    box-sizing: border-box;
    padding: 12px;
    background: #fff;
    color: #222;
    border: 1px solid #d4d4d0;
    border-radius: 6px;
    font: inherit;
    resize: vertical;
  }
  textarea:focus { outline: none; border-color: #357edd; }
  button {
    align-self: center;
    padding: 10px 28px;
    background: #357edd;
    color: #fff;
    border: 0;
    border-radius: 6px;
    font: 600 14px/1 ui-monospace, monospace;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: background 0.15s;
  }
  button:hover { background: #4a90e2; }
  button:active { background: #2a6dc4; }
  pre {
    margin: 0;
    padding: 12px;
    background: #fff;
    border: 1px solid #d4d4d0;
    border-radius: 6px;
    min-height: 1em;
    white-space: pre-wrap;
    word-break: break-all;
  }
  pre:empty { display: none; }
`;

// -- IndexedDB key-value (single-store) on any db name -------------------

function openKvDB(dbName) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function kvGet(dbName, key) {
  const db = await openKvDB(dbName);
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}

async function kvSet(dbName, key, value) {
  const db = await openKvDB(dbName);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

async function kvDelete(dbName, key) {
  const db = await openKvDB(dbName);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

async function kvKeys(dbName) {
  const db = await openKvDB(dbName);
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}

function kvDrop(dbName) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(dbName);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => {};
  });
}

// -- OPFS path API -------------------------------------------------------

function splitPath(path) {
  return String(path || '').split('/').filter(Boolean);
}

async function fsResolveDir(parts, { create = false } = {}) {
  let dir = await navigator.storage.getDirectory();
  for (const p of parts) dir = await dir.getDirectoryHandle(p, { create });
  return dir;
}

async function fsRead(path) {
  const parts = splitPath(path);
  if (!parts.length) throw new Error('fs.read: empty path');
  const name = parts.pop();
  const dir = await fsResolveDir(parts);
  const fh = await dir.getFileHandle(name);
  const file = await fh.getFile();
  return await file.arrayBuffer();
}

async function fsWrite(path, data) {
  const parts = splitPath(path);
  if (!parts.length) throw new Error('fs.write: empty path');
  const name = parts.pop();
  const dir = await fsResolveDir(parts, { create: true });
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(data);
  await w.close();
}

async function fsDelete(path) {
  const parts = splitPath(path);
  if (!parts.length) {
    const root = await navigator.storage.getDirectory();
    for await (const name of root.keys()) await root.removeEntry(name, { recursive: true });
    return;
  }
  const name = parts.pop();
  const dir = await fsResolveDir(parts);
  await dir.removeEntry(name, { recursive: true });
}

async function fsList(path) {
  const dir = await fsResolveDir(splitPath(path));
  const out = [];
  for await (const [name, handle] of dir.entries()) out.push({ name, kind: handle.kind });
  return out;
}

async function fsMkdir(path) {
  await fsResolveDir(splitPath(path), { create: true });
}

// -- chrome.* dispatcher -------------------------------------------------

function resolveChrome(path) {
  const parts = String(path || '').split('.');
  let obj = chrome, parent = null, key = null;
  for (let i = 0; i < parts.length; i++) {
    parent = obj;
    key = parts[i];
    obj = obj?.[key];
    if (obj === undefined) throw new Error('chrome.' + path + ': not found');
  }
  return { fn: obj, thisArg: parent, name: key };
}

async function chromeCall(path, args) {
  const { fn, thisArg } = resolveChrome(path);
  if (typeof fn !== 'function') throw new Error('chrome.' + path + ': not a function');
  const result = fn.apply(thisArg, args);
  return result && typeof result.then === 'function' ? await result : result;
}

const chromeSubs = new Map(); // subId -> { event, listener }
const pendingResponses = new Map(); // respId -> sendResponse
let nextRespId = 1;

// runtime.onMessage and runtime.onMessageExternal pass a sendResponse
// callback that must be invoked after async work to deliver a reply to
// the original sender. The callback is not structured-cloneable and the
// reply window closes if the listener returns false, so these events
// need a response-id round-trip across the bridge.
const RESPONSE_EVENTS = new Set(['runtime.onMessage', 'runtime.onMessageExternal']);

function chromeOn(subId, path, source) {
  const { fn: ev } = resolveChrome(path);
  if (!ev || typeof ev.addListener !== 'function') {
    throw new Error('chrome.' + path + ': not an event');
  }

  let listener;
  if (RESPONSE_EVENTS.has(path)) {
    listener = (message, sender, sendResponse) => {
      const respId = nextRespId++;
      pendingResponses.set(respId, sendResponse);
      try {
        source.postMessage({ sb: 1, event: subId, args: [message, sender], respId }, '*');
      } catch {
        pendingResponses.delete(respId);
        return false;
      }
      // If the iframe never replies, drop the entry eventually so the map
      // doesn't grow unboundedly. Chrome will close its own port on its
      // own schedule independently.
      setTimeout(() => pendingResponses.delete(respId), 5 * 60_000);
      return true;
    };
  } else {
    listener = (...args) => {
      try { source.postMessage({ sb: 1, event: subId, args }, '*'); } catch {}
    };
  }

  ev.addListener(listener);
  chromeSubs.set(subId, { event: ev, listener });
}

function chromeOff(subId) {
  const sub = chromeSubs.get(subId);
  if (!sub) return;
  try { sub.event.removeListener(sub.listener); } catch {}
  chromeSubs.delete(subId);
}

// -- privileged fetch ----------------------------------------------------

async function privilegedFetch(url, opts) {
  const res = await fetch(url, opts || undefined);
  const body = await res.arrayBuffer();
  return {
    status: res.status,
    statusText: res.statusText,
    ok: res.ok,
    url: res.url,
    redirected: res.redirected,
    type: res.type,
    headers: [...res.headers],
    body,
  };
}

// -- bridge dispatcher ---------------------------------------------------

let activeIframe = null;

window.addEventListener('message', async (e) => {
  if (!activeIframe || e.source !== activeIframe.contentWindow) return;
  const m = e.data;
  if (!m || m.sb !== 1) return;

  if (m.respondTo != null) {
    const sendResponse = pendingResponses.get(m.respondTo);
    if (sendResponse) {
      pendingResponses.delete(m.respondTo);
      if (!m.close) try { sendResponse(m.value); } catch {}
    }
    return;
  }

  if (m.id == null) return;

  let value, ok = true, errorMsg;
  try {
    switch (m.op) {
      case 'kv': {
        if (m.method === 'get') value = await kvGet(m.db, m.key);
        else if (m.method === 'set') value = await kvSet(m.db, m.key, m.value);
        else if (m.method === 'delete') value = await kvDelete(m.db, m.key);
        else if (m.method === 'keys') value = await kvKeys(m.db);
        else if (m.method === 'drop') value = await kvDrop(m.db);
        else throw new Error('kv: unknown method ' + m.method);
        break;
      }
      case 'fs': {
        if (m.method === 'read') value = await fsRead(m.path);
        else if (m.method === 'write') value = await fsWrite(m.path, m.data);
        else if (m.method === 'delete') value = await fsDelete(m.path);
        else if (m.method === 'list') value = await fsList(m.path);
        else if (m.method === 'mkdir') value = await fsMkdir(m.path);
        else throw new Error('fs: unknown method ' + m.method);
        break;
      }
      case 'chrome':
        value = await chromeCall(m.path, m.args || []);
        break;
      case 'chromeOn':
        chromeOn(m.subId, m.path, e.source);
        value = null;
        break;
      case 'chromeOff':
        chromeOff(m.subId);
        value = null;
        break;
      case 'fetch':
        value = await privilegedFetch(m.url, m.opts);
        break;
      case 'hideReset':
        // No-op in the extension — reset lives in the popup.
        value = null;
        break;
      default:
        throw new Error('unknown op: ' + m.op);
    }
  } catch (err) {
    ok = false;
    errorMsg = String(err && err.message || err);
  }

  try {
    if (ok) e.source.postMessage({ sb: 1, id: m.id, ok: true, value }, '*');
    else e.source.postMessage({ sb: 1, id: m.id, ok: false, error: errorMsg }, '*');
  } catch {}
});

// -- loader --------------------------------------------------------------

async function sha256hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function log(msg) {
  const out = document.getElementById('out');
  if (out) out.append(msg + '\n');
}

function execute(source, input) {
  document.getElementById('springboard-style')?.remove();
  document.body.removeEventListener('dragover', onDragOver);
  document.body.removeEventListener('drop', onDrop);
  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;';
  document.documentElement.style.cssText = 'height:100%;';

  const iframe = document.createElement('iframe');
  iframe.src = 'sandbox.html';
  iframe.allow = 'camera; microphone; geolocation; clipboard-read; clipboard-write; fullscreen; gamepad';
  iframe.style.cssText = 'border:0;width:100vw;height:100vh;display:block;';
  iframe.addEventListener('load', () => {
    iframe.contentWindow.postMessage(
      { sb: 1, run: true, source, input: input ?? null },
      '*'
    );
  });

  document.body.append(iframe);
  activeIframe = iframe;
}

async function tryResolver(url, sha256, configText, input, state) {
  log('try ' + url);
  try {
    const body = await (await fetch(url)).text();
    if (state.matched) return;
    if (await sha256hex(body) !== sha256) return log('bad ' + url);
    state.matched = true;
    await kvSet(DB_NAME, sha256, body);
    await kvSet(DB_NAME, CONFIG_KEY, configText);
    log('match ' + url);
    execute(body, input);
  } catch {
    log('err ' + url);
  }
}

async function springboard(configText) {
  const { sha256, resolvers, input } = JSON.parse(configText);

  const cached = await kvGet(DB_NAME, sha256);
  if (cached) return execute(cached, input);

  const shuffled = resolvers.slice().sort(() => Math.random() - 0.5);
  const state = { matched: false };
  let nextIndex = 0;

  function launchNext() {
    if (state.matched || nextIndex >= shuffled.length) return;
    tryResolver(shuffled[nextIndex++], sha256, configText, input, state);
    setTimeout(launchNext, 3000);
  }
  launchNext();
}

function showUI() {
  const style = document.createElement('style');
  style.id = 'springboard-style';
  style.textContent = STYLES;
  document.head.append(style);
  document.body.innerHTML = `
    <main>
      <h1>Springboard</h1>
      <textarea id="input" placeholder='{ "sha256": "...", "resolvers": ["https://..."], "input": ... }' autofocus></textarea>
      <button id="go">GO</button>
      <pre id="out"></pre>
    </main>`;
  document.getElementById('go').onclick = onGoClick;
  document.body.addEventListener('dragover', onDragOver);
  document.body.addEventListener('drop', onDrop);
}

function onGoClick() {
  springboard(document.getElementById('input').value);
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
}

async function onDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const text = await file.text();
  const ta = document.getElementById('input');
  if (ta) ta.value = text;
  springboard(text);
}

// -- reset signal from popup --------------------------------------------

if (chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'springboard:reset') {
      setTimeout(() => location.reload(), 0);
    }
    return false;
  });
}

// -- boot ---------------------------------------------------------------

async function start() {
  const stored = await kvGet(DB_NAME, CONFIG_KEY);
  if (stored) springboard(stored);
  else showUI();
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start);
else start();

})();
