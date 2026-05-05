# springboard

A single-file HTML bootstrap loader. You give it a SHA-256 hash and a list of URLs; it fetches them in shuffled order until one body matches the hash, caches the preimage, and runs it as JavaScript.

## Use

Open [`index.html`](index.html) in a browser. Paste a JSON config and press **GO** (or drop a `.json` file onto the page):

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
- **Execution**: the matched source is invoked as `new Function('input', source)(input)`. The springboard UI is torn down and its styles removed before the program runs.
- **Storage**: IndexedDB database `springboard`, object store `kv`. Preimages are keyed by their hash; the full config string lives under key `config`.
- **Isolation**: the loader runs inside an IIFE; the only global it exposes is `window.springboard`.

## Reset

A small refresh icon in the top-right corner is attached to `<html>` and survives UI teardown, so it remains visible while the loaded program runs (including over an iframe). Click it, confirm, and the IndexedDB database is deleted and the page reloads.

The loaded program can hide it:

```js
springboard.hideReset();
```

## Composition: the iframe sandbox example

[`examples/iframe.js`](examples/iframe.js) is itself a springboard program. Its `input` is *another* springboard config, which it fetches, verifies, and mounts inside a sandboxed iframe (`sandbox="allow-scripts allow-modals"`, no `allow-same-origin`). The iframe runs in a unique opaque origin, so the inner program cannot access the parent's IndexedDB, localStorage, cookies, or DOM — and therefore cannot overwrite the springboard cache.

To run the `alert('hi')` example through the sandbox, nest the configs:

```json
{
  "sha256": "<sha256 of iframe.js>",
  "resolvers": ["https://raw.githubusercontent.com/voltrevo/springboard/main/examples/iframe.js"],
  "input": {
    "sha256": "5d3a8da854949591c05bb7ff38635848e133c4a863740006317a227765446c99",
    "resolvers": ["data:text/plain,alert('hi')"],
    "input": null
  }
}
```

Inner preimages are cached in a separate IndexedDB database (`springboard-meta`) so they cannot collide with the outer cache. The reset icon still wipes only the *outer* `springboard` database; clearing the inner cache requires deleting `springboard-meta` from devtools (or extending `iframe.js` to expose its own reset).
