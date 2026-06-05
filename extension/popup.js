(() => {

const status = document.getElementById('status');
const btn = document.getElementById('reset');

async function deleteAllDBs() {
  const dbs = await indexedDB.databases();
  await Promise.all(dbs.map(({ name }) => new Promise((resolve) => {
    if (!name) return resolve();
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => {};
  })));
}

async function clearOPFS() {
  try {
    const root = await navigator.storage.getDirectory();
    for await (const name of root.keys()) {
      try { await root.removeEntry(name, { recursive: true }); } catch {}
    }
  } catch {}
}

btn.onclick = async () => {
  if (!confirm('Reset Springboard? Wipes all stored data.')) return;
  btn.disabled = true;
  status.textContent = 'Resetting…';

  // Tell open extension pages to reload, releasing any storage handles.
  // The new tab page reloads on receipt and never sends a response, so
  // sendMessage rejects with "message port closed" — ignore it.
  try { await chrome.runtime.sendMessage({ type: 'springboard:reset' }); } catch {}

  await deleteAllDBs();
  await clearOPFS();
  try { await chrome.storage.local.clear(); } catch {}
  try { await chrome.storage.sync.clear(); } catch {}
  try { await chrome.storage.session.clear(); } catch {}

  status.textContent = 'Done.';
  btn.disabled = false;
};

})();
