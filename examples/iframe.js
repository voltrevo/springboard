// A springboard program that runs another springboard config inside a
// nested sandboxed iframe. The inner iframe gets its own opaque origin
// and — crucially — no springboard bridge: this wrapper does not relay
// postMessages down to its child, so the inner program has no access
// to the loader's storage or chrome.* capabilities. It is fully
// isolated except for whatever the surrounding browser already grants
// to an opaque-origin document.
//
// `input` is expected to be { sha256, resolvers, input } — the config
// of the program to mount inside. Inner preimages are cached in a
// separate kv database name so they can never collide with the outer
// springboard's cache.

const META_DB = 'springboard-meta';
const kv = springboard.kv;

async function sha256hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function status(msg) {
  let el = document.getElementById('iframe-status');
  if (!el) {
    el = document.createElement('pre');
    el.id = 'iframe-status';
    el.style.cssText = 'margin:0;padding:12px;font:12px ui-monospace,monospace;color:#888;';
    document.body.append(el);
  }
  el.append(msg + '\n');
}

function escapeForScript(s) {
  return s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
}

function mount(source, innerInput) {
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

async function tryResolver(url, sha256, innerInput, state) {
  status('try ' + url);
  try {
    const body = await (await fetch(url)).text();
    if (state.matched) return;
    if (await sha256hex(body) !== sha256) return status('bad ' + url);
    state.matched = true;
    await kv.set(META_DB, sha256, body);
    status('match ' + url);
    mount(body, innerInput);
  } catch {
    status('err ' + url);
  }
}

async function main() {
  const { sha256, resolvers, input: innerInput } = input;

  const cached = await kv.get(META_DB, sha256);
  if (cached) return mount(cached, innerInput);

  const shuffled = resolvers.slice().sort(() => Math.random() - 0.5);
  const state = { matched: false };
  let nextIndex = 0;

  function launchNext() {
    if (state.matched || nextIndex >= shuffled.length) return;
    tryResolver(shuffled[nextIndex++], sha256, innerInput, state);
    setTimeout(launchNext, 3000);
  }
  launchNext();
}

main();
