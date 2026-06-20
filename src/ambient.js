// ambient.js — overheard idle chatter. Self-contained "ambient life" layer.
//
// Periodically, NPCs standing near the player murmur a short in-character idle
// line as a small floating speech bubble above their head. Bubbles are DOM
// nodes created in JS (class `.npc-bubble`), positioned every frame by
// projecting the NPC's head world-position to screen — the same technique
// `updateNpcLabels` (npc.js) and `questmarkers.js` use (head at y ≈ 2.7, a touch
// above the name label). Bubbles fade in, linger, then fade out.
//
// Lines are sourced from each NPC's existing `userData.def` (greeting, topic
// answers, dialogue, flavor) where possible, lightly trimmed, plus a tasteful
// per-role default pool so even sparse NPCs have something to mutter. Timing is
// staggered per-NPC so the square feels alive rather than spammy.
//
// Integration is a single `import './ambient.js';` in main.js — this module
// polls for `window.eldenmoor`, then runs its own rAF loop. It never edits the
// scene, the NPCs, or any other system; it only reads positions and the camera.

(function () {
  'use strict';

  // --- tuning knobs -----------------------------------------------------------
  const NEAR_DIST = 16;        // only NPCs within this many world units may chatter
  const MAX_ACTIVE = 4;        // at most this many bubbles on screen at once
  const MIN_GAP = 5.5;         // min seconds between an NPC's own lines
  const RND_GAP = 9.0;         // + up to this much random extra
  const SHOW_TIME = 3.6;       // seconds a bubble stays fully visible
  const FADE_TIME = 0.6;       // fade in / out duration (seconds)
  const HEAD_Y = 2.85;         // world height to project (just above name + marker)
  const GLOBAL_GAP = 1.6;      // min seconds between ANY two NPCs piping up

  // --- per-role default chatter pools (OSRS-flavoured, kept short) ------------
  // Picked by a coarse role guess from the def; merged with the NPC's own lines.
  const ROLE_POOLS = {
    guard: [
      '*sigh*', 'Move along.', 'All quiet on the wall.', 'Eleven years on this post...',
      'No, you cannot try the helmet.', 'Keep the peace, now.', 'Hup. Two. Hup. Two.',
      'My feet are killing me.',
    ],
    king: [
      'A king\'s work is never done.', 'Ah, the burdens of the crown.',
      'Where is that steward?', 'The realm endures.',
    ],
    royal: [
      'The ledgers will not balance themselves.', 'Mind the grain stores.',
      'Hmph. Heroes.', 'So much to plan, so little sleep.',
    ],
    shop: [
      'Best wares in Eldenmoor!', 'Come, have a look.', 'Buy something, won\'t you?',
      'A coin\'s a coin.', 'Right-click to trade!', 'Browsing\'s free...',
    ],
    smith: [
      '*clang* *clang*', 'Mind the sparks.', 'Hot work, this.', 'Good steel, that.',
      'Stand back a bit.',
    ],
    drunk: [
      'Hic!', 'Gold in that cellar, I swear it...', 'Gho... ghosts, I tell ye.',
      'Just one more, Bram...', 'Buy old Saul a drink?', '*hiccup*',
      'I\'m not drunk, YOU\'re drunk.',
    ],
    child: [
      'Betcha can\'t catch me!', 'Wanna race?', 'Tag, you\'re it!', 'Wheee!',
      'I\'m gonna be an adventurer!', 'Are YOU scared? \'Cause I\'m not.',
      'This is boring.',
    ],
    farmer: [
      'Good harvest this year.', 'Off you pop now.', 'Round and round the windmill goes.',
      'Get off my field!', 'Wheat\'s up to my chest.',
    ],
    cook: [
      'Mind the oven, dear.', 'Hot bread coming through!', 'Flour to my elbows...',
      'Burnt it again. Rustic, I\'ll call it.',
    ],
    nun: [
      'Peace be with you.', 'The Light watches over us.', 'Do wipe your boots.',
      'Light a candle, traveller.',
    ],
    jailer: [
      'Quiet down in there!', 'Twenty-three keys... or was it two?', 'Grim work, this.',
      'Stay in your cell.',
    ],
    prisoner: [
      'Psst... get me out?', 'I\'m innocent, I am!', 'The goat had it coming.',
      'Worth a try...', 'It\'s cold in here.',
    ],
    townsfolk: [
      'Lovely day, isn\'t it?', 'Grand town, this.', 'Mind the fountain.',
      'Did you hear about the cellar?', 'Mostly pigeons round here.',
      'The King keeps us safe.',
    ],
  };

  // Map an NPC def to a coarse role key for ROLE_POOLS.
  function roleKey(def) {
    const id = def.id || '';
    if (def.crown) return 'king';
    if (def.guard) return 'guard';
    if (id === 'duke' || id === 'advisor') return 'royal';
    if (id === 'smith') return 'smith';
    if (id === 'cook') return 'cook';
    if (id === 'nun') return 'nun';
    if (id === 'farmer') return 'farmer';
    if (id === 'child') return 'child';
    if (id === 'jailer') return 'jailer';
    if (id === 'prisoner') return 'prisoner';
    if (id === 'patron1') return 'drunk';
    if (def.type === 'shop' || id === 'banker') return 'shop';
    return 'townsfolk';
  }

  // Pull a few of the NPC's *own* lines from its def, lightly trimmed so they
  // read as quick mutters rather than full speeches.
  function ownLines(def) {
    const out = [];
    const push = (s) => {
      if (typeof s !== 'string') return;
      let t = s.trim();
      if (!t) return;
      // Take only the first sentence-ish fragment for brevity.
      const cut = t.search(/(?<=[.!?…])\s/);
      if (cut > 0 && cut < 60) t = t.slice(0, cut + 1).trim();
      if (t.length > 64) t = t.slice(0, 62).trim() + '…';
      out.push(t);
    };
    if (Array.isArray(def.dialogue)) def.dialogue.forEach(push);
    if (typeof def.flavor === 'string') push(def.flavor);
    if (Array.isArray(def.topics)) {
      for (const tp of def.topics) {
        const a = tp && tp.a;
        if (Array.isArray(a)) a.forEach(push);
        else push(a);
      }
    }
    return out;
  }

  // Build the final, de-duplicated chatter pool for one NPC.
  function buildPool(def) {
    const role = ROLE_POOLS[roleKey(def)] || ROLE_POOLS.townsfolk;
    const mine = ownLines(def);
    const seen = new Set();
    const pool = [];
    for (const s of [...role, ...mine]) {
      const k = s.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      pool.push(s);
    }
    return pool.length ? pool : ['...'];
  }

  // --- bubble DOM -------------------------------------------------------------
  function makeBubble() {
    const el = document.createElement('div');
    el.className = 'npc-bubble';
    // Minimal inline styling so bubbles read out of the box; the UI agent can
    // override everything via the `.npc-bubble` class.
    el.style.cssText =
      'position:fixed;z-index:90;pointer-events:none;' +
      'transform:translate(-50%,-100%);' +
      'max-width:190px;padding:5px 10px;border-radius:12px;' +
      'font:italic 13px/1.25 Georgia,serif;text-align:center;white-space:normal;' +
      'color:#2a2018;background:rgba(244,236,214,0.95);' +
      'border:1px solid rgba(90,70,40,0.7);' +
      'box-shadow:0 2px 6px rgba(0,0,0,0.4);' +
      'opacity:0;transition:opacity ' + FADE_TIME + 's ease;will-change:left,top,opacity;';
    document.body.appendChild(el);
    return el;
  }

  // --- main wiring ------------------------------------------------------------
  function start(game) {
    const npcs = game.npcs || [];
    if (!npcs.length) { setTimeout(() => start(game), 1000); return; }

    // Per-NPC chatter bookkeeping.
    const state = npcs.map((n) => ({
      n,
      pool: buildPool(n.def),
      next: performance.now() / 1000 + Math.random() * (MIN_GAP + RND_GAP),
      bubble: null,   // { el, until, fading, removeAt }
      last: -1,       // index of last line shown (avoid immediate repeats)
    }));

    let lastGlobal = 0;

    function camera() { return game.camera; }
    function playerPos() {
      const p = game.player;
      if (p && p.position) return p.position;
      if (p && p.group && p.group.position) return p.group.position;
      return { x: 0, z: 0 };
    }

    // Project a world (x, HEAD_Y, z) point to NDC using the live camera's
    // matrices (no THREE dependency required).
    const _v = { x: 0, y: 0, z: 0 };
    function project(cam, wx, wz) {
      if (cam && cam.matrixWorldInverse && cam.projectionMatrix) {
        const view = mulMV(cam.matrixWorldInverse.elements, wx, HEAD_Y, wz, 1);
        const clip = mul(cam.projectionMatrix.elements, view);
        const w = clip[3] || 1e-6;
        _v.x = clip[0] / w; _v.y = clip[1] / w; _v.z = clip[2] / w;
        return _v;
      }
      return null;
    }

    // 4x4 (column-major, THREE style) * (x,y,z,w) -> [x,y,z,w]
    function mulMV(e, x, y, z, w) {
      return [
        e[0] * x + e[4] * y + e[8] * z + e[12] * w,
        e[1] * x + e[5] * y + e[9] * z + e[13] * w,
        e[2] * x + e[6] * y + e[10] * z + e[14] * w,
        e[3] * x + e[7] * y + e[11] * z + e[15] * w,
      ];
    }
    // 4x4 (column-major) * vec4 -> vec4
    function mul(e, v) {
      return [
        e[0] * v[0] + e[4] * v[1] + e[8] * v[2] + e[12] * v[3],
        e[1] * v[0] + e[5] * v[1] + e[9] * v[2] + e[13] * v[3],
        e[2] * v[0] + e[6] * v[1] + e[10] * v[2] + e[14] * v[3],
        e[3] * v[0] + e[7] * v[1] + e[11] * v[2] + e[15] * v[3],
      ];
    }

    function activeCount() {
      let c = 0;
      for (const s of state) if (s.bubble) c++;
      return c;
    }

    function speak(s, now) {
      const pool = s.pool;
      let i = (Math.random() * pool.length) | 0;
      if (pool.length > 1 && i === s.last) i = (i + 1) % pool.length;
      s.last = i;
      const el = makeBubble();
      el.textContent = pool[i];
      void el.offsetWidth;            // force reflow so the fade-in transition runs
      el.style.opacity = '1';
      s.bubble = { el, until: now + SHOW_TIME, fading: false, removeAt: 0 };
    }

    function positionBubble(cam, el, n) {
      const sp = project(cam, n.group.position.x, n.group.position.z);
      if (!sp || sp.z > 1 || sp.x < -1.1 || sp.x > 1.1) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      el.style.left = (sp.x * 0.5 + 0.5) * window.innerWidth + 'px';
      el.style.top = (-sp.y * 0.5 + 0.5) * window.innerHeight + 'px';
    }

    function tick() {
      const cam = camera();
      const now = performance.now() / 1000;
      const pp = playerPos();

      for (const s of state) {
        const n = s.n;
        const visible = n.group && n.group.visible;

        // Drive an existing bubble: position it, handle fade-out + cleanup.
        if (s.bubble) {
          const b = s.bubble;
          if (!b.fading && now >= b.until) {
            b.fading = true;
            b.el.style.opacity = '0';
            b.removeAt = now + FADE_TIME + 0.05;
          }
          if (b.fading && now >= b.removeAt) {
            b.el.remove();
            s.bubble = null;
          } else if (!visible) {
            // NPC culled / on another floor mid-bubble: drop it immediately.
            b.el.remove();
            s.bubble = null;
          } else {
            positionBubble(cam, b.el, n);
          }
        }

        if (!visible) continue;

        // Distance gate (cheap 2D check on the floor plane).
        const dx = n.group.position.x - pp.x;
        const dz = n.group.position.z - pp.z;
        const near = (dx * dx + dz * dz) <= NEAR_DIST * NEAR_DIST;

        // Decide whether to start a new line.
        if (!s.bubble && near && now >= s.next) {
          if (activeCount() < MAX_ACTIVE && (now - lastGlobal) >= GLOBAL_GAP) {
            // Only speak if the head actually projects on-screen.
            const sp = project(cam, n.group.position.x, n.group.position.z);
            if (sp && sp.z <= 1 && sp.x >= -1.05 && sp.x <= 1.05 && sp.y >= -1.05 && sp.y <= 1.05) {
              speak(s, now);
              lastGlobal = now;
            }
          }
          // Re-arm regardless, so we don't hammer the checks every frame.
          s.next = now + MIN_GAP + Math.random() * RND_GAP;
        }
      }

      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
    if (window.console) console.log('[ambient] chatter online for', npcs.length, 'NPCs');
  }

  // Poll for the game to come up, then start.
  function waitForGame() {
    const g = window.eldenmoor;
    if (g && g.camera && Array.isArray(g.npcs)) { start(g); return; }
    setTimeout(waitForGame, 500);
  }
  waitForGame();
})();
