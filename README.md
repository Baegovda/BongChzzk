# BongExtend

치지직, 디시인사이드, 페이지 번역 기능을 하나로 합친 크롬 확장 프로그램이에요.
예전에 따로 쓰던 **BongChzzk**(치지직), **BongTrans**(번역), **BongDC**(디시)를 합쳤어요.

## 설치
1. [Releases](https://github.com/Baegovda/BongExtend/releases)에서 `bongextend-버전-chrome.zip`을 받아요 (Source code zip 아님).
2. 압축을 풀어요. 이 폴더가 설치 폴더예요. 지우거나 옮기지 마세요.
3. 크롬 주소창에 `chrome://extensions` → 오른쪽 위 **개발자 모드** 켜기 → **압축해제된 확장 프로그램을 로드합니다** → 푼 폴더를 골라요.
4. 옛 BongChzzk, BongTrans, BongDC는 설정을 옮긴 뒤 지워요 (같이 켜 두면 기능이 두 번 돌아요).

## 팝업
툴바의 BongExtend 아이콘을 누르면 탭 네 개가 나와요.
- **치지직**: 버퍼링 자동 복구, 1080p 고정, 선명한 화면, 넓은 화면 자동, 시청자 수 표시, 랭킹 가리기, 채팅 글씨 크기, 방향키 이동, 팔로잉 새로고침, 관심 스트리머 자동 이동, 광고 방지(실험적)
- **번역**: 이 페이지 번역 켜기/끄기 (Gemini API 키 필요, 설정 버튼에서 입력). 우클릭 메뉴 "BongExtend: 페이지 번역 켜기/끄기"도 있어요.
- **디시**: 글 목록 새로고침, 미리보기, 차단, 메모, 레이아웃 등 BongDC 기능 전부
- **업데이트·설정**: 업데이트 확인과 지금 업데이트, 설정 내보내기·가져오기

탭마다 위쪽에 **모듈 사용** 스위치가 있어요. 끄면 그 기능이 통째로 꺼져요 (열려 있던 페이지는 새로고침하면 적용).

## 업데이트
업데이트·설정 탭 → **업데이트 확인** → **지금 업데이트**. 새 탭이 열리면 처음 한 번만 압축을 푼 BongExtend 폴더(manifest.json이 있는 곳)를 골라요. 다음부터는 바뀐 파일만 넣고 확장을 다시 켜요. 열려 있던 치지직·디시 탭은 Ctrl+F5로 새로고침해 주세요.

## 옛 확장에서 설정 옮기기
확장 ID가 새로 바뀌어서 설정이 자동으로 넘어오지 않아요.
- **BongTrans**: 옛 BongTrans 설정 → 설정 내보내기로 받은 `bongtrans-settings.json`을 BongExtend 업데이트·설정 탭 → **설정 가져오기(파일)** 로 넣어요. (Gemini 키도 같이 넘어와요)
- **BongDC**: 옛 BongDC 팝업 → 데이터 → **내보내기**(클립보드로 복사) → BongExtend 업데이트·설정 탭 → **붙여넣어 가져오기**에 붙여 넣어요.
- **BongChzzk**: 옛 확장에 내보내기 버튼이 없어서 치지직 탭에서 다시 설정해 주세요 (관심 스트리머 목록 포함).

## 단축키
지금은 없어요. 필요하면 요청해 주세요.

## 개발
`bun install` → `bun run test` → `bun run build` (결과: `.output/chrome-mv3/`). 자세한 건 `AGENTS.md`, `MERGE_NOTES.md`.

## 라이선스
GPL-3.0. 디시 모듈은 [green1052/DCRefresher-Reborn](https://github.com/green1052/DCRefresher-Reborn)을 바탕으로 해요.
