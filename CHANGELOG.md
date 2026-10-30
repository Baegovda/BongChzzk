# Changelog

BongChrome 변경 이력. GitHub **[Releases](https://github.com/Baegovda/BongChrome/releases)** 와 같이 갑니다.
설치 파일은 Releases의 `bongchrome-*-chrome.zip` 입니다 (Source code zip 아님).

옛 확장 이력: `docs/legacy/` (BongChzzk, BongTrans, BongDC).

---

## [1.0.0] - 2026-10-31

### 추가
- BongChzzk(치지직) 1.6.2, BongTrans(번역) 1.5.1, BongDC(디시) 5.2.20을 하나로 합친 첫 버전
- 팝업 하나에 탭 네 개: 치지직 / 번역 / 디시 / 업데이트·설정. 모듈마다 켜기·끄기 스위치
- 설정 내보내기·가져오기: BongChrome 파일, 옛 BongTrans 설정 파일, 옛 BongDC 데이터를 받음
- 업데이트는 하나로: 업데이트 확인 → 지금 업데이트 (압축 푼 BongChrome 폴더를 한 번만 고르면 다음부터 자동)

### 바뀐 점
- 단축키는 모두 뺐음 (Ctrl+Shift+Y, Alt+Shift+O, Alt+R, Alt+S, Alt+P). 필요하면 나중에 다시 넣음
- 번역 우클릭 메뉴 이름: "BongChrome: 페이지 번역 켜기/끄기"
- 새 확장 ID로 시작. 옛 확장 설정은 자동으로 넘어오지 않으니 내보내기·가져오기로 옮김
- 라이선스 GPL-3.0 (디시 모듈이 green1052/DCRefresher-Reborn 포크)
