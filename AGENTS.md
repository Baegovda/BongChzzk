# BongExtend — 에이전트 안내

BongExtend = BongChzzk(치지직) + BongTrans(Gemini 번역) + BongDC(디시, green1052/DCRefresher-Reborn 포크)를 합친 크롬 MV3 확장. 라이선스 GPL-3.0.
오너(Guilliman / GitHub Baegovda)는 개발자가 아님. 화면 글, README, CHANGELOG, 보고는 한국어로 쉽게.

## 꼭 지킬 것
- `wxt.config.ts`의 `imports.parser: "oxc"`는 빼지 말 것 (기본 스캐너가 순환 import를 만들어 배경 스크립트가 죽음. docs/legacy/BongDC-AGENTS.md 참고).
- 단축키(`commands`)는 넣지 말 것. 오너가 따로 요청하면 그때 추가.
- manifest `key` 넣지 말 것 (새 확장 ID로 시작하기로 함).
- 권한에 `webNavigation`, `<all_urls>` 호스트 권한 추가 금지 (WAR `assets/*.webp`의 `<all_urls>`는 BongDC 그대로).
- Gemini API 키는 서비스 워커와 확장 페이지에서만. 콘텐츠 스크립트에 보내지 말 것 (`GET_PREFS`는 prioritizeCursor/revealAnimation만).
- 번역 `content.js`는 비모듈 IIFE, 글은 nodeValue로만 씀 (innerHTML 금지). `executeScript`에 넘기는 함수는 클로저 없이 자체 완결.
- 저장소 구역: 디시 `refresher:*`(옛 키 그대로), 치지직 `chzzk.*`(sync/local, `lib/ns.js` shim이 붙임), 번역 `trans.*`(local), 공통 `core.*`. 디시 데이터 작업(가져오기/초기화/백업)은 `src/storage/namespace.ts`로 다른 구역을 건드리지 않게 함. `chrome.storage.*.clear()` 쓰지 말 것.
- 치지직 콘텐츠 스크립트는 배경에서 `chrome.scripting.registerContentScripts`로 등록 (`src/modules/chzzk-register.ts`). 파일 순서 바꾸지 말 것.

## 구조
- `src/entrypoints/` WXT 진입점: `background.ts`(서비스 워커 하나), `popup/`(탭 셸), `dc/`(디시 Vue 팝업 → `dc.html`), `options/`(디시 전체 설정), `update/`(원클릭 업데이트), `content/` + `grecaptcha.content.ts`(디시).
- `src/modules/chzzk/` 옛 BongChzzk 순수 JS (빌드 때 그대로 `chzzk/`로 복사).
- `src/modules/trans/` 옛 BongTrans 순수 JS. `background.js`는 `startTransBackground()`로 배경에 붙고, 나머지는 `trans/`로 복사.
- `src/modules/core-modules.js` 모듈 스위치, `settings-io.ts` 설정 내보내기·가져오기.
- 그 밖의 `src/*`(core, storage, utils, components, …)는 디시 모듈(옛 BongDC) 코드. 경로 그대로 둠.

## 명령
- `bun install`
- `bun run test` (= `bun test` 디시·공통 + `node --test` 치지직·번역)
- `bun run build` → `.output/chrome-mv3/`
- `bun run zip` → `.output/bongextend-X.Y.Z-chrome.zip`, `bun scripts/verify-release-zip.ts X.Y.Z`

## 릴리스
- 버전은 `package.json` 하나. `CHANGELOG.md`에 `## [X.Y.Z]` 섹션.
- 태그 `vX.Y.Z` 푸시 → `.github/workflows/release.yml`(테스트, 태그=버전 확인, zip, zip 검사, 노트, gh release).
- 푸시·태그·릴리스는 오너가 확인한 뒤에만.
