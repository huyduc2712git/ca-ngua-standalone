@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Can cai Node.js 22 tro len. Sau do mo lai start.bat.
  pause
  exit /b 1
)
node server.mjs
pause
