# Playing Eldenmoor with a friend

The game's **Play Solo** button works anywhere (it's just the static site on GitHub
Pages). **Multiplayer needs a running server** — `mpserver.py` — because GitHub Pages
can only host static files, not a live game server.

`mpserver.py` is pure Python (standard library only — nothing to install) and serves
**both the game files and the multiplayer WebSocket on one address**. Whoever you both
connect to, you'll be in the same world: make accounts, log in, see each other move
and chat.

---

## ✅ Recommended: deploy to Render (free, browser-only, always-on)

No command line, nothing to download, and the server stays up even when your PC is off.

### One-click

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/huntercnoel-bot/eldenmoor)

1. Click the button above (or go to https://render.com/deploy?repo=https://github.com/huntercnoel-bot/eldenmoor).
2. Sign in to Render — you can use your **GitHub account** (free, ~30 seconds).
3. Render reads **`render.yaml`** and fills everything in. Click **Apply / Create**.
4. Wait ~1–2 minutes for the first build. You'll get a URL like
   `https://eldenmoor.onrender.com`.
5. **That URL is your game.** You and your friend both open it, click **Create
   account**, then **Log in** — and you're in the same world.

### If you'd rather click through manually
**New ➜ Web Service ➜** connect the `eldenmoor` repo. Render detects `render.yaml`; if
it asks, set **Runtime: Python**, **Build: `pip install -r requirements.txt`**,
**Start: `python mpserver.py`**, **Plan: Free**. Deploy.

> **Accounts persist:** the blueprint also provisions a **free Postgres database** and
> wires it up automatically, so accounts and friends survive restarts and redeploys —
> they won't reset.
>
> **Free-tier note:** the web service "sleeps" after ~15 min idle, so the first visit
> after a quiet spell takes ~30s to wake. (Render's free database is free for a limited
> window; if you want it permanent forever, use a free **Neon**/**Supabase** Postgres and
> set its connection string as the `DATABASE_URL` env var — same code, just a different
> database. Tell me and I'll walk you through it.)

---

## ⚡ Alternative: play right now via a Cloudflare tunnel (no signup)

Best for a one-off session tonight. The server runs on **your** PC; a tunnel gives it a
public link.

1. Install **Python** (tick *"Add to PATH"*): https://www.python.org/downloads/
2. Download **cloudflared** (one file, no account) into this folder:
   https://github.com/cloudflare/cloudflared/releases
   (Windows: get `cloudflared-windows-amd64.exe`, rename to `cloudflared.exe`.)
3. Run **`host-with-friend.bat`** (Windows) or **`./host-with-friend.sh`** (Mac/Linux).
4. It prints a `https://….trycloudflare.com` link — **send it to your friend.** You both
   open it, make accounts, log in. Keep the window open while you play.

(There's also a `Dockerfile` for Fly.io / Railway / any Docker host — start command
`python mpserver.py`.)

---

## What works in multiplayer today
- Accounts (register / log in — passwords are hashed).
- See other players move around the world in real time.
- Who's online, join/leave notices.
- World chat and private messages, plus a friends list.

Same world, same town and castle, same everything you've been building.
