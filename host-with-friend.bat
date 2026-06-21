@echo off
REM Play Eldenmoor with a friend RIGHT NOW over the internet - no accounts, no deploy.
REM Requires cloudflared.exe next to this file
REM (download: https://github.com/cloudflare/cloudflared/releases - get cloudflared-windows-amd64.exe, rename to cloudflared.exe).
REM
REM   1) Double-click this file.
REM   2) A https://something.trycloudflare.com URL appears.
REM      Send it to your friend. You BOTH open it, create accounts, and play.
REM   Keep this window open while you play. Close it to stop.
start "Eldenmoor server" py mpserver.py 8000
timeout /t 2 >nul
cloudflared.exe tunnel --url http://localhost:8000
