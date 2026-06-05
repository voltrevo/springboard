# springboard

A bootstrap loader. You give it a SHA-256 hash and a list of URLs; it fetches them in shuffled order until one body matches the hash, caches the preimage, and runs it as JavaScript inside a sandboxed iframe with a small RPC bridge back to the loader for persistent storage and (in the extension) `chrome.*` APIs.

Two flavours:
- **Web**: a single-file [Springboard](https://voltrevo.github.io/springboard/) at github-pages — open it, paste a config, go.
- **Extension** (`extension/`): same architecture on the browser new-tab page, with the wider `chrome.*` surface and a popup-driven reset.

## Use

Open [Springboard](https://voltrevo.github.io/springboard/) (or install the extension and open a new tab). Paste a JSON config and press **GO** (or drop a `.json` file onto the page):

```json
{
  "sha256": "5d3a8da854949591c05bb7ff38635848e133c4a863740006317a227765446c99",
  "resolvers": ["data:text/plain,alert('hi')"],
  "input": null
}
```

- `sha256` — hex digest of the program source.
- `resolvers` — URLs that serve the source. Must be CORS-readable. `data:` URLs work.
- `input` — arbitrary JSON value passed to the program as a free variable named `input`.

After a successful run, the config is persisted. On subsequent loads springboard skips the UI entirely and re-executes the cached program.

## Behavior

- **Fetch strategy**: resolvers are shuffled and tried sequentially with a 3 s gap between launches; earlier requests are *not* aborted, so a slow-but-first request can still win.
- **Verification**: each response body is SHA-256'd; mismatches are discarded, the first match wins.
- **Execution**: the matched source runs inside a sandboxed iframe (web: `srcdoc` with `sandbox="allow-scripts allow-modals allow-popups allow-forms allow-downloads"`; extension: manifest-sandboxed `sandbox.html`). The iframe has an opaque origin — same browser sandbox as `iframe.js`-wrapped programs had before — and reaches the loader's storage and (in the extension) `chrome.*` APIs through a postMessage bridge.
- **Bridge surface (`springboard.*` inside the iframe)**:
  - `kv.{get,set,delete,keys,drop}(db, key?, value?)` — IndexedDB key-value at the loader's origin; any db name.
  - `fs.{read,write,delete,list,mkdir}(path, data?)` — OPFS path API at the loader's origin.
  - `chrome(path, ...args)` and `chrome.on(eventPath, fn)` — generic dispatcher into the parent's `chrome.*` namespace. Rejects with "not available" on the web loader; available in the extension.
  - `fetch(url, opts)` — fetch issued from the parent. In the extension this bypasses CORS (`host_permissions: <all_urls>`); on the web it's equivalent to native fetch from the loader's origin.
  - `hideReset()` — hide the loader's reset icon (web only; no-op in the extension, where reset lives in the popup).
- **Storage**: IndexedDB database `springboard`, object store `kv`. Preimages are keyed by their hash; the full config string lives under key `config`. Programs see this via `springboard.kv.*`.
- **Isolation**: the loader runs at its own origin; the program runs at an opaque origin one frame deeper. The only path from program to loader is the bridge.

## Reset

**Web**: a small refresh icon in the top-right corner is attached to `<html>` and stays visible above the program iframe. Click it, confirm, and every IndexedDB database at the loader origin plus OPFS are wiped, then the page reloads.

**Extension**: click the toolbar icon and press **Reset** in the popup. Same effect, plus `chrome.storage` local/sync/session are also cleared.

A loaded program can hide the web reset icon:

```js
springboard.hideReset();
```

## Isolation, and why it's optional

A program loaded by springboard runs in a browser-enforced sandbox (opaque-origin iframe) — but the loader answers every postMessage it sends on the bridge, so it can do effectively anything: rewrite the cached preimage under any hash, change the persisted config, write to OPFS, open tabs and fire notifications (extension), CORS-free fetch arbitrary URLs (extension). The sandbox is a workaround Manifest V3 requires for `new Function`; the bridge re-empowers it.

This is deliberate. The root loader is intentionally general so that upgrades are expressible *as programs*: a running app can `springboard.kv.set('springboard', 'config', newConfig)` and `location.reload()`, and the next visit boots the upgraded version. The bridge is the mechanism that keeps the platform self-hosting.

The flip side is that any program you run can do the same thing — including a malicious one, or a benign one whose dependencies have been compromised. If you don't want that capability extended to a particular program, you don't grant it: you wrap the program in a loader that doesn't relay the bridge to its child.

[`examples/iframe.js`](examples/iframe.js) is one such wrapper. It is a springboard program whose `input` is *another* springboard config. It fetches and verifies the inner config, then mounts the source inside a nested iframe with `sandbox="allow-scripts allow-modals"` — and crucially does **not** install a postMessage relay for its child. The inner program runs in its own opaque origin with no `springboard` global, no path back to the loader's storage, no `chrome.*`. It cannot rewrite the cache, swap itself out, or escape; the worst it can do is misbehave inside its own pixel rectangle until you reset.

(In the extension the "kingdom" is larger than on the web — it includes `chrome.tabs`, `chrome.notifications`, `chrome.alarms`, `chrome.storage.sync`, CORS-free fetch, and more — which is exactly why `iframe.js`-style wrapping is a useful tool to keep in mind.)

To run the `alert('hi')` example through the sandbox, nest the configs:

```json
{
  "sha256": "141cba31560ad1228e2497d866c34ff0f4693f3379f387fc4a2b2740736e6a9e",
  "resolvers": ["https://raw.githubusercontent.com/voltrevo/springboard/92f8f7d/examples/iframe.js"],
  "input": {
    "sha256": "5d3a8da854949591c05bb7ff38635848e133c4a863740006317a227765446c99",
    "resolvers": ["data:text/plain,alert('hi')"],
    "input": null
  }
}
```

Inner preimages are cached in a separate kv database (`springboard-meta`) so they cannot collide with the outer cache. Reset wipes every IndexedDB database at the loader origin, so it clears the inner cache too.

## Other examples

Each is a self-contained program loadable by springboard. To run any of them sandboxed, wrap the config inside an `iframe.js` config as shown above.

| Program | Description |
| --- | --- |
| [`examples/calculator.js`](examples/calculator.js) | `ddd63944328e3dba46b80a216397d322a53c230656b7da9f23f06940f0281ca5`<br>Four-function calculator with keyboard support. |
| [`examples/snake.js`](examples/snake.js) | `61449ddc6b7d6fbed749825f647422cf4e34bb050a928f26dd206b8ec4d8e2fe`<br>Classic snake on a 20×20 grid. Arrow keys / WASD; space to restart. |
| [`examples/paint.js`](examples/paint.js) | `877c4c501aedbfbe3353e1eefffc041384b783e694198c40d6a4fe8cc01577a9`<br>Pointer drawing with color picker, brush size, and clear. |
| [`examples/store.js`](examples/store.js) | `cf8a0da03a56d7df83e4c99264feb4537c3c29801c1bd46215efa607fbe597f6`<br>App launcher: persists a list of springboard configs, mounts the chosen one in a sandboxed iframe, and includes a springboard-style "add app" form (with JSON file drop). Pre-loaded with the calculator. |

The base resolver pattern is `https://raw.githubusercontent.com/voltrevo/springboard/92f8f7d/examples/<file>`.

For example, to run the app store directly:

```json
{
  "sha256": "cf8a0da03a56d7df83e4c99264feb4537c3c29801c1bd46215efa607fbe597f6",
  "resolvers": ["https://raw.githubusercontent.com/voltrevo/springboard/92f8f7d/examples/store.js"],
  "input": null
}
```
