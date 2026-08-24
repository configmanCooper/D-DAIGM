@echo off
rem AETHERTABLE launcher. Uses PowerShell when available (which is where all the
rem real logic lives), and falls back to a bare node start if it is not.
cd /d "%~dp0"

where powershell >nul 2>nul
if %ERRORLEVEL%==0 (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
  goto :eof
)

echo   PowerShell was not found - starting the plain way.
echo.
start "" http://127.0.0.1:8177/
node server.js
