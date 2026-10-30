# AGENTS.md

Handoff for a fresh agent that has only `https://github.com/Baegovda/bongtrans`. Read this file first. After every release, update this file and [docs/HISTORY.md](docs/HISTORY.md) in the same commit as the version bump. If a decision changes an invariant below, edit the invariant here. Do not leave the new behavior only in the changelog.

`CLAUDE.md` and `.cursor/rules/agents.mdc` only point here. Tool setup is [docs/MCP.md](docs/MCP.md). Put the real instructions in this file.

## BOOTSTRAP

Run this before editing. Stop when a required check fails. Do not invent a branch. Do not commit a token, `.env`, or `.pem`.

1. Read, in order: this file, `docs/MCP.md`, the newest `##` in `docs/HISTORY.md`, the top section of `CHANGELOG.md`.
2. Run `bash scripts/bootstrap.sh` from the repo root. It checks Node and `gh`, runs `node --test`, and prints `MISSING` lines. It does not install packages, write secrets, or change git state.
3. Install and authenticate every required server that printed `MISSING`. Commands and auth are in `docs/MCP.md`. Cursor uses the committed `.cursor/mcp.json`. Claude Code uses the committed `.mcp.json` (approve the project servers when asked). Codex copies the `config.toml` snippet in `docs/MCP.md` into `~/.codex/config.toml` or a trusted `.codex/config.toml`. Reload the host's MCP list after writing config.
4. GitHub MCP: official image `ghcr.io/github/github-mcp-server`, env `GITHUB_PERSONAL_ACCESS_TOKEN`. Export the token in the environment. Never paste it into a tracked file or into `mcp.json`. If Docker or the token is missing and `gh auth status` works, use the `gh` CLI for issues, workflow logs, and release checks. Do not let a missing MCP block a release that `gh` can already do.
5. Browser check of the extension: Playwright MCP (`npx -y @playwright/mcp@latest`) is the general browser tool. It does not load this unpacked extension. For the extension itself, launch Chrome for Testing with the flags in [Tests and local load](#tests-and-local-load), then attach `chrome-devtools-mcp` with `--browser-url=http://127.0.0.1:9222`. Trust `Runtime.evaluate`, not a vision model's reading of a screenshot.
6. Do not add a filesystem MCP. The checkout is the filesystem. Gemini docs are optional host web fetch (`https://ai.google.dev/gemini-api/docs`). Do not send the user's API key or page text to a docs tool.
7. Then do the owner's request on `main` and follow [Release procedure](#release-procedure).

## How to work with the owner

The owner writes short requests, usually in Korean, and expects a shipped release rather than a branch or a pull request. For each request:

1. Implement it on `main`. Do not open a pull request unless the owner explicitly asks for one. Do not invent a `cursor/` branch for this repo.
2. Keep user-facing copy in Korean. Internal names that already exist stay as they are (see Invariants).
3. Bump `manifest.json` and `package.json` together, add a Keep a Changelog section dated with the real day, and update the README where the behavior is user-visible.
4. Run `node --test`. Fix failures before tagging.
5. Commit on `main`, push `origin main`, create an annotated tag `vX.Y.Z` whose version matches the manifest, and push the tag. `.github/workflows/release.yml` publishes the GitHub Release.
6. Reply with the release URL (`https://github.com/Baegovda/bongtrans/releases/tag/vX.Y.Z`) and what changed, including the root cause when the request was a bug. If the workflow fails, say exactly what failed. Publish the release by hand only in that case, and say that you did.

Prefer a working release over a long design discussion. Record non-obvious choices in `docs/HISTORY.md`.

## Product

BongTrans is a Manifest V3 Chrome extension that translates the visible text of the current page with the user's own Gemini API key. It is aimed at long shopping pages (Taobao-style infinite scroll): viewport first, then scroll and DOM mutations. There is no build step and no runtime dependency. The content script is a classic IIFE. The options page, popup, and service worker are ES modules. `package.json` has `"type": "module"`.

Owner preferences:

- User-facing text is Korean (options, popup, errors, context strings). The README is Korean first, with a shorter English section after it.
- The product name is BongTrans. The GitHub repository is `Baegovda/bongtrans`. Do not point the update check back at `page-translator`. The `package.json` name, IndexedDB name, settings file type, and CSS prefix stay `page-translator`.
- Low API cost matters. Cache repeated strings. Skip invisible, script, style, code, and form text. Batch strings. Keep thinking small on Gemini 3 Flash-Lite. Do not send the API key to the page.
- Default model is `gemini-3.5-flash-lite`. The other preset is `gemini-3.1-flash-lite`. A saved `gemini-2.5-*` choice is migrated forward. Gemini 2.5 models return HTTP 404 for new users, so they are not presets. Overload (503/500) and model-not-found (404) retry, then fall back. An invalid key or a real quota error does not fall back.
- Stable extension id: `lgbhlmgajadkipicohfpnpnfdanhabmn`, from the public `key` in `manifest.json`.

## Architecture

| Path | Role |
| --- | --- |
| `manifest.json` | MV3 manifest, public `key`, permissions, commands. Version here must match the git tag. |
| `background.js` | Service worker. Menus, badge, injection, message router. No page logic that needs closures inside `executeScript`. |
| `content/content.js` | IIFE `pageTranslatorContent`. Walks text nodes, batches, writes `nodeValue`, draws the pending glow and reveal. |
| `popup/` | One ON/OFF switch for the current tab. **업데이트 확인** can open the update tab. |
| `options/` | API key, models, language, cursor priority, reveal toggle, cache stats and cleanup. The same update check as the popup. |
| `update.html`, `update.js`, `update.css` | One-click unpacked update. Directory picker runs here because it would close the popup. |
| `lib/settings.js` | Defaults, `normalizeSettings`, import/export. New settings must go through `normalizeSettings` or a save drops them. |
| `lib/settings-store.js` | `chrome.storage.local` key `settings`. |
| `lib/gemini.js` | HTTP, retries, fallback chain, key check. |
| `lib/translator.js` | Memory cache (5 000), persistent cache, in-flight dedupe, pool of 2. |
| `lib/cache.js` | IndexedDB. Database `page-translator`, store `translations`, version 2. |
| `lib/updates.js` | GitHub latest release at `https://api.github.com/repos/Baegovda/bongtrans/releases/latest`. User-Agent `BongTrans`. `assetUrl` is the zip, or null. `zipUrl` may fall back to the release page. |
| `lib/zip.js` | In-memory stored/deflate reader (`DecompressionStream('deflate-raw')`). Rejects zip-slip, encryption, and zip64. |
| `lib/installer.js` | Pure update plan: write order, byte compare, resume decision, version line, batches of 6. |
| `lib/cache-policy.js` | Age/size choices, LRU plan, byte estimate, cumulative stats. |
| `lib/chunk.js` | API chunks of 30 strings / 4 500 chars. The content script batches at 24 / 4 000 before that. |
| `lib/prompt.js` | JSON array in and out. Shopping Korean is the tuned case. |
| `lib/badge.js` | Per-tab badge text. |
| `lib/messages.js` | Korean error strings. |
| `lib/toggle-state.js` | Popup switch lock so a status poll cannot force it off. |
| `lib/errors.js` | `GeminiError`. |

Message flow:

1. The popup (or a command, or the context menu `toggle-translation`) messages the service worker `SET_ENABLED` / `TRANSLATE_TAB`.
2. The service worker injects `content/content.js` into frame 0, calls a self-contained function, then injects other frames best-effort. The top frame's return value decides success.
3. The content script sends `TRANSLATE_BATCH` with plain strings. The service worker calls Gemini and answers `{ ok, translations, model }`. The page never receives the API key.
4. The top frame sends `PROGRESS` and the service worker sets the toolbar badge for that tab. `CLEAR_BADGE` runs on top-frame `pagehide`. `tabs.onUpdated` clears the badge when `changeInfo.url` is a string.
5. `GET_PREFS` returns only `contentPrefs()` (`prioritizeCursor`, `revealAnimation`). A settings change broadcasts the same object. Do not add the API key to that payload.
6. Cache messages `GET_CACHE_STATS`, `RESET_CACHE_STATS`, and `CLEAR_CACHE` are accepted only from extension pages (`sender.url` starts with `chrome.runtime.getURL('')`).

Injection pitfall (1.3.1): functions passed to `chrome.scripting.executeScript` are serialized without closures. `enableInPage` and `disableInPage` must inline `window.top === window`. They must not call helpers that exist only in the service worker (`topStatus`, `isTopFrame`, anything imported). The popup treated that `ReferenceError` as a failed toggle and stayed OFF, so an already-open page never translated. `test/toggle-state.test.js` reads `background.js` and fails if those helpers reappear inside the injected functions.

Cache (1.4.0): values are `{ value, usedAt, bytes }`. `get` still returns a string. A hit updates `usedAt` through `touch`. Legacy string values are migrated on the v1 to v2 upgrade and are treated as used at migration time. Cumulative counters live in `chrome.storage.local` under `cacheStats` (`savedStrings`, `savedCalls`), not in the settings object, so import/export does not reset them and **번역 캐시 지우기** does not either. **통계 초기화** does. A request that still calls the API counts the cached strings but does not count a saved API call. A request served entirely from cache counts one avoided call per chunk. Default retention is 90 days and no byte cap (`cacheMaxBytes: 0`). Caps are 30/90/180/never and 5/20/50 MB or unlimited. Over the cap, evict the smallest `usedAt` first. Prune on service-worker startup, on settings change, and when the options page loads stats.

Update (1.5.0): the popup and options only open `update.html`. The directory picker, zip download, and writes stay in that tab. IndexedDB database `bongtrans-install` (stores `kv`, `pending`) holds the directory handle and an interrupted install. It is not `page-translator`, so **번역 캐시 지우기** does not drop the folder or the pending files. `writePlan` skips identical bytes and returns `manifest` separately from `rest`. `installFiles` writes `rest` at most `WRITE_CONCURRENCY` (6) at a time, then `manifest`. The extracted files are saved to `pending` before the first write. `pendingDecision` offers resume only when `pending.version` is newer than the running manifest. The picked folder and the zip must pass `isBongTransManifest` (`name` is `BongTrans`, and `key` matches the running manifest when a key is expected). `assetUrl` is null when the release has no zip; do not fetch `zipUrl` in that case, because it falls back to the release HTML page. Host permissions for the download are `https://github.com/*`, `https://objects.githubusercontent.com/*`, and `https://release-assets.githubusercontent.com/*` in addition to the API host. The release workflow rejects a zip that is missing a manifest path or that contains `test/`, `scripts/`, `docs/`, `.github/`, `.cursor/`, `package.json`, `AGENTS.md`, `CLAUDE.md`, or `.mcp.json`.

Reveal (1.5.1): do not wrap text nodes. Do not write `nodeValue` when the batch returns, and do not write it as each cell finishes. One vertical wiper (`pt-page-translator-wiper`, `translate3d`) crosses the batch. `requestAnimationFrame` reads every text rect once (`getBoundingClientRect`), then writes fixed overlays (`pt-page-translator-sweep`). Original and translation share that overlay and cross with `clip-path` on `--pt-p`. `planWiperOrder` / `crossProgress` / `lineSample` are the clock; RTL adds `pt-sweep-rtl` so the clip starts at the inline-start edge. `will-change` is only on the line, and on a cell while `0 < --pt-p < 1`. Live text is committed in one turn when the pass ends, so a longer translation cannot reflow neighbors mid-wipe. A later chunk joins the pass, or uses the same clip for `SOFT_MS` if the line has already passed it. Turning translation off runs the wiper upward (`showOriginal`). `prefers-reduced-motion: reduce` and `revealAnimation: false` write immediately and do not fade the cell. Text-only nodes take `pt-page-translator-hold` (`-webkit-text-fill-color: transparent`) for the pass; do not use `display` or `visibility` on the text. The animated pending glow (`pt-page-translator-pending-live`) stays capped at `MAX_LIVE_PENDING` (8). There is no per-node scan cap. Scroll remeasures in one read pass then one write pass. Own overlay nodes are ignored by class. `expectedWrite` still marks our `nodeValue` writes. A paint failure writes immediately.

## Invariants

- Keep the manifest `key`. Never commit a private key or a `.pem`. The id must stay `lgbhlmgajadkipicohfpnpnfdanhabmn`.
- `manifest.json` `version` must equal the tag without the leading `v`. The workflow compares them with `node --input-type=module` because `package.json` is `"type": "module"`. Do not use `require()`.
- `CHANGELOG.md` is Keep a Changelog. The newest section is `## [x.y.z] - YYYY-MM-DD`. The workflow uses `scripts/extract-changelog.js` as the release notes. Add the compare link at the bottom.
- README stays Korean first. Release examples should mention the current zip name.
- Settings JSON `type` stays `page-translator-settings`. Old imports must keep working. New fields get defaults inside `normalizeSettings`.
- IndexedDB name for the translation cache stays `page-translator`. The unpacked-update database is a different one, `bongtrans-install`. CSS classes stay prefixed `pt-page-translator-`. `package.json` `name` stays `page-translator`. Those survived the BongTrans rename on purpose. The GitHub repository is `Baegovda/bongtrans` as of 1.4.1. `RELEASES_LATEST` must stay `https://api.github.com/repos/Baegovda/bongtrans/releases/latest`. Old `page-translator` URLs redirect; the extension still calls the new path.
- Release asset name is `bongtrans-<version>.zip`. `lib/updates.js` prefers `/^bongtrans-.*\.zip$/i`, then `/^page-translator-.*\.zip$/i`. Renaming the asset breaks the update check. `.github/workflows/release.yml` sets `GH_REPO` to `Baegovda/bongtrans`.
- The zip root contains `manifest.json`, `background.js`, `LICENSE`, `README.md`, `CHANGELOG.md`, `update.html`, `update.js`, `update.css`, `content`, `lib`, `popup`, `options`, `icons`. It does not contain tests, `package.json`, `scripts`, `.github`, `AGENTS.md`, `docs`, `.cursor/`, or `.mcp.json`. Change `.github/workflows/release.yml` if a new extension file must ship. The workflow runs `scripts/verify-release-zip.js` after the zip is built.
- MCP configs stay free of secrets. Cursor placeholders are `${env:NAME}`. Claude Code placeholders are `${NAME}`. `.env` is gitignored. Do not add a filesystem MCP.
- Permissions stay `storage`, `contextMenus`, `activeTab`, `scripting`. Host permissions are `https://generativelanguage.googleapis.com/*`, `https://api.github.com/*`, `https://github.com/*`, `https://objects.githubusercontent.com/*`, and `https://release-assets.githubusercontent.com/*`. The three GitHub download hosts are only for the release zip (the API asset URL redirects). Do not add `webNavigation` (Chrome presents it as reading browsing history). Do not add `<all_urls>` or `https://*/*` to the committed manifest to make a manual test easier.
- Text is written with `nodeValue`, never `innerHTML`.
- Popup is one ON/OFF switch. `Ctrl+Shift+Y` and `Alt+Shift+O` both toggle. Context menu id is `toggle-translation`, title `BongTrans: Toggle translation`.
- Badge: per-tab count (`999`, `1.2k`, `12k`, `99k+`) while translation is on. Cleared when translation is off (`showOriginal`) or the address changes. Errors are a red `!`.
- `prioritizeCursor` defaults off. `revealAnimation` defaults on.
- Missing API key still turns the session on and shows the error. The switch stays ON. A `chrome://` page turns the switch OFF with `INJECT_FAILED` or `PAGE_BLOCKED`.

## Tests and local load

```bash
node --test
```

Node 22. Tests are `node:test` files under `test/`. The content script is loaded in `node:vm` (`test/content-session.test.js`). Arrays created inside that vm fail `deepEqual` until spread. The fake session's `hold` flag applies only to the first `sendBatch`.

Load unpacked from the repo root (`manifest.json` is there). Chrome 109+.

Headless checks, when a browser is required: branded Google Chrome ignores `--load-extension`. Use Playwright's Chrome for Testing with `--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --disable-extensions-except=<dir> --load-extension=<dir> --remote-debugging-port=9222 --remote-allow-origins=*`. Open extension pages by the known id. Other component extensions are also installed in that browser. `chrome.runtime.reload()` in that headless build can unload the extension instead of restarting it. `chrome.action.openPopup()` from the service worker does not grant `activeTab`. Trust `Runtime.evaluate` over a vision model's description of a screenshot.

## Release procedure

1. Update `AGENTS.md` and `docs/HISTORY.md` if the change adds a rule, a file, or a decision the next agent would otherwise rediscover.
2. Set `version` in `manifest.json` and `package.json`.
3. Add `## [x.y.z] - YYYY-MM-DD` at the top of `CHANGELOG.md` and a link at the bottom.
4. Update the README, including the zip example, when the user-visible behavior changed.
5. `node --test`.
6. Commit on `main`. Push `origin main`.
7. `git tag -a vX.Y.Z -m "vX.Y.Z"` and `git push origin vX.Y.Z`.

The tag workflow checks out the tag, runs tests, checks the manifest version, zips `bongtrans-<version>.zip`, checks that zip with `scripts/verify-release-zip.js`, and runs `gh release create`. A Node 20 deprecation annotation from an action, or an Ubuntu image notice, is a warning unless the job fails.

If the workflow fails, read the log, fix the cause or publish the same zip by hand, and say which one you did:

```bash
node --test
node scripts/extract-changelog.js X.Y.Z CHANGELOG.md > release-notes.md
# zip the paths listed in .github/workflows/release.yml
gh release create vX.Y.Z bongtrans-X.Y.Z.zip --title vX.Y.Z --notes-file release-notes.md
```

## Conventions

- Plain JS. No bundler, no new dependencies, no TypeScript.
- Match the surrounding style. Do not add comments that restate the code. A short comment is appropriate where a past bug will come back if the reason is invisible (the injection closure is the example).
- Do not rename internal identifiers, the database, or CSS classes as part of a branding pass.
- Errors that the user can see go through `lib/messages.js` or the existing Korean strings. Include a short English parenthesis when the neighboring messages do.
- Keep the content script free of the API key and of imports. It is not a module.
- Tests ship with the change. If a test asserts a CSS or source string, update it in the same commit.

## Known issues

- The release workflow may print a Node 20 deprecation annotation and an `ubuntu-latest` migration notice. Those are warnings.
- Headless `chrome.runtime.reload()` can drop the extension. A fresh Chrome for Testing profile can sit on “Chromium Additional Terms of Service” and not open `--remote-debugging-port` until that dialog is accepted. `--no-first-run` does not dismiss it.
- `openPopup` from the service worker does not grant `activeTab`, so a hidden tab URL plus `scripting` fails with `INJECT_FAILED`. That is expected on `chrome://` pages.
- Vision descriptions of extension screenshots have hallucinated the old name "Page Translator", the wrong checkbox state, and Chinese text that `Runtime.evaluate` showed had already been replaced. Trust the evaluated DOM.
- A translation longer than the original still changes layout once, when the wiper pass commits. During the pass the overlay is clipped to the original text rect, so neighbors do not move while the line is travelling.
- Playwright MCP launches its own browser and does not load this unpacked extension. Extension checks use Chrome for Testing plus `--load-extension`, then `chrome-devtools-mcp --browser-url`, or raw CDP. Branded Google Chrome ignores `--load-extension`.
- Cache byte sizes are the UTF-8 length of the translation plus the key length, not the exact IndexedDB footprint.
- One-click update (1.5.0) has not been run end to end against a real unpacked folder in Chrome. `showDirectoryPicker`, whether the directory permission survives a restart, and whether Chrome reloads the extension on the first changed file or only on `manifest.json` are unverified. Resume is the recovery if a write is interrupted. Files removed from a later zip are not deleted from the folder. 1.5.0 itself still has to be loaded unpacked by hand; the button exists only after that install. Headless `chrome.runtime.reload()` can unload the extension instead of applying the new files.
