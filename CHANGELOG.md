# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-10-30

### Added

- 팔로잉 채널 자동 새로고침: 탭이 보이는 동안 사이드바 "팔로잉 채널"(또는 /following 페이지)을 페이지 새로고침 없이 기본 5초마다 갱신합니다(간격 5/10/30/60초, 실패 시 최대 5분까지 백오프).
- 선명한 화면 항상 켜기: 플레이어의 "선명한 화면"이 꺼져 있으면 켭니다(10초에 한 번까지 확인, 방송/광고 후 재초기화 시 재적용).
- 채팅 헤더 시청자 수: 채팅 제목 옆에 "👁 1,234명" 형식으로 동시 시청자 수를 1초마다 표시합니다.
- 플레이어 시청자 수 오버레이: 플레이어 왼쪽 위에 시청자 수 배지를 표시합니다(전체화면 포함).
- 주간 랭킹 가리기: 채팅창 위 주간/파워 랭킹 위젯을 숨깁니다.
- 채팅 글씨 크기: 채팅 글씨 크기를 12~28px로 바꿀 수 있습니다(기본은 변경 안 함).
- 방향키 이동: ← / → 로 5초 뒤로/앞으로 이동합니다(5/10/15/30초 선택, 채팅 입력 중에는 동작 안 함, 라이브는 되감기 가능 범위와 라이브 끝 사이로 제한).

### Fixed

- 화질 고정이 동작하지 않던 문제를 고쳤습니다. 실제 플레이어 구조(`.pzp-pc-setting-button`, `.pzp-pc-setting-intro-quality`, `li.pzp-ui-setting-quality-item`)에 맞추고, 항목 선택을 Enter 키 입력으로 바꿨습니다. 새 방송, 광고 종료 후 플레이어 재초기화, 페이지 이동 때마다 다시 적용합니다.

## [1.2.0] - 2026-10-30

### Added

- 화질 1080p 고정: 라이브/다시보기에서 플레이어 설정 메뉴를 (보이지 않게) 열어 1080p를 자동 선택합니다. 1080p가 없으면 그 아래 가장 높은 화질을 고릅니다. 3초마다 확인해 바뀌면 다시 적용하고, 버퍼링 복구 후에도 다시 적용합니다.
- 팝업에 **화질 1080p 고정**(기본 켜짐)과 **고정 화질**(1080p/720p/480p/360p) 설정을 추가했습니다. 직접 화질을 바꾸면 10분간은 간섭하지 않습니다.

## [1.1.1] - 2026-10-30

### Removed

- 저장소가 공개로 전환되어 팝업의 비공개용 GitHub 토큰 입력칸과 관련 저장/인증 헤더를 제거했습니다. 업데이트 확인은 인증 없이 동작합니다.

## [1.1.0] - 2026-10-30

### Added

- 팝업에 **업데이트 확인**, **확장 프로그램 관리** 버튼을 추가했습니다. `https://api.github.com/repos/Baegovda/BongChzzk/releases/latest`를 확인하고, 새 버전이 있으면 **릴리스 페이지** / **zip 다운로드** 버튼을 보여 줍니다. (BongTrans와 같은 방식)
- `v*` 태그를 푸시하면 `.github/workflows/release.yml`이 테스트, manifest 버전 확인, `bongchzzk-<version>.zip` 빌드, CHANGELOG 발췌로 GitHub Release를 만듭니다.

## [1.0.0] - 2026-10-29

### Added

- 치지직 무한 버퍼링 감지 후 페이지 새로고침 없이 플레이어 단계별 자동 복구.

[1.2.0]: https://github.com/Baegovda/BongChzzk/releases/tag/v1.2.0
[1.1.0]: https://github.com/Baegovda/BongChzzk/releases/tag/v1.1.0
[1.0.0]: https://github.com/Baegovda/BongChzzk/releases/tag/v1.0.0
