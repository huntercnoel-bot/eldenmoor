// minimap.js — an OSRS-style circular minimap, fixed top-right.
//
// Self-contained and self-initializing: it polls for window.eldenmoor (set up by
// main.js when the game starts), then draws a top-down 2D radar centred on the
// hero. "Up" on the map is wherever the hero faces (OSRS behaviour), so it spins
// with you. Monsters and NPCs show as coloured blips; a bronze ring frames it
// with a small "N" compass marker.
//
// Pure canvas 2D — no dependencies, no assets. Activated by one line in main.js:
//   import './minimap.js';
//
// Everything is wrapped in try/catch and throttled to ~20fps so it's cheap and
// never throws if the game object isn't ready yet.
//
// NOTE: index.html ships a small decorative #minimap dial wired by ui.js. This
// module supersedes it (richer: monster blips + a compass), so on first paint it
// hides that legacy dial. We use our own #em-minimap id to avoid any clash, and
// touch no other file (only the one import line in main.js).

(function () {
  const DIAM = 150;                 // minimap diameter in CSS px
  const R = DIAM / 2;               // radius
  const SCALE = 1.6;                // world-units -> px (≈ a 47-unit radius shown)
  const FPS = 20;                   // throttle
  const FRAME_MS = 1000 / FPS;

  // Hide the legacy decorative dial (index.html #minimap + its coords pill) so
  // our richer minimap stands alone in the top-right. Safe no-op if absent.
  function hideLegacyDial() {
    try {
      for (const id of ['minimap', 'minimap-coords']) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      }
    } catch (e) { /* ignore */ }
  }

  // Palette pulled from the game's stone/bronze UI (index.html CSS vars).
  const COL = {
    ground: '#243016',             // dark parchment-green ground
    groundEdge: '#1a2410',
    ringOuter: '#2c1d0e',          // --bronze-dark
    ring: '#7a5a2c',               // --bronze
    ringLit: '#c79a52',            // --bronze-lit
    gold: '#ffd277',               // --gold
    goldBright: '#ffe6a8',         // --gold-bright
    player: '#ffffff',
    monster: '#ff5a44',            // hostile red
    monsterSoft: '#ffcf3a',        // low blips lean yellow
    npc: '#5fe6ff',                // cyan friendlies
    npcQuest: '#ffd277',           // gold for quest-ish
  };

  let canvas = null, ctx = null, dpr = 1;
  let lastDraw = 0;

  function injectStyles() {
    if (document.getElementById('minimap-styles')) return;
    const css = document.createElement('style');
    css.id = 'minimap-styles';
    css.textContent = `
      #em-minimap {
        position: fixed; top: 12px; right: 12px; z-index: 30;
        width: ${DIAM}px; height: ${DIAM}px; border-radius: 50%;
        pointer-events: none;
        filter: drop-shadow(0 6px 14px rgba(0,0,0,0.6));
      }
      #em-minimap[hidden] { display: none; }
    `;
    document.head.appendChild(css);
  }

  function build() {
    if (canvas) return;
    injectStyles();
    hideLegacyDial();
    canvas = document.createElement('canvas');
    canvas.id = 'em-minimap';
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = DIAM * dpr;
    canvas.height = DIAM * dpr;
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
  }

  // Map a world (x,z) relative to the player into rotated minimap pixel coords,
  // centred at (R,R). The rotation makes the hero's facing point "up".
  function project(dx, dz, cos, sin) {
    const rx = dx * cos - dz * sin;
    const rz = dx * sin + dz * cos;
    return { x: R + rx * SCALE, y: R + rz * SCALE };
  }

  function blip(x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function draw(em) {
    const player = em.player;
    if (!player || !player.position) return;
    const px = player.position.x, pz = player.position.z;

    // Hero facing: rotation.y around the Y axis. We rotate the world by -facing
    // so what the hero looks toward sits at the top of the dial.
    const facing = player.rotation ? player.rotation.y : 0;
    const cos = Math.cos(facing), sin = Math.sin(facing);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, DIAM, DIAM);

    // --- clip to a circle, fill the parchment-green ground ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R - 4, 0, Math.PI * 2);
    ctx.clip();

    const grad = ctx.createRadialGradient(R, R, 4, R, R, R);
    grad.addColorStop(0, COL.ground);
    grad.addColorStop(1, COL.groundEdge);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, DIAM, DIAM);

    // faint range rings for a radar feel
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let rr = 18; rr < R; rr += 18) {
      ctx.beginPath(); ctx.arc(R, R, rr, 0, Math.PI * 2); ctx.stroke();
    }

    // --- NPC blips (cyan; quest-givers gold) ---
    try {
      const npcs = (em.scene && em.scene.userData && em.scene.userData.npcs) || [];
      for (const g of npcs) {
        if (!g || g.visible === false || !g.position) continue;
        const p = project(g.position.x - px, g.position.z - pz, cos, sin);
        const dxp = p.x - R, dyp = p.y - R;
        if (dxp * dxp + dyp * dyp > (R - 6) * (R - 6)) continue;   // off-dial
        const def = g.userData && g.userData.def;
        const isQuest = def && (def.quest || def.type === 'quest');
        blip(p.x, p.y, 2.5, isQuest ? COL.npcQuest : COL.npc);
      }
    } catch (e) { /* ignore */ }

    // --- monster blips (red; weak ones lean yellow) ---
    try {
      const list = (em.monsters && em.monsters.list) || [];
      for (const g of list) {
        if (!g || !g.position) continue;
        const m = g.userData && g.userData.monster;
        if (!m || !m.alive) continue;
        const p = project(g.position.x - px, g.position.z - pz, cos, sin);
        const dxp = p.x - R, dyp = p.y - R;
        if (dxp * dxp + dyp * dyp > (R - 6) * (R - 6)) continue;
        const weak = m.maxHp && m.maxHp <= 6;
        blip(p.x, p.y, 2.5, weak ? COL.monsterSoft : COL.monster);
      }
    } catch (e) { /* ignore */ }

    // --- the hero: a gold-edged arrow at centre, always pointing "up" ---
    ctx.save();
    ctx.translate(R, R);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fillStyle = COL.player;
    ctx.strokeStyle = COL.gold;
    ctx.lineWidth = 1.2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();   // end clip

    // --- bronze ring border ---
    ctx.lineWidth = 3;
    ctx.strokeStyle = COL.ringOuter;
    ctx.beginPath(); ctx.arc(R, R, R - 2.5, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COL.ring;
    ctx.beginPath(); ctx.arc(R, R, R - 4, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = COL.ringLit;
    ctx.beginPath(); ctx.arc(R, R, R - 6, 0, Math.PI * 2); ctx.stroke();

    // --- compass "N": where north (world -z) sits once the dial is rotated ---
    // North = world direction (0,-1) projected onto the rotated dial.
    const nx = -(-1) * sin;       // = 0*cos - (-1)*sin
    const ny = (-1) * cos;        // = 0*sin + (-1)*cos
    const cR = R - 11;
    const cxp = R + nx * cR, cyp = R + ny * cR;
    ctx.beginPath();
    ctx.arc(cxp, cyp, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,13,6,0.85)';
    ctx.fill();
    ctx.strokeStyle = COL.ring;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = COL.goldBright;
    ctx.font = 'bold 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cxp, cyp + 0.5);

    ctx.restore();
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (now - lastDraw < FRAME_MS) return;
    lastDraw = now;
    try {
      const em = window.eldenmoor;
      if (!em || !em.player) return;
      if (!canvas) build();
      if (canvas) {
        // Hide underground (cellar) where a top-down town map is meaningless.
        const floor = typeof em.getFloor === 'function' ? em.getFloor() : 0;
        canvas.hidden = floor === -1;
        if (!canvas.hidden) draw(em);
      }
    } catch (e) { /* never throw from the loop */ }
  }

  requestAnimationFrame(tick);
})();
