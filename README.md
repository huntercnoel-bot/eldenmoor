# ⚔️ Eldenmoor

A browser game in the spirit of **Old School RuneScape** (skills, quests, open world)
with the **stylized look of World of Warcraft**.

This is **Milestone 1**: a small zone you can walk around. Built with plain
JavaScript + [Three.js](https://threejs.org) — no build tools, no installs beyond
Python (which you already have). You can read every line.

---

## ▶️ How to play (easiest way)

**Double-click `play.bat`.** It starts a tiny local web server and opens the game
in your browser. A small black *"server"* window appears — **keep it open while you
play**, and **close it to stop**.

> First time it may flash an error — just wait a second and refresh. The server
> needed a moment to wake up.

> **Pulled this from GitHub?** Double-click **`update-and-play.bat`** instead — it
> grabs the latest version (`git pull`) *and* launches the game in one click. If
> Git isn't installed or this isn't a clone, it just launches what you have.

### Or run it yourself from a terminal
1. Open a terminal in this folder (Shift + Right-click → *Open in Terminal*).
2. Run: `py -m http.server 8000`
3. Open your browser to **http://localhost:8000**

*(Why a server? Browsers refuse to load modern JavaScript files straight off your
hard drive for security reasons — they need an `http://` address.)*

---

## 🎮 Controls
- **W A S D** or **Arrow keys** — walk
- **Click + drag** the mouse — turn the camera around your hero
- **Scroll wheel** — zoom in / out

Your X/Z position shows in the top-right. Go visit the pond, weave through the
autumn trees, and watch your hero's shadow shift as they move.

---

## 🗂️ What each file does
- **`index.html`** — the web page: loads the game and shows the on-screen HUD (title, controls, coordinates).
- **`vendor/three.module.js`** — the Three.js 3D engine, kept **locally** so the game needs no internet.
- **`src/main.js`** — the heart: sets up the screen and runs the game loop.
- **`src/world.js`** — builds the zone: sky, fog, sunlight, ground, trees, rocks, grass.
- **`src/player.js`** — builds your blocky hero and animates the walk.
- **`src/controls.js`** — keyboard + mouse, moves the hero, floats the camera.

---

## 🔧 Want to tinker?
Change a number, **save, and refresh the browser**:
- `src/controls.js` → `const SPEED = 6.5;` → `12` for sprint mode.
- `src/world.js` → ground color `0x6f7c3c` → `0x8fbcff` for an icy field.
- `src/world.js` → tree count `i < 42` → `i < 120` for a dense forest.
- `src/player.js` → cape color `0xa83232` → `0x33aa55` for a green cloak.

*(Colors are hex codes, `0xRRGGBB`, just like web colors.)*

---

## 🗺️ Roadmap
- [x] **M1 — Walk a zone** ← you are here
- [ ] **M2 — A skill:** chop a tree, watch XP and a level rise (OSRS-style)
- [ ] **M3 — Combat:** click a monster, trade hits, gain XP and loot
- [ ] **M4 — A quest:** talk to an NPC, get a task, claim a reward
- [ ] **M5 — Inventory & UI**, then saving, then more of Eldenmoor…

A learning project — we grow it one small, working piece at a time.
