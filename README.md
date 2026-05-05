# springboard

A single-file HTML bootstrap loader. You give it a SHA-256 hash and a list of URLs; it fetches them in shuffled order until one body matches the hash, caches the preimage, and runs it as JavaScript.

## Use

Open [`index.html`](index.html) in a browser. Paste a JSON config and press **GO**:

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

## Reset hotkey

**Ctrl/Cmd+Shift+Backspace** prompts and then deletes the IndexedDB database and reloads the page.

The loaded program can disable it:

```js
springboard.disableResetHotkey();
```
