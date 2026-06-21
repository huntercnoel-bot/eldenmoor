# Playing Eldenmoor with a friend

The game's **Play Solo** button works anywhere (it's just the static site on GitHub
Pages). **Multiplayer needs a running server** — `mpserver.py` — because GitHub Pages
can only host static files, not a live game server.

`mpserver.py` is pure Python (standard library only — nothing to install) and serves
**both the game files and the multiplayer WebSocket on one address**. So whoever you
both connect to, you'll be in the same world: make accounts, log in, and you'll see
each other move and chat.

You have two ways to get your friend in. Pick one.

---

## Option A — Play right now (free, no signup): a Cloudflare tunnel

Best for a quick session. The server runs on **your** PC and a tunnel gives it a
public link you send to your friend.

1. **Get Python** (if you don't have it): https://www.python.org/downloads/ — during
   install tick *"Add Python to PATH"*.
2. **Get cloudflared** (one small file, no account):
   https://github.com/cloudflare/cloudflared/releases
   - Windows: download `cloudflared-windows-amd64.exe`, rename it to `cloudflared.exe`,
     and put it in this folder (next to `host-with-friend.bat`).
   - Mac/Linux: `brew install cloudflared` (or download the binary).
3. **Start it:**
   - Windows: double-click **`host-with-friend.bat`**
   - Mac/Linux: run **`./host-with-friend.sh`**
4. A line like `https://red-sky-1234.trycloudflare.com` appears. **Send that link to
   your friend.** You both open it, click **Create account**, then **Log in** — and
   you're in the same world.
5. Keep that window open while you play. Close it (or Ctrl+C) to stop.

> The link changes every time you start it, so just resend the new one. Your friend
> needs nothing installed — only the link.

---

## Option B — An always-on server (free): deploy to Render

Best if you want a server that's up even when your PC is off. ~5 minutes once.

1. Go to https://render.com and sign up (you can use your GitHub account — free).
2. **New ➜ Web Service**, and connect this repository (`eldenmoor`).
3. Render reads **`render.yaml`** automatically. If it asks, set:
   - **Runtime:** Python
   - **Start command:** `python mpserver.py`
   - **Plan:** Free
4. Click **Deploy**. After a minute you get a URL like
   `https://eldenmoor.onrender.com`.
5. **That URL is your game.** You and your friend both open it, make accounts, log in,
   and play together.

> Notes on the free tier: the server "sleeps" after ~15 min idle, so the first visit
> after a quiet spell takes ~30s to wake up. Accounts can reset if the service
> restarts/redeploys — fine for messing around; tell me if you want accounts to
> persist and I'll wire up a database.

(There's also a `Dockerfile` if you'd rather use Fly.io, Railway, or any Docker host —
the start command is just `python mpserver.py`.)

---

## What works in multiplayer today
- Accounts (register / log in — passwords are hashed).
- See other players move around the world in real time.
- Who's online, join/leave notices.
- World chat and private messages, plus a friends list.

Same world, same town and castle, same everything you've been building.
