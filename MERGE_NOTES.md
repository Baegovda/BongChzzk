# BongChrome 1.0.0 통합 메모 (2026-10-31 KST)

## 출처
- BongChzzk v1.6.2 (`Baegovda/BongChzzk` → 이름 바꾼 `Baegovda/BongChrome` main, cc801c1)
- BongTrans main ebd79e5 (PR #2 와이퍼 병합 포함, manifest 1.5.1)
- BongDC develop b8be749 (5.2.20 + PR #16 크롬 원클릭 업데이트)

## 한 일
- 뼈대는 BongDC(WXT 0.20 + Vue 3 + TS + Bun). 디시 코드는 `src/` 경로 그대로 (import 경로·`import.meta.glob` 때문에 옮기지 않음).
- 치지직: `src/modules/chzzk/` 순수 JS 그대로. 바뀐 것은 `chrome.storage.{sync,local,onChanged}` → `BCStore.*` 치환뿐 (로직 그대로, diff 확인함). `lib/ns.js` shim이 키 앞에 `chzzk.`를 붙임. 팝업에서 옛 업데이트 버튼/코드 제거. 업데이트용 lib(updates/installer/zip)와 그 테스트 제거.
- 치지직 콘텐츠 스크립트: 배경이 `registerContentScripts`(id `bongchrome-chzzk`, 옛 순서 + 맨 앞 ns.js, all_frames, document_idle)로 등록. 모듈 스위치 끄면 등록 해제.
- 번역: `src/modules/trans/`. 저장 키 `settings`→`trans.settings`, `cacheStats`→`trans.cacheStats`. 배경 코드는 `startTransBackground()`로 감싸 `background.ts`에서 호출. 주입 파일 `trans/content/content.js`. 단축키 리스너 삭제. 우클릭 메뉴는 디시 메뉴와 같이 `createContextMenus`에서 만듦(서로 `removeAll`로 지우던 충돌 해결). 모듈 꺼지면 번역 요청 거절. `lib/updates.js`는 안내만 하는 stub(화면 코드 그대로 두려고). 팝업의 업데이트 줄 숨김, 설정 버튼은 `trans/options/options.html` 탭 열기.
- 디시: 단축키(commands, ShortcutTab, onCommand) 제거. 팝업 → `entrypoints/dc/`(dc.html). 데이터 가져오기/백업/복원/초기화와 저장소 마이그레이션이 디시 키만 만지게 고침(`src/storage/namespace.ts`; 원래는 `storage.local.clear()`/`sync.clear()`로 다른 모듈 설정까지 지웠음).
- 업데이트: BongDC 방식 하나만. 저장소 `Baegovda/BongChrome`, 이름 확인 `BongChrome`, zip `bongchrome-X.Y.Z-chrome.zip`, 폴더 핸들 IndexedDB `bongchrome-install`. 번역 캐시 IndexedDB `page-translator`는 그대로.
- 새 팝업(`entrypoints/popup/`): 탭 치지직/번역/디시/업데이트·설정, 모듈 스위치(`core.modules`), 설정 내보내기·가져오기(`src/modules/settings-io.ts`).
- 릴리스: `.github/workflows/release.yml` (`v*` 태그). BongDC의 build.yml, ip-isp.yml은 뺐음.
- manifest: key 없음(새 ID), commands 없음, 권한 = 합집합, 호스트에 chzzk/api.chzzk/generativelanguage 추가. 파이어폭스 빌드는 안 함.

## 확인한 것 (박스, 2026-10-31)
- `bun run test`: bun 31개 + node 62개 통과.
- `bun run build`, `bun run zip`, `bun scripts/verify-release-zip.ts 1.0.0` 통과.
- Playwright Chromium 156(헤드리스)으로 실제 로드: 서비스 워커 오류 없음, commands 없음, 치지직 스크립트 13개 등록, 모듈 스위치로 등록 해제/재등록, 모든 페이지(popup, chzzk/popup, trans/popup, trans/options, dc, options, update) 오류 없이 뜸, 내보내기 파일 받아짐, 치지직 설정이 `chzzk.*`로 저장됨.
- chzzk.naver.com 실제 접속: 치지직 스크립트 붙음(`[BongChzzk] 비디오 감시 시작`, 스타일 주입). 로그인 안 해서 팔로잉은 401.
- gall.dcinside.com 실제 접속: 디시 모듈 동작(refresher 노드 49개), 콘솔 오류 없음.

## 확인 못 한 것
- 로그인한 실제 크롬에서: 치지직 라이브 재생 중 기능 전부, Gemini 키로 실제 번역, 디시 로그인 기능, 우클릭 메뉴 클릭.
- 원클릭 업데이트 끝까지(실제 릴리스가 아직 없음).
- 옛 BongTrans/BongDC 내보내기 파일로 실제 가져오기 (단위 테스트만).
- 번역을 치지직/디시 페이지에서 켰을 때 충돌 여부.
- TypeScript 타입 검사(원래 프로젝트에도 tsc가 없음; 빌드만 확인).

## 남은 문제
- BongChrome 저장소에는 BongChzzk 릴리스 v1.6.2 등이 남아 있음. v1.0.0 릴리스를 만들기 전까지 BongChrome 업데이트 확인이 "1.0.0 → 1.6.2 업데이트 가능"(zip 없음 오류)으로 보임. v1.0.0을 올리면 최신 릴리스가 바뀌어 해결되지만, 옛 BongChzzk 릴리스를 지우거나 정리하는 것도 고려.
- 옛 BongChzzk 1.6.2 업데이터는 이름 바뀐 저장소로 연결되는데 1.0.0 < 1.6.2라 "최신"으로 보고 아무것도 안 함 (안전, 대신 옮겨 가라는 안내는 없음).
- 아이콘은 BongDC 아이콘 그대로. IP 통신사 표는 계속 `Baegovda/BongDC` develop에서 받음(`src/utils/ipIsp.ts`).
- 옛 BongChzzk에는 내보내기가 없어 치지직 설정은 다시 해야 함.
