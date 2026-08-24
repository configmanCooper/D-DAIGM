@echo off
rem Install the local Dungeon Master (the Ollama runtime and a model).
rem
rem The game plays perfectly well without this - the Offline narrator is
rem instant, and Copilot models work over the network. This is for running the
rem Dungeon Master on your own machine, free and offline.
rem
rem The weights are gigabytes and are deliberately not in the repository, which
rem is why they are fetched rather than cloned.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-ai.ps1" %*

rem When double-clicked from Explorer there is no console left to read, and
rem this script has things worth reading.
rem Quoted: this game lives in a folder called "D&D Simulator", and an
rem unquoted %cmdcmdline% hands that ampersand to the command parser, which
rem then tries to run a program called D. Quoting it keeps the & literal.
echo "%cmdcmdline%" | find /i "/c" >nul
if not errorlevel 1 pause
