# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.1] - 2026-10-30

### Fixed

- 번역 와이퍼가 글자를 지나가며 바꿀 때 칸이 깜빡이거나, 번역이 길어서 아이콘 글과 숫자 칸이 밀리던 문제를 고쳤습니다. 예전에는 번역이 도착한 뒤 최대 8칸만 각자 560ms 스캔을 돌리고, 스캔이 끝난 뒤에야 `nodeValue`를 바꿨습니다. 칸마다 레이아웃을 다시 읽고, 원문 색을 투명하게 켰다 끄고, 오버레이를 지우는 시점이 어긋나 글자가 나타났다 사라졌습니다.
- 이제 한 줄의 와이퍼가 화면을 한 번 지나갑니다. 글 위치는 애니메이션 프레임에서 먼저 모두 읽고, 그다음 고정 오버레이의 `clip-path`만 바꿉니다. 본문 글자는 와이퍼가 끝난 뒤에 한 번에 바뀌므로 지나가는 동안에는 칸 크기가 변하지 않습니다. 나중에 도착한 묶음도 같은 클립으로 붙습니다. 번역을 끄면 반대 방향으로 되돌아갑니다. `prefers-reduced-motion`이면 와이퍼 없이 바로 바꿉니다.
- The wiper no longer pops text in bursts. One pass clips a fixed overlay as the line moves, and the live text is written once when that pass ends, so a longer translation cannot reflow the page mid-sweep. Reduced motion still swaps immediately.

## [1.5.0] - 2026-10-30

### Added

- 팝업과 설정의 **업데이트 확인**이 새 버전을 `1.4.2 → 1.5.0 업데이트 가능`처럼 보여 주고, zip이 있으면 **지금 업데이트** 버튼이 나타납니다. 버튼은 업데이트 탭을 엽니다. 폴더 선택 창이 팝업을 닫아도 작업이 끊기지 않도록 그 탭에서 진행합니다.
- 처음 한 번만 압축을 푼 BongTrans 폴더를 고릅니다(`manifest.json`의 이름과 `key`). 그 폴더 핸들은 번역 캐시와 다른 IndexedDB(`bongtrans-install`)에 남습니다. 다음부터는 최신 릴리스 zip을 받아 바뀐 파일만 덮어쓰고 확장 프로그램을 다시 로드합니다.
- 받은 파일은 디스크에 쓰기 전에 IndexedDB `pending`에 넣습니다. 중간에 끊기면 업데이트 탭의 **중단된 업데이트가 있습니다. 이어서 완료**로 이어서 씁니다. `manifest.json`은 맨 마지막에 씁니다.
- 릴리스 zip을 받기 위해 `github.com`, `objects.githubusercontent.com`, `release-assets.githubusercontent.com` 호스트 권한을 추가했습니다. 페이지 내용과 API 키는 보내지 않습니다.
- `v*` 태그 워크플로는 zip을 만든 뒤, manifest가 가리키는 파일과 업데이트에 필요한 파일이 zip에 있는지 확인합니다.

### Changed

- 이 버전(1.5.0)은 지금까지와 같이 zip을 풀어 **압축해제된 확장 프로그램**으로 한 번 불러와야 합니다. **지금 업데이트**는 그 다음 릴리스부터 씁니다.

## [1.4.2] - 2026-10-26

### Added

- 저장소 주소만 받은 에이전트도 같은 순서로 이어가도록 핸드오프를 보강했습니다. `AGENTS.md`의 BOOTSTRAP이 첫 절차입니다. `scripts/bootstrap.sh`는 설치나 비밀 기록 없이 Node와 `gh`를 확인하고 테스트를 실행한 뒤, 없는 MCP와 환경 변수를 출력합니다.
- MCP 설정은 Cursor용 `.cursor/mcp.json`, Claude Code용 `.mcp.json`입니다. 서버 이름, 용도, 필수 여부, 설치, 인증, 없을 때의 대체 수단은 `docs/MCP.md`에 있습니다. Codex용 `config.toml` 조각도 그 문서에 있습니다. GitHub는 공식 `github-mcp-server` 이미지와 `GITHUB_PERSONAL_ACCESS_TOKEN`을 쓰고, 토큰이 없으면 `gh`를 씁니다. 확장 프로그램 확인은 Chrome for Testing에 붙는 `chrome-devtools-mcp`이고, Playwright MCP는 일반 브라우저용입니다. 파일시스템 MCP는 두지 않습니다. 비밀은 커밋하지 않습니다.
- A fresh agent with only the repo URL now has a BOOTSTRAP checklist, committed MCP configs with `${env}` placeholders, and a check-only `scripts/bootstrap.sh`.

## [1.4.1] - 2026-10-25

### Fixed

- The rainbow scan and the moment the text changed were not the same place. 1.4.0 wrote the translation as soon as it arrived, then ran a separate animation on the parent element's box. A wrapped paragraph, an inline span, a scroll, or a scan waiting for a free slot could leave the scan line away from the text that was changing. The original text now stays until that node's own scan starts. Each line uses that line's text rectangle. The clip and the scan share one clock, so the boundary sits on the scan. Text that is still waiting for a scan slot keeps the original and the pending glow.

### Changed

- The GitHub repository is `Baegovda/bongtrans`. **업데이트 확인** calls `https://api.github.com/repos/Baegovda/bongtrans/releases/latest`. Old `Baegovda/page-translator` URLs redirect. The extension ID, IndexedDB name, settings file type, CSS prefix, `package.json` name, and `bongtrans-<version>.zip` asset name are unchanged.

## [1.4.0] - 2026-10-25

### Added

- Options shows how many translations are cached, an approximate size, and the cumulative count of strings and API calls saved by cache hits. **통계 초기화** sets those counters back to zero and leaves the saved translations in place.
- Cache cleanup is configurable: drop entries last used more than 30, 90, or 180 days ago, or never, and optionally cap the store at 5 MB, 20 MB, or 50 MB. Over the cap, the least recently used entries go first. The default is 90 days and no size cap. Cleanup runs when the service worker starts, when those settings change, and when the options page reads the stats.
- While a translation is in flight, the text has a low prism glow. When the translation arrives, a rainbow scan moves across the text in the writing direction and the original gives way to the translation as the scan passes. The only layout change is the new string length. `prefers-reduced-motion: reduce` uses a short crossfade. At most eight glows and eight scans run at once. **번역 등장 애니메이션** turns the effect off.
- `AGENTS.md` (with `CLAUDE.md` and `.cursor/rules` pointing at it) and `docs/HISTORY.md` describe how to continue this project from the repository alone. They are not part of the release zip.

### Changed

- The shimmer underline from 1.3.0 is gone.
- IndexedDB cache values are now `{ value, usedAt, bytes }`. Older string values are migrated and treated as used at the time of the upgrade. The database name is still `page-translator`.

## [1.3.1] - 2026-10-25

### Fixed

- The popup ON/OFF switch stayed OFF. The function injected into the page called a helper that exists only in the service worker, so `chrome.scripting.executeScript` threw before translation started and the popup treated that as a failed toggle. The injected function is now self-contained. The top frame is enabled immediately, other frames are injected afterwards without cancelling that, and the switch keeps the clicked state until the tab answers. A page that cannot be translated, such as a `chrome://` URL, turns the switch back OFF and shows the reason.

### Changed

- The extension name is now BongTrans in the toolbar, popup, options page, shortcuts, and context menu. The manifest `key` is unchanged, so the extension ID and saved settings stay the same. Release zips are named `bongtrans-<version>.zip`. The update check prefers that name and still accepts a `page-translator-<version>.zip` asset from an older release.

## [1.3.0] - 2026-10-25

### Added

- While a batch is in flight, those elements show a shimmer underline. The new text fades in when the translation arrives, and the mark is removed on error. The underline does not change layout. `prefers-reduced-motion: reduce` keeps a static underline.
- Options checkbox **마우스 커서 근처 글을 우선**, off by default. When on, pending near-viewport text is ordered by distance from the mouse. Pointer moves are applied about every 150ms, element positions are cached and refreshed on scroll or resize, and moving the cursor reorders only the pending queue. Requests already sent are not cancelled.

### Changed

- The popup **Translate this page** button and **Show original** checkbox are one ON/OFF switch for the current tab. ON translates the page and keeps translating new text. OFF restores the original text and stops new API calls. `Ctrl+Shift+Y`, `Alt+Shift+O`, and the context menu **Toggle translation** do the same. The toolbar badge is unchanged from 1.2.0: the translated-string count while translation is on, cleared when it is turned off or the address changes, and a red `!` on error.

## [1.2.0] - 2026-10-25

### Added

- `manifest.json` includes a public `key`, so loading the extension from another folder keeps the same extension ID and the saved settings.
- Options can export and import settings as JSON, including the API key, for a move to another browser profile.

### Changed

- The on-page success toast is gone. Translation progress is the toolbar badge for that tab: the translated-string count updates as more text is translated (`999`, `1.2k`, `12k`, `99k+`). **Show original** and navigation clear the badge. Errors still use a red `!`.
- A page error is a small corner note instead of a top-center banner. Closing it keeps it dismissed until the next translation.

## [1.1.0] - 2026-10-25

### Added

- Default model is now `gemini-3.5-flash-lite`. Presets are `gemini-3.5-flash-lite` and `gemini-3.1-flash-lite`, with a configurable fallback model. A saved `gemini-2.5-flash-lite` choice is migrated to the new default.
- Overloaded responses (HTTP 503/500) retry with exponential backoff and jitter, then the extension tries the fallback model. HTTP 404 model-not-found also moves to the next model. An invalid key or a real quota error does not.
- The popup and page banner show the model that actually produced the translation.
- Options **키 확인** checks the key, lists which preset models this key can call, and probes the selected model so overload is not reported as a bad key.
- **업데이트 확인** on the popup and options page compares `chrome.runtime.getManifest().version` with the latest GitHub release and links to the release page and zip.
- **확장 프로그램 관리** opens `chrome://extensions/?id=<extension id>`.
- Host permission `https://api.github.com/*` for the update check. Page text and the API key are not sent to GitHub.
- GitHub Actions workflow (`.github/workflows/release.yml`) runs tests, checks that `manifest.json` matches the tag, builds the zip, and publishes the GitHub Release from the matching `CHANGELOG.md` section when a `v*` tag is pushed.

### Changed

- Overload and server errors say that the API key is not the problem.
- `gemini-2.5-flash-lite` is no longer a preset. New accounts receive HTTP 404 for that model.

## [1.0.0] - 2026-10-25

### Added

- Manifest V3 Chrome extension that translates visible text on the current page with the user's Gemini API key.
- Options page to store the API key in `chrome.storage.local`, choose `gemini-3.1-flash-lite` (default), `gemini-2.5-flash-lite`, or a custom model id, and pick a target language (default Korean). Source language is detected per string.
- Popup actions **Translate this page** and **Show original**, keyboard shortcuts `Ctrl+Shift+Y` (Command+Shift+Y on macOS) and `Alt+Shift+O`, and matching context-menu entries.
- In-place replacement of text nodes, skipping scripts, styles, code, and form fields, with the original text kept for restore.
- Viewport-first batching (JSON array in and out), then lazy translation on scroll and for nodes added later (`MutationObserver`), aimed at infinite-scroll shopping pages.
- Local translation cache in the extension's IndexedDB, keyed by source text, target language, and model, so repeated strings are not sent again.
- Retry with backoff for HTTP 429 rate limits, and visible errors for a missing key, invalid key, quota, and unreachable pages.
- Prompt tuned for natural Chinese-to-Korean shopping language (product titles, sizes, shipping, prices) while remaining usable for other language pairs.

[1.5.1]: https://github.com/Baegovda/bongtrans/releases/tag/v1.5.1
[1.5.0]: https://github.com/Baegovda/bongtrans/releases/tag/v1.5.0
[1.4.2]: https://github.com/Baegovda/bongtrans/releases/tag/v1.4.2
[1.4.1]: https://github.com/Baegovda/bongtrans/releases/tag/v1.4.1
[1.4.0]: https://github.com/Baegovda/bongtrans/releases/tag/v1.4.0
[1.3.1]: https://github.com/Baegovda/bongtrans/releases/tag/v1.3.1
[1.3.0]: https://github.com/Baegovda/bongtrans/releases/tag/v1.3.0
[1.2.0]: https://github.com/Baegovda/bongtrans/releases/tag/v1.2.0
[1.1.0]: https://github.com/Baegovda/bongtrans/releases/tag/v1.1.0
[1.0.0]: https://github.com/Baegovda/bongtrans/releases/tag/v1.0.0
