# AGENTS.md

## Agent protocol

On resume, before any edit:

1. Read this file, then `docs/HANDOFF.md`, including **Current state / next steps**.
2. `git fetch origin develop`. Read `package.json` `version`. Run `gh release view <version> --repo Baegovda/BongDC`.
3. If GitHub, Playwright, or Context7 MCP is missing, install it from `docs/HANDOFF.md` → **Tooling / MCP**. Do not ask. Ask india 님 only for tokens.

Done means the release flow in `docs/HANDOFF.md`, unless this task says no version bump, no tag, or no release. An opt-out still needs a PR to `develop` and a rebase merge.

Before the PR merges: append §4 below, append one `docs/HANDOFF.md` history row, and replace **Current state / next steps**.

Report to india 님 in short casual Korean. Include only URLs a tool returned. Do not invent a URL.

Read this file first, then `docs/HANDOFF.md`. Do that before any edit, answer, or release.

`CLAUDE.md`, `.cursor/rules/handoff.mdc`, and `.github/copilot-instructions.md` only point here. Do not delete them. Do not add more policy files.

**This file plus `docs/HANDOFF.md` are the project instructions.** Session notes stay in §4 below. Continuation state (version, history, next step) stays in `docs/HANDOFF.md`. Update both at the end of every task.

WXT browser extension (Vue 3 + TypeScript + Bun) that enhances dcinside.com. Display name is exactly `BongDC`. Use `bun`.

---

## §1 AI Workflow (mandatory)

All work on this project is done by AI agents. Follow this checklist every session.

### 1.0 Facts first — no guessing (all responses)

**Never answer from assumption.** Investigate the repo, runtime, or user-provided evidence **before** stating how something works, what an icon/UI means, or what caused a bug.

**Required before claiming something as fact:**

1. **Read primary sources** — relevant source files, `package.json`, `wxt.config.ts`, built `.output/`, `AGENTS.md`, user screenshots (open/read image files when provided)
2. **Search the codebase** — grep/glob for symbols, config keys, icon paths, manifest fields
3. **Run checks when applicable** — terminal commands, build output, manifest contents (do not skip because the question seems simple)
4. **Label uncertainty** — if not verified, say **「추정」** or **「확인 필요」** and list what was / wasn't checked. Do **not** present guesses as facts.

**Forbidden:**

- Identifying UI elements (icons, tray apps, errors) by vague resemblance without checking this project or the user's context
- Citing files or APIs that were not confirmed to exist in this repo (grep first)
- Filling gaps with generic web-extension or tooling knowledge when project-specific evidence is available

**Good example:** User asks about a toolbar icon → read `src/assets/icon.png`, `.output/*/icons/*.png`, `manifest.json` → report it is this extension's icon and whether Chrome graying applies.

**Bad example:** Small gray "R" icon → guess AutoHotkey paused (wrong; it was DCRefresher's own icon).

### 1.1 Before work — explain the problem (bug/fix tasks)

Before editing code, explain to the user in **beginner-friendly** terms (3–5 sentences):

1. **Symptom** — what goes wrong from the user's perspective
2. **Cause** — why it happens (mark as hypothesis if unsure)
3. **Plan** — what will be changed (one line)

Skip for pure new features or refactors with no bug.

### 1.2 During work

- Match existing conventions (Korean UI/comments, `bun`, minimal diff)
- Verify changes:
  ```bash
  bunx wxt prepare
  bunx tsc --noEmit -p tsconfig.json
  # or: bun build
  ```
- Manual smoke test when behavior changes: `bun dev` → load extension → test on `gall.dcinside.com`
- **Do not** create other memo/log files. Append §4 below, and append the history plus replace **Current state / next steps** in `docs/HANDOFF.md`
- **User-facing changelog:** maintain `CHANGELOG.md` on every release ([Keep a Changelog](https://keepachangelog.com/) 형식, GGPK_Custom과 동일 — `CHANGELOG.md` + README 링크만)

### 1.3 After work — user report (fixed template)

Address the owner as **india 님**. Write the report in short plain Korean. The changelog voice is defined in `docs/HANDOFF.md`.

```markdown
## 작업 완료 보고

### 문제 (무엇이었나)
- (한두 문장, 쉬운 말)

### 해결 (어떻게 고쳤나)
- (한두 문장)

### 직접 확인해볼 것
- [ ] (구체적 테스트 단계 1)
- [ ] (구체적 테스트 단계 2)

### 버전 / 커밋 / 릴리스
- version: x.y.z → x.y.z+1
- commit: (해시 또는 메시지 요약)
- release: 없음 | tag x.y.z pushed
```

### 1.4 After work — AI session log

Append a structured entry to **§4 Session Log** (newest first). English/structured format OK — humans don't read it.

Also update `docs/HANDOFF.md`: append one history row and replace **Current state / next steps**. Do this in the same commit as the work, before the PR merges.

---

## §2 Version / Commit / Release

**Version source:** `package.json` `version` only (WXT manifest follows it). Current: `5.2.20`. Extension display name is `BongDC`. GitHub repo is `Baegovda/BongDC`.

| Change type | Examples | Version bump | Commit | Tag / Release |
|-------------|----------|--------------|--------|---------------|
| Small | bugfix, typo, style, docs-only | **patch +1** | required | **tag + Release** (see **Every work session**) |
| Feature / important | new module, new setting, behavior change | **minor +1** (patch → 0) | required | **tag + Release** |
| Breaking | storage key change, API removal | **major +1** | required | tag + Release + user approval |

**Every work session (default — always at task end)**

Follow **docs/HANDOFF.md → Standard release flow**. Do not stop at commit only. india 님 does not need to say `릴리즈` again.

Owner override wins. If the current task says no version bump, no tag, or no release, skip those steps. Still open a PR to `develop` and rebase-merge it.

Do **not** run `scripts/hide-old-releases.ps1`. Do **not** change the draft/published state of any existing release unless india 님 asks. Draft releases `5.2.6`–`5.2.12` stay Draft.

**Commit**

- Agent commits at end of work per this policy (no need for explicit user request)
- Message: one English line, why-focused
- Example: `fix(preview): prevent frame leak on rapid close`

**Release** — `docs/HANDOFF.md` → Standard release flow, unless the owner opted out for this task.

**Dev vs release build**

- Dev: `bun dev` — incremental hot-reload
- Release: `bun zip` — full Chrome + Firefox build

---

## §3 Project Reference

### Commands

- `bun install` — also runs `postinstall: wxt prepare` which generates `.wxt/`
- `bun dev` — Chrome dev (WXT dev server, auto-reload)
- `bun dev:firefox` — Firefox dev
- `bun build` — builds Chrome **and** Firefox into `.output/`
- `bun zip` — zips both targets (used by CI release)

`bun test` runs the unpacked-update unit tests. No lint or format script. Also verify edits by:
- `bunx wxt prepare` then `bunx tsc --noEmit -p tsconfig.json` (typecheck; requires `.wxt/` generated first)
- `bun build` (compiles both targets)

### Setup gotcha

`tsconfig.json` extends `.wxt/tsconfig.json`, which is **generated** by `wxt prepare` (gitignored). On a fresh clone, `bun install` triggers this via `postinstall`. If `.wxt/` is missing (e.g. after `git clean`), run `bunx wxt prepare` before anything type-checks.

### Auto-imports (do not add explicit imports for these)

WXT auto-imports globals declared in `.wxt/types/imports.d.ts` (generated, gitignored). Auto-import dirs: `components`, `composables`, `hooks`, `utils`, `storage`, `http`. Notably:
- WXT APIs: `defineBackground`, `defineContentScript`, `defineUnlistedScript`, `defineWxtPlugin`, `browser`, `storage`, `createIntegratedUi`, `createShadowRootUi`, `createIframeUi`, `defineAppConfig`
- Vue APIs: `ref`, `computed`, `reactive`, `watch`, `createApp`, `defineComponent`, `nextTick`, ...
- From auto-import dirs: `blockStorage`, `blockModeStorage`, `memoStorage`, `moduleEnableStorage`, `moduleDataStorage`, `moduleSettingStorage`, `databaseStorage` (from `src/storage/wxtStorage.ts`), `client`, http helpers (from `src/http/`), `User`, `toast` (from `src/utils/`), `useRelativeTime` (from `src/composables/`)

**Note:** Content-specific code under `src/entrypoints/content/` is NOT auto-imported. The preview module uses explicit imports (`makeBodyFrame`, `makeCommentFrame`, `previewRequest`, `panel`, `blockPreset`, `closeAllPopups`, `createMiniPreview`, `miniPreview*`, `getRelevantData`, `PostCache`, `ScrollDetection`, `queryString`). `useDcconPopup` and `useMeDetection` are also explicitly imported.

If unsure whether a symbol is auto-imported, grep `.wxt/types/imports.d.ts`. Redundant explicit imports can cause conflicts.

Global types (`RefresherModule`, `RefresherSettings`, `RefresherBlockType`, `RefresherMemoType`, `RefresherEventMap`, ...) are declared `global` in `src/@types/*.ts` — no import needed.

Path aliases: `@/` and `~/` → `src/`; `@@/` and `~~/` → project root.

### Architecture

**Entrypoints** (`src/entrypoints/`):
- `background.ts` — service worker; context menus, commands, Korean /16 ISP table bundled in `src/data/ip-isp.json` (refreshed from GitHub `develop` when newer). The old ban-list host `https://dcrefresher.green1052.com/data` returns 404 and is no longer fetched; stored `database:ban` is left as-is. Storage migration
- `content/index.ts` — content script on `https://*.dcinside.com/*` (excludes event/h5/m/mall/wiki/gallog), `document_start`
- `grecaptcha.content.ts` — `world: "MAIN"`, reCAPTCHA token bridge
- `popup/` — extension popup settings UI
- `options/` — full-page settings (reuses popup components)
- `update/` — Chrome unpacked in-place update page. Firefox build only tells the user to install the zip by hand.

**Module system** (main extension mechanism):

`content/index.ts` auto-loads via `import.meta.glob`:
- `./modules/*/index.ts` (folder form)
- `./modules/*.ts` (flat form)

Each **default export** registers as `RefresherModule` through `src/core/modules.ts`. Interface: `src/@types/module.ts`. After load, `filter.run()` applies registered filters.

**Content modules (11 total)**

| Module | `default_enable` | URL scope | Role |
|--------|------------------|-----------|------|
| 글 목록 새로고침 (`refresh/`) | yes | `/board/(view\|lists)` | AJAX list refresh, in-page paging, Alt+R/S |
| 컨텐츠 차단 (`block/`) | yes | same | Block nick/ID/IP/title/text/comment/dccon/tab |
| 미리보기 (`preview/`) | yes | same | Right-click preview, tooltip, admin panel, comments |
| 유저 정보 (`userinfo.ts`) | yes | same | UID, IP ISP, memo display |
| 레이아웃 수정 (`layout.ts`) | yes | all | Compact mode, hide sidebars/notices |
| 폰트 교체 (`fonts.ts`) | yes | all | Dynamic font-family/size CSS |
| 이미지 검색 (`imagesearch.ts`) | yes | all | SauceNao context menu |
| 관리 (`manage/`) | no | `/board/(view\|lists)` | Ratio, perm-ban, shift/ctrl bulk check, ctrl delete |
| 스텔스 모드 (`stealth.ts`) | no | all | Hide images, Alt+P toggle |
| 글쓰기 (`write.ts`) | no | `/board/(write\|modify)` | Header/footer HTML, title limit bypass |

**Storage** (`src/storage/`):
- `wxtStorage.ts` — WXT `storage.defineItem` typed items; keys like `local:refresher:block:{TYPE}`, `local:refresher:memo:{TYPE}`, `local:refresher:module:{NAME}:enable|data|setting:{KEY}`, `local:refresher:database:*`
- `migration.ts` — migrates legacy keys (`__REFRESHER_*`, `NAME.enable`, `refresher.module:*`); runs in background + content on load

**Messaging / events** — use the right one:
- `src/http/messaging.ts` — `@webext-core/messaging` typed **background ↔ content** (`sendMessage`/`onMessage`, `ProtocolMap`)
- `src/core/eventbus.ts` — in-content pub/sub (`eventBus.on`/`emit`/`emitNextTick`); see `RefresherEventMap` in `src/@types/core.ts`

**Core files** (`src/core/`):
- `modules.ts` — register/load modules, popup message handlers
- `filtering.ts` — DOM filter engine (`MutationObserver`)
- `settings.ts` — per-module settings store
- `block.ts` — block list cache + `check()`/`add()`
- `memo.ts` — memo cache + `get()`/`add()`/`remove()`

**Shared UI** (`src/components/`): countdown, dccon, loader, previewButton, timestamp, toast, user. Preview SFCs live under `preview/components/`. SCSS: `src/assets/styles/index.scss` imported by `content/index.ts`.

### Directory structure

```
src/
├── @types/         # global type declarations (no imports needed)
├── assets/         # icons (icons/*.webp), styles
├── components/     # shared Vue SFCs (7 files)
├── composables/    # useRelativeTime.ts (shared)
├── core/           # block, eventbus, filtering, memo, modules, settings
├── entrypoints/
│   ├── background.ts
│   ├── grecaptcha.content.ts
│   ├── popup/      # settings UI + composables + tabs
│   ├── options/    # reuses popup
│   ├── update/     # Chrome unpacked updater (update.html)
│   └── content/
│       ├── index.ts
│       ├── composables/  # useDcconPopup, useMeDetection
│       └── modules/      # 11 feature modules
├── http/           # http.ts (URLs), httpClient.ts (ky), messaging.ts
├── storage/        # wxtStorage.ts, migration.ts
└── utils/          # ban, comment, ip, memoAsk, toast, user, userDataInsert, types
```

### Manifest

Defined in `wxt.config.ts` (no static `manifest.json`). Permissions, `host_permissions` (`https://*.dcinside.com/*`), commands (Alt+R / Alt+S / Alt+P), `web_accessible_resources`, `browser_specific_settings`. `@wxt-dev/auto-icons` from `src/assets/icon.png`.

### Gitignored local files

`.env`, `.wxt/`, `.output/`, `web-ext.config.ts` — never commit `web-ext.config.ts` (machine-specific Chrome paths).

### Release (CI)

Tag push matching `*.*.*` → `.github/workflows/build.yml`: `bun test`, the tag must equal `package.json` `version`, `bun zip`, `scripts/verify-release-zip.ts` (manifest version, every file the manifest references, `update.html` and the files it loads), `scripts/extract-changelog.ts` for the release notes, then `gh release create` attaches `bongdc-<ver>-chrome.zip` and `bongdc-<ver>-firefox.zip`. `wxt submit` stays `continue-on-error`. Bump `package.json` version before tagging.

### Conventions

- UI text and code comments are in Korean — preserve this.
- Renovate config extends `github>green1052/renovate-config`.

---

## §4 Session Log

<!-- AI: newest first. humans don't read this. -->

### [2026-10-30] unpacked update | type: feature | release: no

- **task**: port BongChzzk one-click unpacked updates onto BongDC without a version bump
- **kept**: package.json stays 5.2.20; no tag; no release edit; draft flags untouched. Existing daily check, badge, notification, and zip download stay. Firefox has no showDirectoryPicker, so 지금 업데이트 is hidden and update.html only explains the zip install.
- **added**: src/core/update (zip reader, write plan, release check), src/entrypoints/update, popup 지금 업데이트, host_permissions for github release hosts, scripts/extract-changelog.ts, scripts/verify-release-zip.ts, workflow test + version match + zip verify + changelog notes + gh release create
- **write order**: update.html and the chunks it imports, then other files in batches of 6, manifest.json alone last. Pending zip bytes go to IndexedDB `bongdc`/`pending` before the first write. Resume if pending version is newer than the running manifest. Same bytes are not written again.
- **verify**: bun test 26 pass. tsc only pre-existing .vue shim errors (8). bun zip produced bongdc-5.2.20-chrome.zip and bongdc-5.2.20-firefox.zip. verify-release-zip.ts passed on both. Real chrome zip simulation: stopping before any non-update file wrote only update.html, chunks/update-*.js, chunks/release-*.js; stopping before manifest.json left it unwritten after the other 31 files; resume wrote manifest.json last and skipped identical bytes. Firefox update chunk has no showDirectoryPicker and tells the user to use the zip. Chrome popup bundle contains 지금 업데이트; Firefox popup bundle does not contain showDirectoryPicker.
- **pr**: https://github.com/Baegovda/BongDC/pull/16
- **not verified**: a live Chrome directory-picker run that reloads the extension mid-write. The write-order tests cover that sequence in memory.

### [2026-10-30] v5.2.20 | type: patch | release: 5.2.20

- **task**: gallery list refresh `TimeoutError` showed as an uncaught promise on `chrome://extensions`
- **root_cause**: `refresh/load.ts` `client.get(http.view(location))` uses ky. Timeout is `delay - 100` (refresh interval, default about 5.5–7s, minimum about 3.4s), shorter than ky's 10s default. The await has no catch. `scheduleNextRefresh`, `refreshLists`, and `refreshRequest` call `load()` without awaiting, so ky's `TimeoutError: Request timed out: GET https://gall.dcinside.com/mgallery/board/lists?id=…` is an unhandled rejection. That URL is only built by `http.view` (drops the slash before `?`).
- **fix**: treat ky `TimeoutError`, `HTTPError`, and `NetworkError` as a quiet failure (keep the current list, return false, no `console.error`). The existing scheduler retries next interval. Request timeout is at least ky's 10s so a slow list can finish; the loading flag still blocks overlap. A longer refresh interval still aborts at `delay - 100`.
- **files**: src/entrypoints/content/modules/refresh/load.ts, package.json, README.md, CHANGELOG.md, AGENTS.md, docs/HANDOFF.md
- **pr**: https://github.com/Baegovda/BongDC/pull/14
- **release**: https://github.com/Baegovda/BongDC/releases/tag/5.2.20 — chrome https://github.com/Baegovda/BongDC/releases/download/5.2.20/bongdc-5.2.20-chrome.zip — firefox https://github.com/Baegovda/BongDC/releases/download/5.2.20/bongdc-5.2.20-firefox.zip. Store submit exited 1 (missing store secrets); job succeeded and both zips are on the release. Drafts 5.2.5–5.2.12 stayed Draft.
- **verify**: bun script of createLoadFunction (timeout/http/network resolve false and do not unhandle; generic Error still rejects; requested URL matches the report; timeout floor 10000 and delay-100 when longer). Real ky hang through createLoadFunction resolves false with no unhandled rejection. tsc only pre-existing .vue shim errors. bun zip names bongdc-5.2.20-chrome.zip and bongdc-5.2.20-firefox.zip. Chrome for Testing 156 loaded .output/chrome-mv3, fulfilled a lists page, and left the refresh GET hanging: two XHRs to `https://gall.dcinside.com/mgallery/board/lists?id=3dprinting`, list text stayed, refresh button stayed 켜짐, and the page logged no TimeoutError and no uncaught exception.

### [2026-10-26] handoff bootstrap | type: docs | release: no

- **task**: MCP configs and bootstrap so a fresh agent can install tooling from the repo URL alone
- **files**: AGENTS.md Agent protocol, docs/HANDOFF.md Tooling / MCP, .cursor/mcp.json, .mcp.json, .vscode/mcp.json, scripts/bootstrap.sh, scripts/bootstrap.ps1
- **kept**: package.json stays 5.2.19; no tag; no release edit; no real tokens
- **pr**: https://github.com/Baegovda/BongDC/pull/13
- **verify**: python json.loads on .cursor/mcp.json, .mcp.json, .vscode/mcp.json; bash scripts/bootstrap.sh exit 0; zips .output/bongdc-5.2.19-chrome.zip and bongdc-5.2.19-firefox.zip; package.json still 5.2.19; token line printed MISS and did not print a value

### [2026-10-25] v5.2.19 | type: patch | release: 5.2.19

- **task**: point the fork at the renamed repo Baegovda/BongDC
- **files**: updateCheck.ts GITHUB_RELEASE_REPO, ipIsp.ts IP_ISP_REPO, package.json homepage/repository/bugs, README, GeneralTab GitHub link, CHANGELOG header and footer links, AGENTS.md, docs/HANDOFF.md, pointer files, scripts
- **kept**: historical CHANGELOG version bodies; green1052/DCRefresher-Reborn upstream credit; 도움말 https://dcrefresher.green1052.com
- **pr**: https://github.com/Baegovda/BongDC/pull/12
- **verify**: gh repo view Baegovda/BongDC; origin URL path is Baegovda/BongDC; bun zip; background startup fetch host

### [2026-10-25] handoff kit | type: docs | release: no

- **task**: add an agent handoff kit so a fresh agent with only the repo URL can continue
- **files**: AGENTS.md, docs/HANDOFF.md, CLAUDE.md, .cursor/rules/handoff.mdc, .github/copilot-instructions.md
- **kept**: package.json stays 5.2.18; no tag; no release edit; draft flags untouched
- **pr**: https://github.com/Baegovda/BongDC/pull/11
- **rule**: AGENTS.md is the entry point. Pointers only say to read AGENTS.md and docs/HANDOFF.md. Every later task appends HANDOFF history and replaces Current state / next steps.

### [2026-10-25] v5.2.18 | type: patch | release: 5.2.18

- **task**: stop popup schema errors (`No response`, unchecked `Receiving end does not exist`); rename display name to BongDC
- **root_cause**: `@webext-core/messaging` `chrome.tabs.sendMessage` omits `frameId` and never reads `runtime.lastError`. DCInside iframes have no content script, so the callback resolves `undefined` (`Error: No response`) and Chrome logs unchecked lastError. `useSettings` `console.error` on the last retry is the extensions error page entry.
- **fix**: tab messages use `frameId: 0` and check lastError; retry then fall back to `local:refresher:module:schema` (content writes it, background `getSchema` returns it). Missing-receiver failures are not logged. Display name/zip `bongdc-*-chrome.zip`. Update checker repo stays `Baegovda/BongDC`.
- **files**: messaging.ts, modules.ts, background.ts, useSettings.ts, wxtStorage.ts, package.json, wxt.config.ts, popup/options, GeneralTab, fonts.ts, updateCheck.ts, README, CHANGELOG, AGENTS.md
- **verify**: bun mock of sendToContentTab (frameId 0, lastError read, no-receiver reject, schema response). tsc changed files clean; only pre-existing .vue shim errors. bun zip names `bongdc-5.2.18-chrome.zip` / `bongdc-5.2.18-firefox.zip`. manifest name BongDC 5.2.18. chrome and firefox background.js load with no throw and no console.error; startup still fetches `Baegovda/BongDC`. Chrome for Testing 156 on live `gall.dcinside.com` (page has recaptcha and ad iframes): popup reload showed BongDC v5.2.18 and module settings, and logged none of `No response`, `Receiving end does not exist`, `Failed to load module schema`, or `Unchecked runtime.lastError`.

### [2026-10-25] changelog voice | type: docs | release: no

- **task**: rewrite CHANGELOG 5.2.10–5.2.17 in owner casual 반말; copy the same text onto published GitHub release bodies 5.2.13–5.2.17
- **files**: CHANGELOG.md
- **kept**: 5.2.9 and older wording; package.json stays 5.2.17; do not flip draft/published on any release
- **verify**: release list before/after `gh release edit --notes-file` (no --draft, no --latest)

### [2026-10-25] v5.2.17 | type: patch | release: 5.2.17

- **task**: drop the SuckBong Edition suffix so the extension name is exactly DCRefresher-SuckBong
- **files**: package.json displayName, wxt.config.ts manifest name, popup/options titles, GeneralTab.vue h3, README heading and badge, CHANGELOG header, AGENTS.md
- **kept**: historical changelog line that records the old 5.1.x branding string, and older session-log quotes of that past title
- **verify**: `bun run build`. manifest name exactly `DCRefresher-SuckBong`, version 5.2.17. Popup html and settings chunk have that name and not `SuckBong Edition`. Chrome and firefox background.js load with no throw and no console.error.
- **tag**: 5.2.17

### [2026-10-25] v5.2.16 | type: patch | release: 5.2.16

- **task**: rename the fork from DCRefresher-Reborn to DCRefresher-SuckBong
- **files**: package.json, wxt.config.ts, popup/options html, GeneralTab.vue, fonts.ts, updateCheck.ts, ipIsp.ts, generate-ip-isp.ts, hide-old-releases.ps1, README.md, CHANGELOG.md header and Baegovda release links, AGENTS.md
- **kept**: green1052/DCRefresher-Reborn upstream links and README credit; changelog prose including the 5.1.x edition-name line; plain "DCRefresher" upstream site credit and notification title "DCRefresher 업데이트"; dcrefresher.green1052.com host
- **assets**: package name `dcrefresher-suckbong` so zips are `dcrefresher-suckbong-*-chrome.zip`. `findAssetUrl` still matches `-${browser}.zip`
- **repo constant**: `Baegovda/BongDC` for releases and ip-isp.json
- **verify**: `bun run build`. manifest name `DCRefresher-SuckBong: SuckBong Edition`, version 5.2.16. Chrome and firefox background.js load in the chrome stub with no throw and no console.error. Startup fetches `Baegovda/BongDC` contents and releases/latest. Bundle asset match is `name.endsWith(`-${browser}.zip`)`.
- **tag**: 5.2.16

### [2026-10-25] v5.2.15 | type: patch | release: 5.2.15

- **task**: stop the dead ban-list host from logging a service worker error
- **evidence**: curl to `/data/version` and `/data/ban.json` got Cloudflare 403 challenge HTML. Chrome for Testing 156 `fetch` of those URLs and `/` returned HTTP 404 with an empty body. Matches the reported `HTTPError 404 GET https://dcrefresher.green1052.com/data/version`.
- **files**: src/entrypoints/background.ts, src/utils/ipIsp.ts, src/storage/wxtStorage.ts, CHANGELOG.md, README.md, package.json, AGENTS.md
- **other host uses**: no content-script or ky/fetch calls remain. User clicks only: GeneralTab 도움말 `https://dcrefresher.green1052.com`, MemoTab 메모 변환 `/utils/convert-memo`. Those open a tab and do not `console.error`. package.json homepage and README are docs.
- **fix**: removed ban `/version` + `/ban.json` fetch. `database:ban` is still read by ban.ts and preserved on cloud restore. IP refresh stays on GitHub (`fetchRemoteIpIsp`), interval via new `database:ipCheckedAt` so it does not overwrite the backup timestamp `lastUpdate`. HTTP failure returns null; network throw is swallowed with no `console.error`.
- **verify**: `bun run build`, manifest 5.2.15. Node vm of chrome and firefox background with chrome stubs: no throw, no console.error. Fetch stubbed to 404: only GitHub contents `src/data/ip-isp.json` and `releases/latest`. Fetch throwing `Failed to fetch`: still no console.error. Bundles do not contain `dcrefresher.green1052.com` or `차단 데이터베이스`. Content script neither.
- **tag**: 5.2.15

### [2026-10-25] v5.2.14 | type: feature | release: 5.2.14

- **task**: button to the right of 업데이트 확인 that opens the extension management page
- **files**: src/entrypoints/popup/tabs/GeneralTab.vue, src/entrypoints/background.ts, src/http/messaging.ts, CHANGELOG.md, README.md, package.json, AGENTS.md
- **cause**: `<a href="chrome://extensions">` is blocked. Chromium extensions WebUI reads `?id=` and opens that extension's details page (`navigation_helper.ts` `Page.DETAILS`). This repo already opens `chrome://extensions` and `chrome://extensions/shortcuts` with `browser.tabs.create` from the popup (ShortcutTab, install hint). Same API from the MV3 service worker. Firefox: `about:addons`, same as ShortcutTab.
- **fix**: popup sends `openExtensionsPage`. Background `tabs.create` uses `chrome://extensions/?id=${runtime.id}`, and if that throws falls back to `chrome://extensions`. Firefox opens `about:addons` and returns an error string instead of throwing. Button uses the same default popup button style as 업데이트 확인 and sits immediately to its right. Options page reuses GeneralTab.
- **verify**: `bun run build` (manifest 5.2.14). tsc only pre-existing .vue shim errors. Node vm loaded chrome and firefox background.js with chrome stubs: no throw, listeners registered. Handler opened `chrome://extensions/?id=dcrefresher-suckbong-test` on the chrome bundle and `about:addons` on the firefox bundle. Chrome for Testing 156 loaded `.output/chrome-mv3`; service worker stayed up. Clicking 확장 프로그램 관리 in popup.html opened `chrome://extensions/?id=gmdocpafaflokccakjmakkfdmeaohmod` on the details view for this extension. Button order in the actions row: 업데이트 확인, 확장 프로그램 관리. No test runner in the repo.
- **tag**: 5.2.14

### [2026-10-25] v5.2.13 | type: patch | release: 5.2.13

- **task**: hotfix background service worker crash on startup in 5.2.12 (`T is not a function`, registration status 15)
- **files**: src/utils/ipIsp.ts, src/utils/ip.ts, wxt.config.ts, CHANGELOG.md, README.md, package.json, AGENTS.md
- **root_cause**: unimport's default regex scanner treated the arrow parameter `ip` in `ipIsp.ts` as a free reference to the auto-import default export of `utils/ip.ts` and injected `import ip from './ip'`. That cycle is `ipIsp → ip → ipIsp`. Rolldown evaluates the in-progress module's dependency first, so the background entry (which imports `ipIsp`) ran `ip.ts` top-level `isIpIspDatabase(bundledJson)` before the `const` arrow was assigned. Content imported `ip.ts` first, so it initialized `ipIsp` fully and did not crash. Minified binding was `var T = e => ...` after `Ae = T(ke) ? ke : ...`.
- **fix**: `imports.parser: "oxc"` so scoped names are not auto-imported (cycle gone; ISP JSON no longer pulled into the service worker). `isIpIspDatabase` is a function declaration. Bundled DB is read on first lookup, not while the module graph is evaluating. updateCheck/semver/messaging/wxtStorage have no other top-level calls of later bindings.
- **verify**: `bun run build`. Node vm loaded `.output/chrome-mv3/background.js` and firefox background with chrome stubs (runtime.id, getManifest, onInstalled, onStartup, onMessage, storage.local get/set/remove/onChanged, alarms, contextMenus, commands, notifications, action, tabs, downloads). Fixed build registered listeners and did not throw. 5.2.12 background threw `TypeError: T is not a function` at background.js:5. Content script passed the IP init and later failed only on a missing `document.dispatchEvent` stub. tsc: pre-existing .vue shim errors only. No test runner in the repo.
- **tag**: 5.2.13

### [2026-10-25] v5.2.12 | type: feature | release: 5.2.12

- **task**: rebuild KR /16 ISP labels from redistributable public data
- **files**: scripts/generate-ip-isp.ts, src/data/ip-isp.json, src/data/ip-isp.meta.json, src/utils/ip.ts, src/utils/ipIsp.ts, src/utils/user.ts, src/components/user.vue, userinfo.ts, content/index.ts, background.ts, wxtStorage.ts, .github/workflows/ip-isp.yml, CHANGELOG.md
- **previous**: background fetched `https://dcrefresher.green1052.com/data/ip.json` every 7 days into `local:refresher:database:ip` as `Record<a.b, comma-separated org string>`. Exact key match on `dataset.ip` (first two octets). Display `[whole string]` in #6495ed. Archived 2025-06-26 file: 3135 keys, often VPN tag plus every tenant. Docs say source was DC-Modtools. No generator in this repo.
- **sources**: APNIC delegated-apnic-latest (free use, no accuracy warranty); IPtoASN ip2asn-v4 PDDL-1.0 (RouteViews BGP, CC BY 4.0). Not used: KISA WHOIS (no bulk redistribution grant), RIPEstat (no third-party reproduction), CAIDA pfx2as (AUA).
- **method**: Korea-relevant /16 = ≥50% APNIC KR allocation or IPtoASN country KR. Share = announced addresses / 65536. Clear name if ≥80%, or major ISP ≥50% with 15pt lead, or other org ≥70% with 15pt lead. Else `혼합`. Display adds `?` under 80%. Major: KT, SK브로드밴드, LG U+, LG U+ 모바일, SKT 모바일, LG헬로비전, 딜라이브, 세종텔레콤, 드림라인, SK텔링크.
- **stats** (APNIC 20261025, IPtoASN 2026-10-24): 1667 /16s, 111KB. high 1418 (85.1%), low 54, mixed 195. KR delegated address share: labeled 95.1%, high 82.6%, low 2.8%, mixed 9.7%. Vs archived ip.json: overlap 1666, same canonical 1342, different specific 130, became 혼합 194, dropped 1469 (950 VPN-only), multi-org strings now a single ISP 711, added 1.
- **limits**: /16 is not a person; VPN/CGNAT unlabeled; KT mobile and wired share AS4766 so label stays KT (kind unknown); some LG U+ mobile is inside backbone ASNs.
- **display**: nickname insertion from 5.2.10 unchanged. Badge text stays short (`[KT]`, `[KT?]`, `[혼합]`, `[SKT 모바일]`).
- **verify**: generator sanity (39.7 KT, 223.38 SKT 모바일, 211.234 혼합, small-org share ≥70); tsc only pre-existing .vue shim errors; bun run build. Headless Chrome with live comment CSS: old long label inside .nickname em width 0; [KT] and [LG U+ 모바일?] after .nickname em width 26px; list [KT] em width 26px
- **tag**: 5.2.12

### [2026-10-25] v5.2.11 | type: feature | release: 5.2.11

- **task**: unpacked-install update check (manual download, not silent replace)
- **files**: src/core/semver.ts, src/core/updateCheck.ts, src/storage/wxtStorage.ts, src/http/messaging.ts, src/entrypoints/background.ts, src/entrypoints/popup/composables/useUpdate.ts, src/entrypoints/popup/tabs/GeneralTab.vue, CHANGELOG.md, package.json
- **fix**: semver compare vs manifest; release notes; chrome/firefox zip; daily auto-check toggle (default on) with badge + notification; rate-limit/network errors
- **verify**: semver cases; tsc (changed files clean; pre-existing vue shim errors); bun run build; Chrome options page against live 5.2.10 release (badge, notification, 1440m alarm, chrome zip download, auto-check toggle)
- **tag**: 5.2.11

### [2026-10-24] v5.2.10 | type: patch | release: PR

- **task**: comment nicknames hidden when IP/ISP badge is injected
- **files**: userinfo.ts, userDataInsert.ts, _comment.scss, CHANGELOG.md, package.json
- **root_cause**: anonymous comment markup is `<span class="nickname"><em>nick</em><span class="ip">(ip)</span></span>`. `.comment_box .addbox .nickname` is inline-flex + overflow:hidden and `em` can shrink. `querySelector(".addbox .ip")` matches that nested `.ip` (ancestor `.addbox`), so the ISP span was appended inside `.nickname`. The em flex-shrinks to width 0. List writers keep `.ip` as a sibling of `.nickname` and were unaffected.
- **fix**: `insertAfterNicknameWhenIpNested` places ISP/memo after `.nickname` when `.ip` is nested; comment `em` is `flex-shrink: 0`
- **verify**: headless Chrome on live comment HTML + site CSS. bug em width 0; after-nickname placement em width 24px, ISP still overlaps the 152px nick box (~78px). list nick width stayed 32px
- **tag**: none (PR)

### [2026-07-26] v5.2.9 | type: docs | release: 5.2.9

- **task**: changelog GGPK_Custom 방식으로 통일, HTML 페이지 제거
- **files**: CHANGELOG.md, README.md, AGENTS.md (docs/changelog.html 삭제)
- **fix**: Keep a Changelog 형식, README 상단 CHANGELOG·Releases 링크
- **tag**: 5.2.9

### [2026-07-26] v5.2.8 | type: docs | release: 5.2.8

- **task**: 업데이트 로그 체계화 (CHANGELOG.md, docs/changelog.html, README 링크)
- **files**: CHANGELOG.md, docs/changelog.html, README.md, AGENTS.md
- **fix**: 릴리즈마다 CHANGELOG + HTML 페이지 갱신 정책 추가
- **tag**: 5.2.8

### [2026-07-26] v5.2.7 | type: patch | release: 5.2.7

- **task**: 설정 팝업 최대 높이 제한 제거
- **files**: usePopupResize.ts
- **fix**: 720px 상한 제거, 최소 360px만 유지
- **tag**: 5.2.7

### [2026-07-26] v5.2.6 | type: patch | release: 5.2.6

- **task**: 고급 탭 설정 표시 + 설정 팝업 세로 리사이즈
- **files**: preview/layout/manage/refresh/block/fonts/userinfo modules (`advanced: true`), AdvancedTab.vue, App.vue, PopupResizeHandle.vue, usePopupResize.ts, popup.scss, wxtStorage.ts
- **fix**: 고급 탭에 미리보기·레이아웃·관리 등 세부 옵션 분리; 팝업 하단 드래그로 높이 조절(360–720px, 저장)
- **tag**: 5.2.6

### [2026-07-26] v5.2.5 | type: patch | release: 5.2.5

- **task**: fix settings/modules not loading while on dcinside (mgallery etc.)
- **files**: dcinsideTab.ts, useSettings.ts, modules.ts, content/index.ts, ModuleTab.vue, GeneralTab.vue, AdvancedTab.vue, wxt.config.ts
- **fix**: active-tab + valid URL matching; getSchema retry; modulesReady gate; tabs permission
- **tag**: 5.2.5

### [2026-07-26] v5.2.4 | type: patch | release: 5.2.4

- **task**: hide all GitHub releases except latest (draft); automate via script + policy
- **files**: scripts/hide-old-releases.ps1, AGENTS.md, package.json
- **fix**: older releases → Draft (public sees only Latest); step 7 in release flow
- **tag**: 5.2.4

### [2026-07-26] v5.2.3 | type: patch | release: 5.2.3

- **task**: update button opens chrome://extensions after zip download; policy = always release at task end
- **files**: updateCheck.ts, useUpdate.ts, AGENTS.md, package.json
- **fix**: applyExtensionUpdate tabs.create → chrome://extensions/; **Every work session** now mandates backup/release/push always
- **tag**: 5.2.3

### [2026-07-26] v5.2.1 | type: docs | release: no

- **task**: document user-mandated release policy in AGENTS.md
- **files**: AGENTS.md
- **root_cause**: user asked for release every time; agent sometimes stopped at commit/push; policy still said "small work = no release"
- **fix**: added **User release request** override (릴리즈/릴리즈백업푸시 → full zip + tag + GitHub Release); CI fallback via `gh release`; current version → 5.2.1
- **verify**: grep AGENTS.md for "User release request"
- **commit**: pending
- **tag**: none

### [2026-07-26] v5.1.7 | type: patch | release: no

- **task**: redesign Block tab layout (sidebar categories, list view, search)
- **files**: BlockTab.vue, BlockListItem.vue, useBlocks.ts, popup.scss, package.json, AGENTS.md
- **root_cause**: user request for intuitive/systematic block settings UI
- **fix**: two-column layout with grouped nav, per-type mode control, search, row-based list items
- **verify**: pending
- **commit**: pending
- **tag**: none

### [2026-07-26] v5.1.6 | type: patch | release: no

- **task**: remove sponsor/gallery/discord links; point GitHub to Baegovda repo; rewrite README
- **files**: GeneralTab.vue, README.md, package.json, AGENTS.md
- **root_cause**: user fork branding; upstream community links not wanted
- **fix**: links trimmed to GitHub + 도움말; README rewritten for Baegovda/BongDC
- **verify**: pending
- **commit**: pending
- **tag**: none

### [2026-07-26] v5.1.5 | type: patch | release: no

- **task**: remember last popup tab when reopening extension UI
- **files**: wxtStorage.ts, usePopupTab.ts, popup/App.vue, options/App.vue, package.json, AGENTS.md
- **root_cause**: popup always initialized tab to 0 (일반)
- **fix**: persist last tab id in local storage; restore on open via usePopupTab composable
- **verify**: pending
- **commit**: 87031c4
- **tag**: none

### [2026-07-26] v5.1.4 | type: patch | release: no

- **task**: fix COMMENT block not persisting after page refresh / mode toggle
- **files**: core/block.ts, block/index.ts, package.json, AGENTS.md
- **root_cause**: block cache loaded async but filters ran before ready; rerun only hid elements without reset on mode/list change
- **fix**: export blockReady promise; await before registering filters; reset data-refresher-blocked then re-apply; debounced rerun on refresh + comment DOM observer
- **verify**: pending
- **commit**: 91b5523
- **tag**: none

### [2026-07-26] v5.1.3 | type: patch | release: no

- **task**: fix COMMENT block not working on dcinside comments
- **files**: block/index.ts, preview/commentFrame.ts, package.json, AGENTS.md
- **root_cause**: comment text read only inside .cmt_info ancestor of .ub-writer (sibling layout); no re-apply on block list change; preview compared raw HTML memo
- **fix**: resolve comment via li.ub-content; dedicated .usertxt filter; refresh event re-run; plainCommentText in preview
- **verify**: pending
- **commit**: 6c6eda4
- **tag**: none

### [2026-07-26] v5.1.2 | type: docs | release: no

- **task**: add §1.0 facts-first policy (no guessing; investigate before answering)
- **files**: AGENTS.md
- **root_cause**: agent misidentified extension icon as unrelated app
- **fix**: mandatory investigate/read/run/search rules + good/bad example
- **verify**: n/a
- **commit**: e4276b3
- **tag**: none

### [2026-07-26] v5.1.2 | type: patch | release: no

- **task**: bump version + SuckBong Edition branding
- **files**: package.json, wxt.config.ts, popup/index.html, options/index.html, GeneralTab.vue, AGENTS.md
- **root_cause**: user request custom edition name
- **fix**: displayName/manifest/UI title → "DCRefresher-SuckBong: SuckBong Edition", version 5.1.1→5.1.2
- **verify**: pending
- **commit**: pending
- **tag**: none

### [2026-07-26] v5.1.1 | type: docs | release: no

- **task**: bootstrap unified AI agent policy in AGENTS.md (§1–§4)
- **files**: AGENTS.md
- **root_cause**: n/a (policy init)
- **fix**: added workflow, version/commit/release rules, updated project reference (removed stale webStorage/communicate/data module docs), session log section
- **verify**: n/a (docs only)
- **commit**: 024d13a
- **tag**: none
