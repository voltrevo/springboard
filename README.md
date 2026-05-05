# springboard

A single-file HTML bootstrap loader. You give it a SHA-256 hash and a list of URLs; it fetches them in shuffled order until one body matches the hash, caches the preimage, and runs it as JavaScript.

## Use

Open [Springboard](https://voltrevo.github.io/springboard/). Paste a JSON config and press **GO** (or drop a `.json` file onto the page):

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

## Isolation, and why it's optional

A program loaded by springboard runs in the same origin and shares the same `window` and IndexedDB as the loader itself. That gives it the keys to the kingdom: it can rewrite the cached preimage under any hash, change the persisted config, register service workers, or otherwise replace springboard with something else of its choosing.

This is deliberate. The root loader is intentionally general so that upgrades are expressible *as programs*: a running app can publish a new config, persist it under `config`, and the next visit boots the upgraded version. Same-origin access is the mechanism that makes the platform self-hosting.

The flip side is that any program you run can do the same thing — including a malicious one, or a benign one whose dependencies have been compromised. If you don't want that capability extended to a particular program, you don't grant it: you wrap the program in an isolating loader.

[`examples/iframe.js`](examples/iframe.js) is one such loader. It is a springboard program whose `input` is *another* springboard config. It fetches and verifies the inner config, then mounts the source inside an iframe with `sandbox="allow-scripts allow-modals"` (deliberately *not* `allow-same-origin`). The iframe runs in a unique opaque origin, so the inner program cannot reach the parent's IndexedDB, localStorage, cookies, or DOM. It cannot rewrite the cache, swap itself out, or escape; the worst it can do is misbehave inside its own pixel rectangle until you click reset.

To run the `alert('hi')` example through the sandbox, nest the configs:

```json
{
  "sha256": "841cf7aa1eddf0787b6233bf10eb57f3f5a2675745a1620bfba41aab76df6aee",
  "resolvers": ["https://raw.githubusercontent.com/voltrevo/springboard/b5caf69/examples/iframe.js"],
  "input": {
    "sha256": "5d3a8da854949591c05bb7ff38635848e133c4a863740006317a227765446c99",
    "resolvers": ["data:text/plain,alert('hi')"],
    "input": null
  }
}
```

Inner preimages are cached in a separate IndexedDB database (`springboard-meta`) so they cannot collide with the outer cache. The reset icon clears only the *outer* `springboard` database; clearing the inner cache requires deleting `springboard-meta` from devtools (or extending `iframe.js` to expose its own reset).

## Other examples

Each is a self-contained program loadable by springboard. To run any of them sandboxed, wrap the config inside an `iframe.js` config as shown above.

| Program | Description |
| --- | --- |
| [`examples/calculator.js`](examples/calculator.js) | `ddd63944328e3dba46b80a216397d322a53c230656b7da9f23f06940f0281ca5`<br>Four-function calculator with keyboard support. |
| [`examples/snake.js`](examples/snake.js) | `61449ddc6b7d6fbed749825f647422cf4e34bb050a928f26dd206b8ec4d8e2fe`<br>Classic snake on a 20×20 grid. Arrow keys / WASD; space to restart. |
| [`examples/paint.js`](examples/paint.js) | `877c4c501aedbfbe3353e1eefffc041384b783e694198c40d6a4fe8cc01577a9`<br>Pointer drawing with color picker, brush size, and clear. |
| [`examples/store.js`](examples/store.js) | `b2298177ec94065cbf18cf7d99b9bdd5b2341fc604940083b814d092259e45bb`<br>App launcher: persists a list of springboard configs, mounts the chosen one in a sandboxed iframe, and includes a springboard-style "add app" form (with JSON file drop). Pre-loaded with the calculator. |

The base resolver pattern is `https://raw.githubusercontent.com/voltrevo/springboard/b5caf69/examples/<file>`.

For example, to run the app store directly:

```json
{
  "sha256": "b2298177ec94065cbf18cf7d99b9bdd5b2341fc604940083b814d092259e45bb",
  "resolvers": ["https://raw.githubusercontent.com/voltrevo/springboard/b5caf69/examples/store.js"],
  "input": null
}
```
