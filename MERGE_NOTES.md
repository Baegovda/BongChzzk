# BongExtend 현재 상태 (2026-10-31)

`AGENTS.md`를 먼저 읽어요. 이 파일은 지금 상태만 적어요.

## 지금
- 버전 **1.0.13** (`package.json`). 화면 이름은 BongExtend.
- 저장소 `Baegovda/BongExtend`, 기본 브랜치 `main`.
- 설치 파일은 `bongextend-X.Y.Z-chrome.zip`. 파이어폭스 빌드는 하지 않아요.
- 통신사 표는 `Baegovda/BongExtend`의 `main`에서 받아요 (`src/utils/ipIsp.ts`). 실패하면 내장 표를 써요.
- 아이콘은 아직 옛 BongDC 아이콘이에요. 디자인이 정해지기 전에는 그대로 둬요.

## 이번 작업에서 한 일
버전은 1.0.13 그대로예요. 태그·릴리스는 만들지 않았어요.

- 안내가 없어진 옛 BongDC 문서(`docs/HANDOFF.md`, `Baegovda/BongDC`)를 가리키던 것을 고쳤어요. Cursor·Copilot·Claude 안내는 `AGENTS.md` 다음 이 파일을 읽어요.
- `docs/legacy/BongDC-HANDOFF.md`와 `docs/legacy/BongDC-AGENTS.md` 맨 위에, 옛 기록이라 따르지 말라고 적어 두었어요.
- 설정 파일(`src/modules/settings-io.ts`)에 `chzzk.*`(sync/local 전부)와 `trans.*`가 들어가고 다시 불러와져요. 번역 횟수(`trans.cacheStats`)도 포함돼요. Gemini 키는 예전처럼 `trans.settings` 안에 있어요. 그 파일은 남에게 보내지 마세요.
- 옛 BongChzzk에는 내보내기 버튼이 없어요. 그 확장에서 넘어올 때만 치지직 설정을 다시 해야 해요. BongExtend끼리 옮길 때는 백업 파일이면 돼요.
- `bun run typecheck`를 넣었어요. TypeScript는 5.9.3이에요. 7은 vue-tsc가 쓰는 내부 경로가 없어서 쓰지 않아요.
- 이 브랜치에서 `bun run test`, `bun run typecheck`, `bun run build`를 통과했어요.

## 옛 치지직 릴리스
GitHub 릴리스 v1.1.0–v1.6.2(옛 BongChzzk)는 지우는 중이에요. git 태그는 남겨요. 그 릴리스가 남아 있으면 업데이트 확인이 1.0.13보다 1.6.2를 더 새 버전으로 볼 수 있어요. 여기서 릴리스를 더 지우거나 만들지 마세요.

## 아직 남은 일
- 실제 기기에서 확인 못 한 것: 로그인한 크롬에서 치지직 라이브 기능 전부, Gemini 키로 실제 번역, 디시 로그인 기능, 우클릭 메뉴 클릭. 원클릭 업데이트를 끝까지. 옛 BongTrans·BongDC 파일로 실제 가져오기(단위 테스트만 있음). 번역을 치지직·디시 페이지에서 켰을 때 서로 부딪히는지.
- 아이콘 교체. 정해지기 전에는 그대로 둬요.
- 작업 방식은 아직 안 정했어요. main에 바로 넣을지, PR로 받을지 오너 결정 전이에요. 그 전에는 태그·릴리스를 만들지 마세요.

## 어디서 왔나
치지직은 BongChzzk 1.6.2, 번역은 BongTrans 1.5.1, 디시는 BongDC 5.2.20을 합쳤어요. 긴 옛 이력은 `docs/legacy/`에 있어요.
