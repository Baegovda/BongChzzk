# BongExtend — 에이전트 안내

처음 오면 이 순서만 읽어요.

1. 이 파일 (`AGENTS.md`) — 뭐 하는 확장인지, 지키면 안 되는 것, 빌드·테스트·릴리스
2. `MERGE_NOTES.md` — 지금 버전, 방금 한 일, 아직 남은 일

`docs/legacy/`는 옛 BongChzzk·BongTrans·BongDC 기록이에요. 지금 규칙이 아니니 따르지 마세요. `docs/HANDOFF.md`는 없어요.

## 이게 뭔가요
BongExtend는 크롬 확장(MV3)이에요. 치지직(BongChzzk) + Gemini 번역(BongTrans) + 디시(BongDC, green1052/DCRefresher-Reborn 포크)를 하나로 합쳤어요. 뼈대는 WXT + Vue 3 + TypeScript + Bun. 라이선스 GPL-3.0.
저장소는 https://github.com/Baegovda/BongExtend 예요.
오너(Guilliman / GitHub Baegovda)는 개발자가 아니에요. 화면 글, README, CHANGELOG, 보고는 한국어로 쉽게, 해요체로 써요.
버전 숫자는 `package.json`의 `version` 하나예요. 지금 숫자는 `MERGE_NOTES.md`에 있어요.

## 꼭 지킬 것
- `wxt.config.ts`의 `imports.parser: "oxc"`는 빼지 말 것 (기본 스캐너가 순환 import를 만들어 배경 스크립트가 죽음).
- 단축키(`commands`)는 넣지 말 것. 오너가 따로 요청하면 그때 추가.
- manifest `key` 넣지 말 것 (새 확장 ID로 시작하기로 함).
- 권한에 `webNavigation`, `<all_urls>` 호스트 권한 추가 금지 (WAR `assets/*.webp`의 `<all_urls>`는 BongDC 그대로).
- Gemini API 키는 서비스 워커와 확장 페이지에서만. 콘텐츠 스크립트에 보내지 말 것 (`GET_PREFS`는 prioritizeCursor/revealAnimation만).
- 번역 `content.js`는 비모듈 IIFE, 글은 nodeValue로만 씀 (innerHTML 금지). `executeScript`에 넘기는 함수는 클로저 없이 자체 완결.
- 저장소 구역: 디시 `refresher:*`(옛 키 그대로), 치지직 `chzzk.*`(sync/local, `lib/ns.js` shim이 붙임), 번역 `trans.*`(local), 공통 `core.*`. 디시 데이터 작업(가져오기/초기화/백업)은 `src/storage/namespace.ts`로 다른 구역을 건드리지 않게 함. `chrome.storage.*.clear()` 쓰지 말 것.
- 치지직 콘텐츠 스크립트는 배경에서 `chrome.scripting.registerContentScripts`로 등록 (`src/modules/chzzk-register.ts`). 파일 순서 바꾸지 말 것.
- 아이콘은 아직 바꾸지 말 것. 태그·릴리스·버전 올리기는 오너가 확인한 뒤에만.

## 구조
- `src/entrypoints/` WXT 진입점: `background.ts`(서비스 워커 하나), `popup/`(탭 셸), `dc/`(디시 Vue 팝업 → `dc.html`), `options/`(디시 전체 설정), `update/`(원클릭 업데이트), `content/` + `grecaptcha.content.ts`(디시).
- `src/modules/chzzk/` 옛 BongChzzk 순수 JS (빌드 때 그대로 `chzzk/`로 복사).
- `src/modules/trans/` 옛 BongTrans 순수 JS. `background.js`는 `startTransBackground()`로 배경에 붙고, 나머지는 `trans/`로 복사.
- `src/modules/core-modules.js` 모듈 스위치, `settings-io.ts` 설정 내보내기·가져오기.
- 그 밖의 `src/*`(core, storage, utils, components, …)는 디시 모듈(옛 BongDC) 코드. 경로 그대로 둠.

## 명령
- `bun install`
- `bun run test` (= `bun test` 디시·공통 + `node --test` 치지직·번역)
- `bun run typecheck` (= `vue-tsc --noEmit`, TypeScript 5.9)
- `bun run build` → `.output/chrome-mv3/`
- `bun run zip` → `.output/bongextend-X.Y.Z-chrome.zip`, 그다음 `bun scripts/verify-release-zip.ts X.Y.Z`

## 릴리스
- 버전은 `package.json` 하나. `CHANGELOG.md`에 `## [X.Y.Z]` 섹션.
- 태그 `vX.Y.Z` 푸시 → `.github/workflows/release.yml`(테스트, 태그=버전 확인, zip, zip 검사, 노트, GitHub 릴리스).
- 태그·릴리스는 오너가 확인한 뒤에만. main에 바로 넣을지 PR로 받을지는 아직 열려 있어요. `MERGE_NOTES.md`를 보세요.
