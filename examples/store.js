// Tiny app store. Persists a list of springboard configs and launches the
// chosen one inside a sandboxed iframe. Reload returns to the launcher.

const DB_NAME = 'springboard-store';
const STORE = 'kv';

const SEED_APPS = [
  {
    name: 'Calculator',
    config: {
      sha256: 'ddd63944328e3dba46b80a216397d322a53c230656b7da9f23f06940f0281ca5',
      resolvers: [
        '/examples/calculator.js',
        'https://raw.githubusercontent.com/voltrevo/springboard/main/examples/calculator.js',
      ],
      input: null,
    },
  },
];

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getApps() {
  return (await idbGet('apps')) ?? SEED_APPS;
}

async function saveApps(apps) {
  await idbSet('apps', apps);
}

async function sha256hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function escapeForScript(s) {
  return s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
}

async function fetchVerified(config) {
  const cacheKey = 'cache:' + config.sha256;
  const cached = await idbGet(cacheKey);
  if (cached) return cached;
  const order = config.resolvers.slice().sort(() => Math.random() - 0.5);
  for (const url of order) {
    try {
      const body = await (await fetch(url)).text();
      if ((await sha256hex(body)) === config.sha256) {
        await idbSet(cacheKey, body);
        return body;
      }
    } catch {}
  }
  throw new Error('no resolver produced a matching body');
}

function mountIframe(source, innerInput) {
  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;';
  document.documentElement.style.cssText = 'height:100%;';
  const iframe = document.createElement('iframe');
  iframe.sandbox = 'allow-scripts allow-modals';
  iframe.style.cssText = 'border:0;width:100vw;height:100vh;display:block;';
  const inputJson = JSON.stringify(innerInput ?? null).replace(/</g, '\\u003c');
  iframe.srcdoc =
    '<!doctype html><title>springboard</title><body></body>' +
    '<script>(function(input){' + escapeForScript(source) + '})(' + inputJson + ');</' + 'script>';
  document.body.append(iframe);
}

function tileStyle(kind) {
  const accent = kind === 'add';
  return (
    'aspect-ratio:1;border:1px solid #d4d4d0;border-radius:8px;background:#fff;cursor:pointer;' +
    'font:' + (accent ? '600 36px' : '600 14px') + ' ui-monospace,monospace;' +
    'color:' + (accent ? '#357edd' : '#222') + ';' +
    'display:flex;align-items:center;justify-content:center;text-align:center;padding:8px;' +
    'transition:background .15s,border-color .15s;word-break:break-word;'
  );
}

async function showLauncher() {
  document.body.style.cssText =
    'margin:0;min-height:100vh;background:#f6f6f4;font:14px ui-monospace,monospace;color:#222;';
  document.body.innerHTML =
    '<h1 style="text-align:center;font-weight:500;color:#888;letter-spacing:.04em;margin:24px 0;">app store</h1>';

  const grid = document.createElement('div');
  grid.style.cssText =
    'display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;' +
    'padding:12px;max-width:720px;margin:0 auto;';
  document.body.append(grid);

  const apps = await getApps();

  apps.forEach((app, i) => {
    const tile = document.createElement('button');
    tile.style.cssText = tileStyle('app');
    tile.textContent = app.name;
    tile.title = app.name;
    tile.onclick = () => launch(app);
    tile.oncontextmenu = e => {
      e.preventDefault();
      removeApp(i);
    };
    grid.append(tile);
  });

  const add = document.createElement('button');
  add.style.cssText = tileStyle('add');
  add.textContent = '+';
  add.title = 'Add app';
  add.onclick = onAdd;
  grid.append(add);

  const hint = document.createElement('div');
  hint.style.cssText = 'text-align:center;color:#888;font-size:12px;margin:18px 0;';
  hint.textContent = 'click to launch · right-click to remove · reload to come back';
  document.body.append(hint);
}

function onAddDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
}

let onAddDropHandler = null;

function detachAddListeners() {
  document.body.removeEventListener('dragover', onAddDragOver);
  if (onAddDropHandler) document.body.removeEventListener('drop', onAddDropHandler);
  onAddDropHandler = null;
}

function showAddApp() {
  document.body.style.cssText =
    'margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'background:#f6f6f4;color:#222;font:14px/1.4 ui-monospace,monospace;';
  document.body.innerHTML = `
    <main style="width:min(680px,92vw);display:flex;flex-direction:column;gap:12px;">
      <h1 style="margin:0;font-size:20px;font-weight:500;letter-spacing:.04em;text-align:center;color:#888;">add app</h1>
      <input id="add-name" placeholder="App name"
        style="padding:10px 12px;background:#fff;color:#222;border:1px solid #d4d4d0;border-radius:6px;font:inherit;outline:none;" autofocus>
      <textarea id="add-config" placeholder='{ "sha256": "...", "resolvers": ["https://..."], "input": ... }'
        style="width:100%;height:32vh;box-sizing:border-box;padding:12px;background:#fff;color:#222;border:1px solid #d4d4d0;border-radius:6px;font:inherit;resize:vertical;outline:none;"></textarea>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button id="add-cancel" style="padding:10px 20px;background:#eee;color:#222;border:0;border-radius:6px;font:600 14px/1 ui-monospace,monospace;letter-spacing:.06em;cursor:pointer;">CANCEL</button>
        <button id="add-save" style="padding:10px 28px;background:#357edd;color:#fff;border:0;border-radius:6px;font:600 14px/1 ui-monospace,monospace;letter-spacing:.06em;cursor:pointer;">SAVE</button>
      </div>
    </main>`;

  const nameEl = document.getElementById('add-name');
  const cfgEl = document.getElementById('add-config');

  document.getElementById('add-cancel').onclick = () => {
    detachAddListeners();
    showLauncher();
  };

  document.getElementById('add-save').onclick = async () => {
    const name = nameEl.value.trim();
    if (!name) return alert('Name is required.');
    let config;
    try {
      config = JSON.parse(cfgEl.value);
    } catch {
      return alert('Invalid JSON.');
    }
    if (typeof config.sha256 !== 'string' || !Array.isArray(config.resolvers)) {
      return alert('Config must include "sha256" (string) and "resolvers" (array).');
    }
    const apps = await getApps();
    apps.push({ name, config });
    await saveApps(apps);
    detachAddListeners();
    showLauncher();
  };

  onAddDropHandler = async e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    cfgEl.value = await file.text();
    if (!nameEl.value) nameEl.value = file.name.replace(/\.json$/i, '');
  };
  document.body.addEventListener('dragover', onAddDragOver);
  document.body.addEventListener('drop', onAddDropHandler);
}

const onAdd = showAddApp;

async function removeApp(index) {
  const apps = await getApps();
  const app = apps[index];
  if (!app) return;
  if (!confirm(`Remove "${app.name}"?`)) return;
  apps.splice(index, 1);
  await saveApps(apps);
  showLauncher();
}

async function launch(app) {
  document.body.style.cssText = 'margin:0;background:#f6f6f4;font:14px ui-monospace,monospace;color:#888;';
  document.body.innerHTML =
    `<div style="padding:24px;text-align:center;">launching ${app.name}…</div>`;
  try {
    const source = await fetchVerified(app.config);
    mountIframe(source, app.config.input);
  } catch (e) {
    document.body.innerHTML =
      `<div style="padding:24px;color:#a44;text-align:center;">failed to load ${app.name}: ${e.message}</div>`;
  }
}

showLauncher();
