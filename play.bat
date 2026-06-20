@echo off
title Eldenmoor launcher
cd /d "%~dp0"
echo.
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
