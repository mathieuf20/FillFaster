# FillFaster

Browser extension (Chrome + Firefox, Manifest V3) to snapshot web forms and restore them
instantly — built for developers doing submission testing and validation.

TypeScript rewrite (v2) of
[FormAssistant - Save & Restore](https://github.com/mathieuf20/FormAssistant-SaveAndRestore).
Same storage format: previously saved sets keep working.

## Features

- **Save / restore forms** — captures every visible input, select and textarea (id or name,
  radio/checkbox semantics, ASP.NET `__*` fields skipped, repeated names joined with `,`).
  Restore fills the form and fires native `input`/`change`/`blur` events so reactive
  frameworks notice it.
- **Auto-submit** — per set, a jQuery-style selector is clicked after the fill.
- **Filters** — domain / path / full URL filtering of saved sets, plus a global `*` URL.
- **URL wildcards** — a stored URL may contain `*` (e.g. `https://*.example.com/user/*`);
  field values may reference the captured groups with `{1}`, `{2}`, ... and are substituted
  from the current page's URL on restore.
- **Datetime placeholders** — fields starting with the configured prefix (default
  `@@@DTPH@@@`) are expanded on restore (`%H` `%M` `%S` `%d` `%m` `%y`, `%%` for a literal
  `%`). The prefix is configurable from the popup; changing it migrates all saved sets.
- **AI fill** — fields saved with the value `@@@AI@@@` (optionally followed by an
  instruction, e.g. `@@@AI@@@ a Lebanese-sounding name`) are filled on restore by an
  OpenAI-compatible chat completions endpoint. Configure the endpoint, API key, model and
  an optional default instruction from the popup (gear menu -> *AI fill settings...*).
  Works with OpenAI, OpenRouter, Groq, Ollama, LM Studio... The field's name, label,
  placeholder and type are sent as context. The API key is stored in extension storage and
  only sent to the configured endpoint.
- **Hotkeys** — bind a mousetrap-style combo per set (`shift+k`, `ctrl+shift+f`, ...);
  pressing it on a matching page fills that set.
- **Export / import** — copy a set's JSON to the clipboard (Copy button) or paste it back
  (Paste button); sets with URL `*` import as global sets.
- **Management** — rename sets, delete sets, clear sets for the current URL, view all sets
  with their URLs, clear all extension data.

## Build

```sh
npm install
npm run build   # typecheck + bundle -> dist/
npm test        # vitest suite
```

Load `dist/` as an unpacked extension:

- Chrome: `chrome://extensions` -> Developer mode -> *Load unpacked*.
- Firefox: `about:debugging#/runtime/this-firefox` -> *Load Temporary Add-on*.

The manifest is at `public/manifest.json`; icons and the manifest are copied to `dist/`
verbatim.

## Project layout

```
public/manifest.json     MV3 manifest (source of truth, copied to dist)
popup.html               popup entry (React)
src/shared/              types, URL matching + wildcards, datetime, hotkeys, storage, AI
src/content/             content script: form capture/fill + messaging + hotkey binding
src/background/          MV3 service worker: AI calls to the configured endpoint
src/popup/               React popup UI
tests/                   vitest suites (matching, datetime, hotkeys, form-io, storage, AI)
```

## Notes

- `browser_specific_settings.gecko.id` in the manifest is a placeholder; replace it with
  your real AMO extension id before submitting to Firefox.
- To update the published *FormAssistant - Save & Restore* listings instead of publishing
  a new extension, keep the store-side extension ids (the Firefox gecko id and the Chrome
  signing key) when uploading.
