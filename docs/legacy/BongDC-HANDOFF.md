# 옛 BongDC 인수인계 (지금은 쓰지 않음)

> 이 파일은 2026-10-26 당시 **BongDC** 저장소(`Baegovda/BongDC`) 기록입니다. **BongExtend의 현재 안내가 아닙니다.**
> 지금 작업할 때는 루트의 `AGENTS.md`와 `MERGE_NOTES.md`만 따르세요. 아래의 `docs/HANDOFF.md`, 버전 5.2.x, `develop` 브랜치, 통신사 표를 `Baegovda/BongDC`에서 받는 내용은 당시 기록이라 고치지 않습니다.

---

# HANDOFF

Agent-to-agent continuation for this repo. Read `AGENTS.md` first, then this file. Facts below were checked against the tree and GitHub on 2026-10-26. Re-check anything you are about to change. If a command was not run, say **확인 필요**. Do not guess.

Address the owner as **india 님**. Reply in short plain Korean.

---

## Project identity

- Display name is exactly `BongDC`. Manifest `name`, popup `<title>`, options `<title>`, settings `<h3>`, and `package.json` `displayName` must match. Never add a suffix such as `Edition`.
- Package name is `bongdc`. WXT zip names come from that field: `bongdc-<ver>-chrome.zip` and `bongdc-<ver>-firefox.zip` under `.output/`.
- Repo is `Baegovda/BongDC` (`https://github.com/Baegovda/BongDC`). india 님 renamed it in GitHub settings on 2026-10-25. It was `Baegovda/DCRefresher-SuckBong`, and before that `Baegovda/DCRefresher-Reborn`. Both old URLs redirect. `origin` must be `Baegovda/BongDC`. Do not rename the repo again unless india 님 asks.
- Update checker constant `GITHUB_RELEASE_REPO` is `Baegovda/BongDC`. It is defined in `src/core/update/release.ts` and re-exported from `src/core/updateCheck.ts`. ISP table fetch uses the same repo (`IP_ISP_REPO` in `src/utils/ipIsp.ts`, ref `develop`, path `src/data/ip-isp.json`). Do not point those at another repo when the display name changes.
- Asset match is `item.name.endsWith(`-${browser}.zip`)`. A package-name change still matches. Fallback download filename is `bongdc-${latestVersion}-${browser}.zip`.
- Upstream credit stays `green1052/DCRefresher-Reborn`. Human links that stay: GitHub repo URL, 도움말 `https://dcrefresher.green1052.com`. Those are not the extension name.
- Current product version is `package.json` `version`. The 5.2.19 change set it to `5.2.19`. WXT copies it into the manifest. Do not hardcode a second version. Re-read `package.json` before trusting this sentence.

## Owner profile

india 님 writes very short casual Korean 반말. Chat is often unspaced (`이렇게오류뜨는데머임`, `완료 끝`).

When you reply:

- Short plain Korean. Call them `india 님`.
- No formal `합니다` / `입니다` lecture. No AI summary voice.
- Bug/fix tasks: 3–5 beginner sentences before editing (symptom, cause, plan). Skip that for a pure docs task.

Changelog and GitHub Release notes use the same voice as `CHANGELOG.md` `5.2.10`–`5.2.18`. Normal spacing is fine. Keep Keep a Changelog headings (`### Added` / `### Changed` / `### Fixed`) and the footer links. Examples already in the file:

- `원작자 서버 죽어서 차단 db 받는거 뺌`
- `이름 BongDC로 바꿈`
- `5.2.12 켜자마자 백그라운드 죽던거 고침. T is not a function 그거`
- `팝업 열면 No response랑 Receiving end does not exist 뜨던거 고침`

Do not rewrite `5.2.9` and older. Those stay in the old formal style on purpose.

## Tooling / MCP

If an MCP server from this section is missing, install it per the steps below without asking. Ask india 님 only for tokens.

Committed configs are the source of truth. They name the same three servers. Do not add Notion, Gmail, Drive, or any other MCP. This repo is a WXT + Vue extension; those three cover GitHub, browser checks, and library docs.

Never commit a token. Placeholders only.

| Server | Role | Package / endpoint |
| --- | --- | --- |
| `github` | required. PRs, releases, release assets | official `github/github-mcp-server`. Remote `https://api.githubcopilot.com/mcp/` |
| `playwright` | recommended. Load the extension and open dcinside pages | `@playwright/mcp` |
| `context7` | recommended. WXT, Vue, and webextension API docs | `@upstash/context7-mcp` |

`github` auth is env `GITHUB_PERSONAL_ACCESS_TOKEN`. Classic PAT scopes: `repo` and `workflow`. Do not print the value. `CONTEXT7_API_KEY` is optional and not in the committed JSON. Leave it unset unless india 님 already has one.

The committed `github` server is the remote HTTP endpoint, so Docker is not required. Docker image `ghcr.io/github/github-mcp-server` is the fallback when the remote URL is blocked. Do not use the deprecated npm package `@modelcontextprotocol/server-github`.

`gh` is the fallback when the GitHub MCP is down. Run `gh auth login` (scopes `repo` and `workflow`). Prefer the tag-push release flow. If that workflow did not attach the zips, create the release with the local zips:

```bash
gh release create <ver> --latest --repo Baegovda/BongDC --notes-file <changelog-section> .output/bongdc-<ver>-chrome.zip .output/bongdc-<ver>-firefox.zip
```

After CI creates the release, replace the body with `gh release edit <tag> --repo Baegovda/BongDC --notes-file <file>`. Do not pass `--draft` or `--latest` on `edit`.

### Config files

- `.cursor/mcp.json` — Cursor. Key `mcpServers`. Header `Bearer ${env:GITHUB_PERSONAL_ACCESS_TOKEN}`.
- `.mcp.json` — Claude Code. Key `mcpServers`. Header `Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}`.
- `.vscode/mcp.json` — VS Code. Key `servers` (not `mcpServers`). Each server has `type`. Header `Bearer ${env:GITHUB_PERSONAL_ACCESS_TOKEN}`.

Restart the client after editing. Export `GITHUB_PERSONAL_ACCESS_TOKEN` in the environment that launches the client. Do not paste the token into the JSON.

Docker fallback (replace the `github` entry only if the remote URL cannot be used):

```json
{
  "command": "docker",
  "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"],
  "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${env:GITHUB_PERSONAL_ACCESS_TOKEN}" }
}
```

On Claude Code, the env value in that `env` map is `${GITHUB_PERSONAL_ACCESS_TOKEN}`.

### Per-client install

Cursor: the project file `.cursor/mcp.json` is already the install. Reload MCP in Tools & Integrations. Cursor v0.48.0+ for streamable HTTP.

Claude Code: prefer the committed `.mcp.json`. To register on a machine that does not have it yet, from the repo root (placeholder, not a real token):

```bash
claude mcp add --scope project --transport http github https://api.githubcopilot.com/mcp/ --header "Authorization: Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}"
claude mcp add --scope project playwright -- npx -y @playwright/mcp@latest
claude mcp add --scope project context7 -- npx -y @upstash/context7-mcp
```

If the CLI writes a real token into `.mcp.json`, do not commit that file. Restore the placeholder from git.

Codex: do not commit `~/.codex/config.toml`. Add this there:

```toml
[mcp_servers.github]
url = "https://api.githubcopilot.com/mcp/"
bearer_token_env_var = "GITHUB_PERSONAL_ACCESS_TOKEN"

[mcp_servers.playwright]
command = "npx"
args = ["-y", "@playwright/mcp@latest"]

[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
```

`bearer_token_env_var` is the env var name, not the token. Equivalent CLI: `codex mcp add github --url https://api.githubcopilot.com/mcp/ --bearer-token-env-var GITHUB_PERSONAL_ACCESS_TOKEN`.

VS Code: `.vscode/mcp.json` is already the install. Command Palette → MCP: Open Workspace Folder Configuration.

### Bootstrap

From the repo root:

```bash
bash scripts/bootstrap.sh
```

Windows: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap.ps1`.

The script checks `node`, `npm` or `pnpm`, `gh`, and `bun`. It runs `bun install`, `bun run build`, and `bun run zip`. It prints which MCP config files, tokens, `gh` auth, `npx`, and optional `docker` are missing. It does not print secret values. A missing token still exits 0 when the zip succeeds. A failed install, build, or zip exits non-zero. Do not commit `.output/`.

## Standard release flow

Run this at the end of every task unless india 님 explicitly says no version bump, no tag, or no release. A docs-only opt-out still needs a PR to `develop` and a rebase merge.

1. `git fetch origin develop`. Branch from `origin/develop`. Do not commit on `develop`.
2. Do the work. If the task ships a release, bump the patch in `package.json`, the README version badge, and the `Current:` line in `AGENTS.md`. Add a Korean `CHANGELOG.md` entry in the voice above, plus the `[x.y.z]:` footer link.
3. `bun zip`. Confirm `.output/bongdc-<ver>-chrome.zip` and `.output/bongdc-<ver>-firefox.zip`. Do not commit `.output/`, `.wxt/`, or `node_modules/`.
4. Commit (one English line, why). Push the branch. Open a PR whose base is `develop`. Rebase-merge. Do not use a merge commit.
5. Fetch `origin/develop`. Tag that commit `X.Y.Z` with no `v` prefix. `git push origin X.Y.Z`.
6. Tag push runs `.github/workflows/build.yml`: `bun test`, the tag must equal `package.json` `version`, `bun zip`, `scripts/verify-release-zip.ts` (built manifest version, every file the manifest references, `update.html` and the files it loads; missing file fails the job), `scripts/extract-changelog.ts` writes that version's changelog section, then `gh release create` attaches `bongdc-<ver>-chrome.zip` and `bongdc-<ver>-firefox.zip`. Do not pass `--draft`. Store submit stays `continue-on-error`. An annotation `exit code 1` there is not a failed release if the job succeeded and both zips are on the release.
7. The release body should already be that version's changelog section. If it is not, `gh release edit <tag> --repo Baegovda/BongDC --notes-file <file>`. Do not pass `--draft` or `--latest`. Read `isDraft` and `gh release list` before and after. The new tag should be Latest and not Draft. Older flags must be unchanged.
8. If the workflow did not attach zips, upload the local zips with `gh release upload`. Report only URLs the tool returned. Never invent a URL.
9. Tell india 님 the PR URL, the version, the release URL, and the exact asset URLs. Install file is the chrome zip, not the Source code zip.

Do not run `scripts/hide-old-releases.ps1`.

Use `gh --repo Baegovda/BongDC` when the local `origin` is still the old name.

## Architecture map

Checked against source. Stack: WXT `0.20.27`, Vue 3, TypeScript, Bun. `srcDir` is `src`. Manifest is `wxt.config.ts` (no static `manifest.json`). `imports.parser` is `"oxc"`. Leave it. The regex scanner treats an `ip` parameter as an auto-import and crashes the service worker (see 5.2.13).

Commands (`package.json`):

- `bun install` — `postinstall` runs `wxt prepare` and writes gitignored `.wxt/`
- `bun dev` / `bun dev:firefox`
- `bun build` — Chrome and Firefox into `.output/`
- `bun zip` — both zips (Firefox also writes a sources zip)
- `bun test` — unpacked-update unit tests (zip reader, write order, version text, changelog extract)
- No lint or format script. After `bunx wxt prepare`: `bunx tsc --noEmit -p tsconfig.json`. Pre-existing errors are only missing `.vue` shims. New errors in `.ts` files are real.

Entrypoints:

- `src/entrypoints/background.ts` — MV3 service worker (Firefox build is MV2 background). Context menus, commands, update alarms, IP table refresh, `openExtensionsPage`, `getSchema` cache read.
- `src/entrypoints/content/index.ts` — `https://*.dcinside.com/*` at `document_start`. Excludes `event`, `h5`, `m`, `mall`, `wiki`, `gallog`. Loads `./modules/*/index.ts` and `./modules/*.ts`. `all_frames` is unset, so only the top frame.
- `src/entrypoints/grecaptcha.content.ts` — `world: "MAIN"`, `document_end`, reCAPTCHA bridge.
- `src/entrypoints/popup/` — toolbar popup. `options/` reuses popup pieces.
- `src/entrypoints/update/` — `update.html`. Chrome asks for the unpacked folder once (`showDirectoryPicker`, handle in IndexedDB `bongdc`) and writes the release zip there. Firefox shows that this browser cannot pick a folder.

Content modules (11). URL scope is the module `url` field, not the content-script match:

| Module | default | url |
| --- | --- | --- |
| 글 목록 새로고침, 컨텐츠 차단, 미리보기, 유저 정보 | on | `/board/(view\|lists)` |
| 레이아웃 수정, 폰트 교체, 이미지 검색 | on | all pages the content script runs on |
| 관리 | off | `/board/(view\|lists)` |
| 스텔스 모드 | off | all |
| 글쓰기 | off | `/board/(write\|modify)` |

Messaging (`src/http/messaging.ts`, `@webext-core/messaging`):

- Extension-page → background: `sendMessage(type, data)` uses `runtime.sendMessage` and checks `lastError`.
- Extension → content: pass a numeric tab id. That path is `sendToContentTab`. It sends only `{ frameId: 0 }` and reads `chrome.runtime.lastError` inside the callback. The library's own tab send omits `frameId` and does not read `lastError`. Do not call it.
- DCInside list pages have ad and recaptcha iframes. A content script is not in those frames. Sending to every frame logs `Unchecked runtime.lastError: Could not establish connection. Receiving end does not exist.` and the callback can resolve `undefined`, which the library turns into `Error: No response`.
- `console.error` of that failure becomes a row on `chrome://extensions`. Use `isMissingReceiverError`. Do not log it.
- Broadcast goes only to tabs whose URL passes `isDcContentScriptUrl` (`src/utils/dcinsideTab.ts`), via `sendToContentTab`.
- `getSchema`: content `src/core/modules.ts` waits for `modulesReady`, returns the schema, and writes `local:refresher:module:schema`. Background `getSchema` returns that cache. Popup (`useSettings.ts`) retries the top frame, then the cache. Empty cache with no DC tab is the `no-tab` state, not an error log.

Storage (`src/storage/wxtStorage.ts`): WXT `storage.defineItem`, keys `local:refresher:...`. Block, memo, per-module enable/setting/data, popup tab and height, update check, `database:ip`, `database:ban`, `database:lastUpdate` (cloud backup time, also shown as 마지막 백업), `database:ipCheckedAt` (ISP fetch time, 7 days = `604800000` ms). Do not store the ISP check in `lastUpdate`.

Update checker (`src/core/updateCheck.ts`, shared helpers in `src/core/update/`): GitHub `releases/latest` on `Baegovda/BongDC`. No token. User-Agent `BongDC`. Notification title `BongDC 업데이트`. Daily alarm, default on. Popup shows `현재 → 최신 업데이트 가능` from `describeUpdate`. `업데이트 받기` still downloads the `*-chrome.zip` or `*-firefox.zip`. Chrome also has `지금 업데이트`, which opens `update.html` in a tab because a directory picker closes the popup. That page checks the folder manifest `name` is `BongDC`, fetches the zip, extracts it in memory (`DecompressionStream` deflate-raw, zip-slip rejected), and writes changed bytes only. Write order is the update page and its chunks, then other files, then `manifest.json` last, so a Chrome reload mid-write can resume from IndexedDB `pending`. Firefox hides `지금 업데이트`. Button `확장 프로그램 관리` calls background `tabs.create`. Chrome: `chrome://extensions/?id=<runtime id>` (details page), fallback `chrome://extensions`. Firefox: `about:addons`. An `<a href="chrome://">` does not work. Host permissions include `api.github.com`, `github.com`, `objects.githubusercontent.com`, and `release-assets.githubusercontent.com` so the zip fetch can follow the release redirect.

IP refresh: `fetchRemoteIpIsp`. HTTP not-ok returns null and still sets `ipCheckedAt`. A thrown network error does not set it and must not `console.error`. No code may fetch `https://dcrefresher.green1052.com/data/...`.

`src/utils/ban.ts` still reads stored `database:ban`. Keep the stored list. Do not resume the HTTP fetch.

## History log

Product versions `5.2.13`–`5.2.20`. Older PR URLs were returned by `gh pr list` and now use the `Baegovda/BongDC` path (GitHub redirects the old repo name). Release tag pages are `https://github.com/Baegovda/BongDC/releases/tag/<version>`. Do not invent asset URLs; read `gh release view <tag> --json assets`.

| Version | PR | What changed |
| --- | --- | --- |
| 5.2.20 | https://github.com/Baegovda/BongDC/pull/14 | Gallery list refresh ky `TimeoutError` is no longer an uncaught rejection. Quiet failure keeps the current list and the scheduler retries. Request timeout is at least ky's 10s. Release: https://github.com/Baegovda/BongDC/releases/tag/5.2.20 — chrome https://github.com/Baegovda/BongDC/releases/download/5.2.20/bongdc-5.2.20-chrome.zip — firefox https://github.com/Baegovda/BongDC/releases/download/5.2.20/bongdc-5.2.20-firefox.zip |
| 5.2.19 | https://github.com/Baegovda/BongDC/pull/12 | `레포 이름도 BongDC로 바꿈`. `GITHUB_RELEASE_REPO` and `IP_ISP_REPO` are `Baegovda/BongDC`. Latest: https://github.com/Baegovda/BongDC/releases/tag/5.2.19 — chrome https://github.com/Baegovda/BongDC/releases/download/5.2.19/bongdc-5.2.19-chrome.zip — firefox https://github.com/Baegovda/BongDC/releases/download/5.2.19/bongdc-5.2.19-firefox.zip |
| 5.2.13 | https://github.com/Baegovda/BongDC/pull/4 | Service worker died on startup (`T is not a function`, registration status 15). Unimport's regex scanner auto-imported `utils/ip.ts` from an `ip` parameter and cycled `isIpIspDatabase` before assignment. Fix: `imports.parser: "oxc"`. |
| 5.2.14 | https://github.com/Baegovda/BongDC/pull/5 | `업데이트 확인` 오른쪽에 `확장 프로그램 관리`. Chrome opens this extension's details page. Firefox opens `about:addons`. |
| 5.2.15 | https://github.com/Baegovda/BongDC/pull/6 | `원작자 서버 죽어서 차단 db 받는거 뺌`. `https://dcrefresher.green1052.com/data/version` and `/data/ban.json` are dead (browser fetch 404). Stored ban list kept. ISP table still comes from GitHub. Network failure is not logged. |
| 5.2.16 | https://github.com/Baegovda/BongDC/pull/7 | Project renamed to `DCRefresher-SuckBong`, including zip prefix `dcrefresher-suckbong`. Update checker and ISP table used `Baegovda/DCRefresher-SuckBong` until 5.2.19. Repo rename API returned 403; india 님 renamed it in the web UI. |
| 5.2.17 | https://github.com/Baegovda/BongDC/pull/8 | `Edition` suffix removed. Live name became `DCRefresher-SuckBong` only. Historical changelog lines that record the old 5.1.x branding were left as history. |
| 5.2.18 | https://github.com/Baegovda/BongDC/pull/10 | Popup schema errors fixed (top frame + `lastError` + cached schema). Display name and zips became `BongDC` / `bongdc-<ver>-*.zip`. Update checker repo unchanged until 5.2.19. Release: https://github.com/Baegovda/BongDC/releases/tag/5.2.18 — chrome https://github.com/Baegovda/BongDC/releases/download/5.2.18/bongdc-5.2.18-chrome.zip — firefox https://github.com/Baegovda/BongDC/releases/download/5.2.18/bongdc-5.2.18-firefox.zip |

Changelog voice-only rewrite of `5.2.10`–`5.2.17` (no version) is https://github.com/Baegovda/BongDC/pull/9. Draft release bodies for `5.2.10`–`5.2.12` were not edited.

### Docs history

Append a row here for work that does not ship a version. Newest first.

| When | What | PR |
| --- | --- | --- |
| 2026-10-30 | Chrome unpacked one-click update, zip verification, and changelog release notes. No version bump, no tag, no release edit. | https://github.com/Baegovda/BongDC/pull/16 |
| 2026-10-30 | Recorded the 5.2.20 release asset URLs after the tag workflow. No version bump, no tag. | https://github.com/Baegovda/BongDC/pull/15 |
| 2026-10-26 | Tooling bootstrap: GitHub MCP (required), Playwright and Context7 (recommended), three client configs, `scripts/bootstrap.sh`. No version bump, no tag, no release edit. | https://github.com/Baegovda/BongDC/pull/13 |
| 2026-10-25 | Handoff kit: `AGENTS.md` entry point, pointer files, this document. No version bump, no tag, no release edit. | https://github.com/Baegovda/BongDC/pull/11 |

## Known gotchas

- Draft releases `5.2.6` through `5.2.12` still exist. On 2026-10-25, `5.2.5` and older listed releases were Draft too. On 2026-10-26, `gh release list` showed `5.2.13`–`5.2.19` published and `5.2.19` Latest (`5.2.12` still Draft in that list). Leave every draft/published flag alone unless india 님 asks. `gh release edit` without `--draft` / `--latest` did not flip them; verify anyway.
- Repo rename: in the 5.2.16 task, `gh api -X PATCH` returned `403 Resource not accessible by integration`. india 님 later renamed the repo in GitHub settings, first to `DCRefresher-SuckBong`, then on 2026-10-25 to `BongDC`. Do not rename it again unless asked. The integration token may still be unable to rename.
- `chrome://extensions` errors fixed in 5.2.18: `Failed to load module schema: Error: No response` (popup `console.error` after the library got `undefined`) and `Unchecked runtime.lastError: Could not establish connection. Receiving end does not exist.` The stack frame sat on the minified popup chunk, which also contains the WXT storage helper, so the highlight looked like a storage crash. It was not a missing `storage` permission. `storage` is already in the manifest. Fix is `sendToContentTab` (`frameId: 0`, read `lastError`) plus a cached schema and no `console.error` for a missing receiver.
- 5.2.12 startup crash is fixed only while `imports.parser` stays `"oxc"`. Do not revert it.
- Do not fetch `dcrefresher.green1052.com/data`. The site homepage can still 403 or challenge; that is unrelated to the removed ban fetch.
- `database:lastUpdate` is the backup clock. ISP checks use `database:ipCheckedAt`.
- Branded Chrome ignores `--load-extension`. Chrome for Testing still loads unpacked extensions. `chrome://` links from a page do not navigate; use `tabs.create` in the extension.
- Chrome unpacked update: do not write `manifest.json` before the other files. The updater stores the extracted files in IndexedDB `bongdc` / `pending` first, writes `update.html` and the chunks it imports next, and writes `manifest.json` last. A newer pending version means 이어서 완료. The same version means clear the pending row. Firefox has no `showDirectoryPicker`.
- Typecheck noise: `.vue` module-not-found errors are pre-existing. Do not "fix" them with dummy shims unless india 님 asks.
- Firefox zip build warns that an extension id is recommended. That warning is old. Do not invent a gecko id unless asked.

## Resume checklist

1. Read `AGENTS.md`, then this file, including **Current state / next steps**.
2. `git fetch origin develop`. Read `package.json` `version`, `wxt.config.ts` `manifest.name`, and `git log -1 --oneline origin/develop`.
3. `gh release view <version> --repo Baegovda/BongDC --json tagName,isDraft,url,assets` and `gh release list --repo Baegovda/BongDC --limit 15`. Trust that output over this document if they differ. If GitHub MCP is missing, install **Tooling / MCP** before asking.
4. Do the task. Investigate code before claiming a cause.
5. Before the PR merges: append §4 in `AGENTS.md`, append a row to the history in this file, and replace **Current state / next steps**.
6. Release flow above, unless this task opted out.
7. Report to india 님 in short Korean. Include only real PR, version, release, and asset URLs.

## Current state / next steps

Replace this whole section at the end of every task. Do not append to it.

Updated: 2026-10-30. This task did not bump the version, push a tag, or edit a release. Latest release was checked at the start of the task with `gh release view 5.2.20`.

- Product version stays `5.2.20`. Display name is `BongDC`. Repo is `Baegovda/BongDC`. `GITHUB_RELEASE_REPO` (`src/core/update/release.ts`) and `IP_ISP_REPO` point there.
- Latest release is still `5.2.20`, not draft. https://github.com/Baegovda/BongDC/releases/tag/5.2.20
- Chrome zip: https://github.com/Baegovda/BongDC/releases/download/5.2.20/bongdc-5.2.20-chrome.zip
- Firefox zip: https://github.com/Baegovda/BongDC/releases/download/5.2.20/bongdc-5.2.20-firefox.zip
- Unpacked Chrome update is in the tree (`지금 업데이트`, `update.html`) but is not in the 5.2.20 release. `CHANGELOG.md` has an `[Unreleased]` section for the next version bump. Move that section when the next release ships. Do not leave it as Unreleased after the bump.
- Drafts `5.2.6`–`5.2.12` stay Draft. Do not run `scripts/hide-old-releases.ps1`. Do not flip draft or published flags.
- The 5.2.20 store-submit step exited 1 because the Chrome/Firefox store secrets are unset. The release job succeeded and both zips are attached. That annotation is not a failed release.
- Tooling bootstrap is https://github.com/Baegovda/BongDC/pull/13. Configs: `.cursor/mcp.json`, `.mcp.json`, `.vscode/mcp.json`. No token is committed. Set `GITHUB_PERSONAL_ACCESS_TOKEN` (`repo` + `workflow`) in the client environment. Run `bash scripts/bootstrap.sh` on a fresh machine.
- Historical `CHANGELOG.md` bodies still mention `Baegovda/DCRefresher-SuckBong` where that was the name then. Header and footer links use `Baegovda/BongDC`.
- PR: https://github.com/Baegovda/BongDC/pull/16. Chrome unpacked update is on that branch, not in the 5.2.20 release.
- Next: wait for india 님 to try the Chrome folder update from that PR. Do not rename the repo. Do not bump the version unless the next task ships a release.

## Keep this file current

Every agent, at the end of every task, in the same branch, before merge:

1. Append one row to **History log** (version table if a version shipped, otherwise **Docs history**).
2. Replace **Current state / next steps** so it matches `origin/develop` after your commit, the real release URLs if you created one, and the next action (or "wait for india 님").
3. Append `AGENTS.md` §4.
4. Do not leave this section describing a previous task.
