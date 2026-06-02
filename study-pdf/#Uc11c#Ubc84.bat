@echo off
chcp 65001 > nul
title 웹페이지 PDF 변환기

echo.
echo  ╔══════════════════════════════════════╗
echo  ║     웹페이지 PDF 변환기              ║
echo  ╚══════════════════════════════════════╝
echo.

set PYTHON=C:\Users\user\AppData\Local\Programs\Python\Python311\python.exe
set APP_DIR=%~dp0

cd /d "%APP_DIR%"

:: Python 확인
if not exist "%PYTHON%" (
    echo  [오류] Python을 찾을 수 없습니다.
    echo  경로: %PYTHON%
    pause
    exit /b 1
)

:: 포트 8000 기존 프로세스 종료
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    echo  이미 실행 중인 서버를 종료합니다...
    taskkill /f /pid %%a > nul 2>&1
    timeout /t 1 /nobreak > nul
)

:: 4초 후 브라우저 자동 열기 (백그라운드 cmd)
start /b cmd /c "timeout /t 4 /nobreak >nul 2>&1 && start http://localhost:8000"

echo  서버를 시작합니다...
echo  4초 후 브라우저가 자동으로 열립니다.
echo.
echo  ──────────────────────────────────────
echo   주소 : http://localhost:8000
echo   종료 : 이 창을 닫거나 Ctrl+C
echo  ──────────────────────────────────────
echo.

:: 서버 실행 (포그라운드 — 서버 로그 표시)
"%PYTHON%" "%APP_DIR%app.py"

echo.
echo  서버가 종료되었습니다. 아무 키나 누르면 창이 닫힙니다.
pause > nul
