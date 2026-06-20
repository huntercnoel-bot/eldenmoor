@echo off
title Eldenmoor launcher (update + play)
cd /d "%~dp0"
echo.
echo   ==========================================
echo     Eldenmoor - update + play
echo   ==========================================
echo.

REM --- Step 1: grab the latest game code (only if this is a git clone) ------
where git >nul 2>nul
if errorlevel 1 (
  echo   [skip] Git isn't installed, so I can't auto-update.
  echo          That's fine - launching the game you already have.
  goto launch
)
if not exist ".git" (
  echo   [skip] This folder isn't a git clone, so there's nothing to pull.
  echo          Launching the game you already have.
  goto launch
)

echo   Checking for the latest version...
git pull origin main
if errorlevel 1 (
  echo.
  echo   [warn] Couldn't update ^(no internet, or you have local edits^).
  echo          Launching the version you already have.
) else (
  echo   Up to date!
)
echo.

:launch
REM --- Step 2: start the server and open the browser -----------------------
echo   Starting the Eldenmoor multiplayer server...
echo   A separate "server" window will open. Keep it open while you play,
echo   and close it when you are done.
echo.
start "Eldenmoor server" /D "%~dp0" cmd /c "py mpserver.py 8000"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000/"
echo   The game should now be open in your browser at:
echo       http://localhost:8000
echo.
echo   You can close THIS window. (Closing the OTHER window stops the game.)
echo.
pause
