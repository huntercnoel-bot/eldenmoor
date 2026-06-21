// ===========================================================================
//  Eldenmoor — Loading Screen  (src/loading.js)
// ---------------------------------------------------------------------------
//  Self-contained, zero-dependency, no-build module. The human wires it in
//  with a single   import './loading.js';   — it edits NOTHING else.
//
//  Goal: kill the asset "pop-in". After login the 3D world appears instantly
//  but ~30 skinned character/monster GLBs and the GLB trees/props stream in
//  over ~15-20s, visibly popping into place. This module throws a themed
//  full-screen veil over the canvas and HOLDS it until the scene is actually
//  populated, then fades it away — so the player never watches things appear.
//
//  How it knows the world is ready (all polled off the live page, never wired):
//    • window.eldenmoor exists                  → the game has started
//    • em.player.userData.setPlayerChop exists  → the hero model is in
//    • >= TARGET_MESHES isSkinnedMesh in scene  → the character crowd is in
//    • a short settle grace for the GLB scatter (trees/props)
//  Plus a hard MAX_WAIT cap (never gets stuck) and a MIN_SHOW floor (never
//  flashes). The progress bar is driven off the real skinned-mesh count so it
//  reads honest, not faked.
//
//  Lifecycle / z-index dance: the game's own #login screen sits at z-index 30
//  and is fully interactive before the game starts. While we're waiting on
//  login we keep this veil DORMANT (display:none) so it never blocks the login
//  buttons. The instant window.eldenmoor appears (login dismissed, game booting)
//  we raise the veil above everything and run the real loading state. When the
//  world is ready we fade out (CSS opacity) and remove ourselves for good.
//
//  Everything is wrapped so a failure here can never break the game: on any
//  thrown error we simply tear the veil down and get out of the way.
// ===========================================================================

(function () {
  'use strict';

  // ---- tunables -----------------------------------------------------------
  var TARGET_MESHES = 20;     // healthy count of skinned character meshes to wait for
  var SETTLE_MS     = 900;    // extra grace once the mesh target is hit (GLB scatter)
  var MIN_SHOW_MS   = 1200;   // never flash the veil for less than this once active
  var MAX_WAIT_MS   = 25000;  // hard cap from "game started" — reveal no matter what
  var POLL_MS       = 140;    // readiness poll cadence
  var FADE_MS       = 750;    // opacity fade-out duration (kept in sync with CSS)

  // ---- rotating flavor tips (OSRS x WoW fantasy vibe) ---------------------
  var TIPS = [
    'Sharpen your blade before the moor grows dark.',
    'They say the old king still keeps a quest or two.',
    'Woodcutting builds patience — and firewood.',
    'Gold buys steel; courage you must forge yourself.',
    'Beware the things that stir beyond the torchlight.',
    'A full inventory is a slow inventory.',
    'Every legend of Eldenmoor began with a single step.',
    'Rest by the fire — the realm will keep its monsters.',
    'Speak with the townsfolk; not all treasure is buried.',
    'The bravest adventurers always check their map.'
  ];

  // Bail cleanly if there's no DOM to attach to (e.g. exotic embed).
  if (typeof document === 'undefined' || !document.documentElement) return;

  var REMOVED = false;     // hard latch: once gone, never come back
  var el = null;           // overlay root
  var fillEl = null;       // progress bar fill
  var pctEl = null;        // numeric percent
  var tipEl = null;        // flavor tip line
  var statusEl = null;     // small status caption under the bar
  var started = false;     // have we switched into the active loading state?
  var activeAt = 0;        // timestamp the active state began
  var tipTimer = null;
  var pollTimer = null;
  var settleAt = 0;        // timestamp the mesh target was first reached (0 = not yet)

  // -------------------------------------------------------------------------
  //  Style injection — its own <style>, scoped under #em-loader so it can't
  //  collide with the game's own CSS. Colors lifted from the game's palette
  //  (--gold #ffd277, --gold-bright #ffe6a8, --gold-deep #c9962f, bronze, ink).
  // -------------------------------------------------------------------------
  function injectStyle() {
    if (document.getElementById('em-loader-style')) return;
    var css = [
      '#em-loader{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;',
      'justify-content:center;font-family:Georgia,"Times New Roman",serif;color:#f4e4c1;',
      'opacity:1;transition:opacity ' + FADE_MS + 'ms ease;',
      // dark parchment / stone backdrop with a warm hearth glow, echoing #login
      'background:',
      'radial-gradient(circle at 50% 22%, rgba(90,64,30,0.55), transparent 55%),',
      'radial-gradient(circle at 50% 120%, rgba(255,210,119,0.12), transparent 60%),',
      'radial-gradient(circle at 50% 30%, #2a2018, #100a06 82%);}',
      '#em-loader.em-hide{opacity:0;pointer-events:none;}',
      // faint stone-grain vignette overlay
      '#em-loader::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:0.5;',
      'background:radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%);}',

      // gold-framed parchment panel
      '#em-loader .em-panel{position:relative;width:min(440px,86vw);padding:34px 36px 30px;',
      'text-align:center;border-radius:10px;',
      'background:linear-gradient(165deg,#241a10 0%,#160f08 100%);',
      'border:2px solid #7a5a2c;',
      'box-shadow:0 0 0 1px #2c1d0e,0 0 0 4px rgba(122,90,44,0.45),',
      'inset 0 0 46px rgba(120,90,50,0.25),0 18px 60px rgba(0,0,0,0.75),',
      '0 0 40px rgba(255,210,119,0.10);}',
      // gilt corner studs
      '#em-loader .em-stud{position:absolute;width:9px;height:9px;border-radius:50%;',
      'background:radial-gradient(circle at 35% 30%,#ffe6a8,#c9962f 60%,#6b4a18);',
      'box-shadow:0 0 5px rgba(255,210,119,0.6),inset 0 0 2px rgba(0,0,0,0.5);}',
      '#em-loader .em-stud.tl{top:9px;left:9px;}#em-loader .em-stud.tr{top:9px;right:9px;}',
      '#em-loader .em-stud.bl{bottom:9px;left:9px;}#em-loader .em-stud.br{bottom:9px;right:9px;}',

      '#em-loader .em-crest{font-size:40px;line-height:1;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.6));}',
      '#em-loader .em-title{font-size:30px;font-weight:800;letter-spacing:5px;margin-top:6px;',
      'color:#ffd277;text-shadow:0 0 16px rgba(255,210,119,0.5),0 2px 4px #000,0 1px 0 #5a3d12;}',
      '#em-loader .em-sub{font-size:11px;letter-spacing:2px;text-transform:uppercase;',
      'color:#c9a25a;margin:6px 0 22px;}',

      // progress track + fill
      '#em-loader .em-track{position:relative;height:16px;border-radius:9px;overflow:hidden;',
      'background:linear-gradient(180deg,#0b0703,#1a120a);',
      'border:1px solid #4a3417;box-shadow:inset 0 0 8px rgba(0,0,0,0.85);}',
      '#em-loader .em-fill{position:absolute;left:0;top:0;bottom:0;width:0%;',
      'border-radius:9px 6px 6px 9px;transition:width 0.35s ease;',
      'background:linear-gradient(180deg,#ffe6a8,#ffd277 40%,#c9962f 100%);',
      'box-shadow:0 0 10px rgba(255,210,119,0.55),inset 0 1px 0 rgba(255,255,255,0.4);}',
      // sweeping shimmer over the fill
      '#em-loader .em-fill::after{content:"";position:absolute;inset:0;',
      'background:linear-gradient(100deg,transparent 20%,rgba(255,255,255,0.55) 50%,transparent 80%);',
      'background-size:200% 100%;animation:em-shimmer 1.4s linear infinite;}',
      '@keyframes em-shimmer{0%{background-position:200% 0;}100%{background-position:-200% 0;}}',

      '#em-loader .em-meta{display:flex;justify-content:space-between;align-items:center;',
      'margin-top:9px;font-size:12px;color:#c9a25a;letter-spacing:0.5px;}',
      '#em-loader .em-pct{color:#ffe6a8;font-weight:700;font-variant-numeric:tabular-nums;}',

      // rotating flavor tip
      '#em-loader .em-tip{margin-top:22px;min-height:34px;font-style:italic;font-size:13px;',
      'line-height:1.5;color:#d8c8a0;text-shadow:0 1px 3px #000;',
      'transition:opacity 0.5s ease;}',
      '#em-loader .em-tip-label{display:block;font-style:normal;font-size:10px;letter-spacing:2px;',
      'text-transform:uppercase;color:#8a6b3a;margin-bottom:4px;}',

      // tiny spinning rune beside the title acts as the spinner cue
      '#em-loader .em-spin{display:inline-block;width:14px;height:14px;margin-left:2px;',
      'border:2px solid rgba(255,210,119,0.25);border-top-color:#ffd277;border-radius:50%;',
      'animation:em-rot 0.9s linear infinite;vertical-align:middle;}',
      '@keyframes em-rot{to{transform:rotate(360deg);}}',

      // honour reduced-motion: drop the animations, keep the veil
      '@media (prefers-reduced-motion:reduce){',
      '#em-loader .em-fill::after,#em-loader .em-spin{animation:none;}',
      '#em-loader .em-fill,#em-loader .em-tip,#em-loader{transition:none;}}'
    ].join('');
    var style = document.createElement('style');
    style.id = 'em-loader-style';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  // -------------------------------------------------------------------------
  //  Build the overlay DOM. Starts DORMANT (display:none) so it never blocks
  //  the #login screen; we reveal it the moment the game starts.
  // -------------------------------------------------------------------------
  function buildOverlay() {
    if (el) return;
    el = document.createElement('div');
    el.id = 'em-loader';
    el.setAttribute('role', 'progressbar');
    el.setAttribute('aria-label', 'Loading Eldenmoor');
    el.style.display = 'none';
    el.innerHTML =
      '<div class="em-panel">' +
        '<span class="em-stud tl"></span><span class="em-stud tr"></span>' +
        '<span class="em-stud bl"></span><span class="em-stud br"></span>' +
        '<div class="em-crest">⚔️</div>' +
        '<div class="em-title">ELDENMOOR</div>' +
        '<div class="em-sub">Entering the realm <span class="em-spin"></span></div>' +
        '<div class="em-track"><div class="em-fill"></div></div>' +
        '<div class="em-meta"><span class="em-status">Summoning the world…</span>' +
          '<span class="em-pct">0%</span></div>' +
        '<div class="em-tip"><span class="em-tip-label">Adventurer’s Tip</span>' +
          '<span class="em-tip-text"></span></div>' +
      '</div>';
    (document.body || document.documentElement).appendChild(el);
    fillEl   = el.querySelector('.em-fill');
    pctEl    = el.querySelector('.em-pct');
    tipEl    = el.querySelector('.em-tip-text');
    statusEl = el.querySelector('.em-status');
    setTip(TIPS[(Math.random() * TIPS.length) | 0]);
  }

  function setTip(text) {
    if (!tipEl) return;
    tipEl.style.opacity = '0';
    setTimeout(function () {
      try { tipEl.textContent = text; tipEl.style.opacity = '1'; } catch (e) {}
    }, 260);
  }

  function rotateTips() {
    if (tipTimer) return;
    tipTimer = setInterval(function () {
      try { setTip(TIPS[(Math.random() * TIPS.length) | 0]); } catch (e) {}
    }, 4200);
  }

  // Make the veil visible & active. Called once, when the game has started.
  function activate() {
    if (started || REMOVED) return;
    started = true;
    activeAt = Date.now();
    if (el) el.style.display = 'flex';
    rotateTips();
  }

  // -------------------------------------------------------------------------
  //  Readiness probes — all defensive, all read straight off the live page.
  // -------------------------------------------------------------------------
  function gameStarted() {
    return !!(window.eldenmoor && window.eldenmoor.scene);
  }

  function playerReady() {
    try {
      var p = window.eldenmoor && window.eldenmoor.player;
      return !!(p && p.userData && typeof p.userData.setPlayerChop === 'function');
    } catch (e) { return false; }
  }

  function countSkinned() {
    try {
      var scene = window.eldenmoor && window.eldenmoor.scene;
      if (!scene || typeof scene.traverse !== 'function') return 0;
      var n = 0;
      scene.traverse(function (o) { if (o && o.isSkinnedMesh) n++; });
      return n;
    } catch (e) { return 0; }
  }

  // 0..1 progress, driven off the real mesh count (honest, not faked).
  function progress() {
    var meshes = countSkinned();
    var frac = meshes / TARGET_MESHES;
    if (frac > 1) frac = 1;
    if (frac < 0) frac = 0;
    return { frac: frac, meshes: meshes };
  }

  function paint(frac) {
    try {
      var pct = Math.round(frac * 100);
      if (fillEl) fillEl.style.width = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';
    } catch (e) {}
  }

  // -------------------------------------------------------------------------
  //  Tear-down: fade out and remove for good. Idempotent + latched.
  // -------------------------------------------------------------------------
  function reveal() {
    if (REMOVED) return;
    REMOVED = true;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (tipTimer) { clearInterval(tipTimer); tipTimer = null; }
    try {
      paint(1);
      if (statusEl) statusEl.textContent = 'Ready';
    } catch (e) {}
    if (!el) return;
    try {
      el.classList.add('em-hide');
      var node = el;
      el = null;
      setTimeout(function () {
        try { if (node && node.parentNode) node.parentNode.removeChild(node); } catch (e) {}
        try {
          var s = document.getElementById('em-loader-style');
          if (s && s.parentNode) s.parentNode.removeChild(s);
        } catch (e) {}
      }, FADE_MS + 120);
    } catch (e) {
      // last resort: yank it
      try { if (el && el.parentNode) el.parentNode.removeChild(el); } catch (e2) {}
      el = null;
    }
  }

  // -------------------------------------------------------------------------
  //  Main poll loop. Three phases:
  //    1. idle  — game not started: keep veil dormant so #login is usable.
  //    2. active — game booting: show veil + drive progress off mesh count.
  //    3. ready  — conditions met (or capped): fade + remove.
  // -------------------------------------------------------------------------
  function tick() {
    if (REMOVED) return;
    try {
      if (!gameStarted()) {
        // Still on the login screen (or pre-boot). Stay out of the way.
        return;
      }

      // Game has started — make sure the veil is up and driving progress.
      activate();

      var p = progress();
      paint(p.frac);

      var elapsed = Date.now() - activeAt;

      // Hard safety cap: never get stuck, reveal regardless.
      if (elapsed >= MAX_WAIT_MS) { reveal(); return; }

      // Status caption tracks what we're waiting on.
      try {
        if (statusEl) {
          if (!playerReady()) statusEl.textContent = 'Awakening your hero…';
          else if (p.meshes < TARGET_MESHES) statusEl.textContent =
            'Gathering the realm… (' + p.meshes + '/' + TARGET_MESHES + ')';
          else statusEl.textContent = 'Raising the forest…';
        }
      } catch (e) {}

      // Core readiness: hero in AND enough character meshes loaded.
      var coreReady = playerReady() && p.meshes >= TARGET_MESHES;

      if (coreReady) {
        if (!settleAt) settleAt = Date.now();          // start GLB-scatter grace
      } else {
        settleAt = 0;                                  // regressed; reset grace
      }

      var settled = settleAt && (Date.now() - settleAt >= SETTLE_MS);
      var minShown = elapsed >= MIN_SHOW_MS;

      if (coreReady && settled && minShown) reveal();
    } catch (e) {
      // Anything unexpected: don't risk trapping the player behind the veil.
      try { reveal(); } catch (e2) {}
    }
  }

  // -------------------------------------------------------------------------
  //  Boot. Build immediately (dormant), then poll. Works whether the DOM is
  //  already parsed or not.
  // -------------------------------------------------------------------------
  function boot() {
    try {
      injectStyle();
      buildOverlay();
      pollTimer = setInterval(tick, POLL_MS);
      tick();
    } catch (e) {
      // If we can't even set up, make sure we never leave a dead veil behind.
      try { reveal(); } catch (e2) {}
    }
  }

  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  } catch (e) {
    try { boot(); } catch (e2) {}
  }
})();
