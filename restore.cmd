@echo off
rem ============================================================================
rem  restore.cmd - go back to an earlier version of the game
rem ============================================================================
rem
rem  Double-click this to SEE what you can go back to. It changes nothing on
rem  its own, so it is always safe to run.
rem
rem  From a command prompt you can pass the same arguments as restore.ps1:
rem
rem     restore.cmd -List
rem     restore.cmd -Checkpoint optimized
rem     restore.cmd -Commit 3aa3fb6
rem     restore.cmd -Back 1
rem     restore.cmd -Backup optimized
rem     restore.cmd -Latest
rem
rem  Open restore.ps1 in a text editor for the full instructions.
rem ============================================================================
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0restore.ps1" %*

rem When double-clicked from Explorer there is no console left to read, so hold
rem the window open. Quoted because this game lives in a folder with an
rem ampersand in its name, which an unquoted %cmdcmdline% hands to the parser.
echo "%cmdcmdline%" | find /i "/c" >nul
if not errorlevel 1 pause
