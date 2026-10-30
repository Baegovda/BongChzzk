@echo off
chcp 65001 >nul
title BongChrome - 개발 테스트
cd /d "%~dp0"

where bun >nul 2>&1
if errorlevel 1 (
    if exist "%USERPROFILE%\.bun\bin\bun.exe" (
        set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
    ) else (
        echo [오류] bun이 설치되어 있지 않습니다.
        echo 터미널에서: npm install -g bun
        pause
        exit /b 1
    )
)

echo ========================================
echo   BongChrome  개발 테스트
echo ========================================
echo.
echo  * Cursor에서 F5 눌러도 동일하게 실행됩니다
echo  * Chrome + 디시가 자동으로 열립니다
echo  * 켜 둔 채로 디시에서 F5 = 최신 반영 확인
echo  * 종료: 이 창을 닫으세요
echo.

if not exist "node_modules\" (
    echo [1/2] 의존성 설치 중...
    bun install
    if errorlevel 1 (
        echo 설치 실패
        pause
        exit /b 1
    )
)

echo [2/2] 개발 서버 시작...
echo.
bun dev

echo.
echo 개발 서버가 종료되었습니다.
pause
