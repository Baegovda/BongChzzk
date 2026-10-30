# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
