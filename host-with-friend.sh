#!/usr/bin/env bash
# Play Eldenmoor with a friend RIGHT NOW over the internet — no accounts, no deploy.
# Requires `cloudflared` (one free binary: https://github.com/cloudflare/cloudflared/releases).
#
#   1) chmod +x host-with-friend.sh   (first time only)
#   2) ./host-with-friend.sh
#   3) Cloudflare prints a https://something.trycloudflare.com URL.
#      Send it to your friend. You BOTH open it, create accounts, and play.
#   Keep this window open while you play. Ctrl+C to stop.
set -e
python3 mpserver.py 8000 &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null" EXIT
sleep 2
echo "==> Game server running. Opening a public tunnel..."
cloudflared tunnel --url http://localhost:8000
