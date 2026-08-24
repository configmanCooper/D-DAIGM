@echo off
rem Stop the game and reclaim GPU memory. One shutdown implementation lives in
rem start.ps1; everything else forwards to it.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" -Stop %*

rem When double-clicked from Explorer there is no console to read afterwards,
rem so hold the window open long enough to see that the GPU was released.
echo %cmdcmdline% | find /i "/c" >nul
if not errorlevel 1 pause
