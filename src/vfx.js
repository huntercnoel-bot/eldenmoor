// vfx.js — game-wide "juice": a lightweight particle / effects system.
//
// Self-contained and self-initializing: it polls for window.eldenmoor (set up by
// main.js once you start the game), grabs the scene + camera, and runs its own
// requestAnimationFrame loop to advance and expire particles. Other systems can
// fire effects through window.eldenmoor.vfx:
//
//   vfx.burst('hit',   x, y, z)   // hit sparks (combat)
//   vfx.burst('gather',x, y, z)   // woodcutting / mining dust puffs
//   vfx.burst('coin',  x, y, z)   // gold sparkle on pickup
//   vfx.burst('levelup',x,y,z)    // celebratory burst
//   vfx.attachFire(x, y, z, opts) // a flickering flame plume (torch/brazier) -> handle
//   vfx.attachWater(x, y, z, r)   // gentle water shimmer over a patch -> handle
//
// Fire is NOT hardcoded to guessed coordinates. On startup we traverse the live
// scene graph and find the REAL emitters — meshes with a warm, high-intensity
// emissive material (torches, braziers, lanterns, candles, hearth embers) and
// warm THREE.PointLights — then anchor a flame at each in world space. Each
// plume rises with buoyancy, flickers (noise-driven size/opacity), and cools
// along a white-hot -> yellow -> orange -> red ramp, with occasional embers and
// (for the strongest spots) a subtly flickering point light. Emitters are culled
// when their source is on another floor (parent .visible) or far off-screen.
//
// Performance: one shared THREE.Points pool per blend mode (capped), particles
// recycled from a free list. No allocations in the hot loop.

import * as THREE from '../vendor/three.module.js';

const MAX_ADDITIVE = 1400;   // sparks, embers, coins, level-up, shimmer
const MAX_NORMAL   = 600;    // dust puffs (softer, non-additive)

// --- a tiny round soft sprite, generated once (no external assets) ---
function makeSpriteTexture() {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.25)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A recyclable particle pool backed by a single THREE.Points object.
function createPool(max, blending, depthWrite, sprite) {
  const positions = new Float32Array(max * 3);
  const colors = new Float32Array(max * 3);
  const sizes = new Float32Array(max);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geo.setDrawRange(0, 0);

  // ShaderMaterial so each particle has an independent size + fades on alpha.
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: sprite } },
    vertexShader: `
      attribute float size;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / max(-mv.z, 0.001));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uTex;
      varying vec3 vColor;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        gl_FragColor = vec4(vColor, t.a);
      }`,
    transparent: true,
    blending,
    depthWrite,
    depthTest: true,
    vertexColors: true,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 10;

  // Parallel particle data (struct-of-arrays kept simple as object array).
  const parts = new Array(max);
  const free = [];
  // Compact list of currently-active particle indices. update()/flush() iterate
  // ONLY this list (O(live)) instead of scanning all `max` slots every frame, so
  // an idle pool of 1000s of slots costs almost nothing when few particles are up.
  const activeList = [];
  for (let i = 0; i < max; i++) {
    parts[i] = { active: false, slot: -1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, size: 1, gravity: 0, drag: 0.0, r: 1, g: 1, b: 1, baseSize: 1 };
    free.push(i);
  }
  let liveCount = 0;

  function spawn(p) {
    const i = free.pop();
    if (i === undefined) return -1;       // pool exhausted — drop silently
    const d = parts[i];
    d.fire = false;                       // reset flags that aren't always set
    Object.assign(d, p);
    d.active = true;
    d.maxLife = p.life;
    d.baseSize = p.size;
    d.slot = activeList.length;           // remember our spot for O(1) swap-remove
    activeList.push(i);
    return i;
  }

  // Flame colour ramp (kept in sync with the one used by the fire emitter) so a
  // single plume cools white-hot -> yellow -> orange -> red as it rises.
  const RAMP = [
    [1.00, 0.95, 0.70], [1.00, 0.78, 0.32], [1.00, 0.52, 0.16],
    [0.90, 0.26, 0.07], [0.55, 0.13, 0.04],
  ];
  function ramp(t, out) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const f = t * (RAMP.length - 1);
    const i2 = Math.min(RAMP.length - 2, Math.floor(f));
    const k = f - i2, a = RAMP[i2], b = RAMP[i2 + 1];
    out[0] = a[0] + (b[0] - a[0]) * k;
    out[1] = a[1] + (b[1] - a[1]) * k;
    out[2] = a[2] + (b[2] - a[2]) * k;
  }
  const _c = [0, 0, 0];

  // Swap-remove an active particle from activeList in O(1) and recycle its slot.
  function retire(d, i, listIdx) {
    d.active = false;
    free.push(i);
    const lastIdx = activeList.length - 1;
    const moved = activeList[lastIdx];
    activeList[listIdx] = moved;
    parts[moved].slot = listIdx;
    activeList.pop();
  }

  // Repack active particles into the front of the buffers each frame. Iterates the
  // compact active list, so cost scales with live particles, not pool capacity.
  function flush() {
    const n = activeList.length;
    for (let j = 0; j < n; j++) {
      const d = parts[activeList[j]];
      positions[j * 3] = d.x; positions[j * 3 + 1] = d.y; positions[j * 3 + 2] = d.z;
      colors[j * 3] = d.r; colors[j * 3 + 1] = d.g; colors[j * 3 + 2] = d.b;
      sizes[j] = d.size;
    }
    liveCount = n;
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;
  }

  function update(dt) {
    for (let j = activeList.length - 1; j >= 0; j--) {
      const i = activeList[j];
      const d = parts[i];
      d.life -= dt;
      if (d.life <= 0) { retire(d, i, j); continue; }
      d.vy -= d.gravity * dt;
      if (d.drag) { const f = Math.max(0, 1 - d.drag * dt); d.vx *= f; d.vy *= f; d.vz *= f; }
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      const k = d.life / d.maxLife;            // 1 -> 0 over lifetime
      if (d.fire) {
        // age 0 (just born, hot) -> 1 (old, cool). Re-colour along the flame
        // ramp so a rising particle visibly cools white->yellow->orange->red.
        const age = 1 - k;
        ramp(age, _c);
        // additive flames look best growing a touch then fading; brightness
        // tapers as they cool so the tips read as dimmer smoulder/smoke.
        const bright = 0.35 + 0.65 * k;
        d.r = _c[0] * bright; d.g = _c[1] * bright; d.b = _c[2] * bright;
        d.size = d.baseSize * (0.55 + 0.55 * k);   // plump near the base, shrink at top
      } else {
        // fade size out near death so particles shrink away (alpha is in texture)
        d.size = d.baseSize * (0.35 + 0.65 * k);
        // dim the colour as it fades (especially nice for additive sparks)
        d.r = d._r * (0.25 + 0.75 * k);
        d.g = d._g * (0.25 + 0.75 * k);
        d.b = d._b * (0.25 + 0.75 * k);
      }
    }
  }

  return { points, spawn, update, flush, get live() { return liveCount; } };
}

const rand = (a, b) => a + Math.random() * (b - a);

// ============================================================================
//  VFX system
// ============================================================================
function startVFX(em) {
  const { scene } = em;
  let camera = em.camera;
  const sprite = makeSpriteTexture();

  const additive = createPool(MAX_ADDITIVE, THREE.AdditiveBlending, false, sprite);
  const normal = createPool(MAX_NORMAL, THREE.NormalBlending, false, sprite);
  scene.add(additive.points);
  scene.add(normal.points);

  // helper that stores the "base" colour so fading can reference it
  function add(pool, p) {
    p._r = p.r; p._g = p.g; p._b = p.b;
    pool.spawn(p);
  }

  // ----- one-shot bursts ----------------------------------------------------
  function hitSparks(x, y, z) {
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(2.5, 6);
      add(additive, {
        x, y, z,
        vx: Math.cos(a) * sp, vy: rand(1.5, 5), vz: Math.sin(a) * sp,
        life: rand(0.22, 0.45), size: rand(1.3, 2.6),
        gravity: 9, drag: 1.5,
        r: 1.0, g: rand(0.75, 0.95), b: rand(0.25, 0.5),   // warm yellow-white sparks
      });
    }
  }

  function gatherPuff(x, y, z) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(0.4, 1.8);
      const shade = rand(0.45, 0.7);
      add(normal, {
        x: x + rand(-0.2, 0.2), y, z: z + rand(-0.2, 0.2),
        vx: Math.cos(a) * sp, vy: rand(0.6, 1.6), vz: Math.sin(a) * sp,
        life: rand(0.5, 1.0), size: rand(2.5, 5),
        gravity: 1.2, drag: 2.2,
        r: shade, g: shade * 0.85, b: shade * 0.6,          // dusty brown
      });
    }
  }

  function coinSparkle(x, y, z) {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(0.5, 2.2);
      add(additive, {
        x, y, z,
        vx: Math.cos(a) * sp, vy: rand(2, 4.5), vz: Math.sin(a) * sp,
        life: rand(0.4, 0.9), size: rand(1.4, 2.8),
        gravity: 6, drag: 0.8,
        r: 1.0, g: rand(0.82, 0.95), b: rand(0.2, 0.45),    // gold
      });
    }
  }

  function levelupBurst(x, y, z) {
    const n = 60;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(3, 8);
      // rainbow-ish festive palette skewed warm/gold
      const hue = Math.random();
      const c = new THREE.Color().setHSL(0.08 + hue * 0.12, 0.9, 0.6);
      add(additive, {
        x, y: y + 0.5, z,
        vx: Math.cos(a) * sp, vy: rand(3, 9), vz: Math.sin(a) * sp,
        life: rand(0.7, 1.4), size: rand(2, 4),
        gravity: 7, drag: 0.7,
        r: c.r, g: c.g, b: c.b,
      });
    }
  }

  const BURSTS = { hit: hitSparks, gather: gatherPuff, coin: coinSparkle, levelup: levelupBurst };

  function burst(type, x, y, z) {
    const fn = BURSTS[type];
    if (!fn) return;
    fn(x || 0, y || 0, z || 0);
  }

  // ----- continuous emitters (fire embers, water shimmer) -------------------
  const emitters = [];

  // A small palette ramp for flame colour by "age" (0 = just born at the hot
  // core, 1 = old/cooling at the top). White-hot core -> yellow -> orange ->
  // deep red -> smoulder. Sampled per particle so a single plume shows the full
  // warm gradient that real flames have. (Refs: additive flame billboards with
  // colour-over-lifetime; see WoW/Unity/Defold fire tutorials.)
  const FIRE_RAMP = [
    [1.00, 0.95, 0.70],   // white-hot
    [1.00, 0.78, 0.32],   // yellow
    [1.00, 0.52, 0.16],   // orange
    [0.90, 0.26, 0.07],   // red
    [0.55, 0.13, 0.04],   // deep red / smoulder
  ];
  function sampleRamp(t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const f = t * (FIRE_RAMP.length - 1);
    const i = Math.min(FIRE_RAMP.length - 2, Math.floor(f));
    const k = f - i, a = FIRE_RAMP[i], b = FIRE_RAMP[i + 1];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }

  // Pool of flickering point lights we hand out to the strongest emitters (capped
  // so we never blow the renderer's light budget). Warm colour, intensity driven
  // by per-emitter noise so torches subtly breathe.
  const MAX_FIRE_LIGHTS = 8;
  const fireLights = [];
  function takeFireLight() {
    if (fireLights.length >= MAX_FIRE_LIGHTS) return null;
    const pl = new THREE.PointLight(0xffa64d, 0, 14, 2);
    pl.castShadow = false;
    scene.add(pl);
    fireLights.push(pl);
    return pl;
  }

  function attachFire(x, y, z, opts) {
    const o = opts || {};
    const e = {
      type: 'fire', x, y: y == null ? 1.2 : y, z,
      rate: o.rate == null ? 26 : o.rate,   // plume particles / second
      emberRate: o.emberRate == null ? 3 : o.emberRate,
      acc: 0, emberAcc: 0, enabled: true,
      scale: o.scale || 1,
      // independent flicker phases so neighbouring torches aren't in lock-step
      ph1: rand(0, Math.PI * 2), ph2: rand(0, Math.PI * 2), ph3: rand(0, Math.PI * 2),
      flick: 1,
      src: o.src || null,              // optional source Object3D for visibility culling
      light: null,
      ownLight: false,                 // true if we created the light (and may move it)
      baseIntensity: o.intensity || 0,
    };
    if (o.intensity) {
      // Prefer flickering the scene's EXISTING warm light at this spot (so we
      // don't stack two lights). Only mint a fresh pooled light if there isn't
      // one and we're under the cap.
      if (o.existingLight) { e.light = o.existingLight; e.baseIntensity = o.existingLight.intensity || o.intensity; }
      else { e.light = takeFireLight(); e.ownLight = true; }
    }
    emitters.push(e);
    return e;
  }

  function attachWater(x, y, z, r) {
    const e = {
      type: 'water', x, y: y == null ? 0.2 : y, z,
      r: r || 6, rate: 10, acc: 0, enabled: true,
    };
    emitters.push(e);
    return e;
  }

  function detach(handle) {
    const i = emitters.indexOf(handle);
    if (i >= 0) emitters.splice(i, 1);
  }

  // Advance a fire emitter's flicker each frame: blend three out-of-phase sines
  // (a cheap stand-in for noise) so size/opacity/light "breathe" irregularly.
  function tickFireFlicker(e, now) {
    const t = now * 0.001;
    const a = Math.sin(t * 11 + e.ph1);
    const b = Math.sin(t * 19 + e.ph2);
    const c = Math.sin(t * 31 + e.ph3);
    // 0.78 .. 1.22 — a gentle, slightly jittery multiplier
    e.flick = 1 + 0.14 * a + 0.06 * b + 0.02 * c;
  }

  function emitFire(e, dt) {
    const s = e.scale;
    const fl = e.flick;
    // --- the flame plume: dense, short-lived, rising & narrowing ------------
    e.acc += e.rate * fl * dt;
    while (e.acc >= 1) {
      e.acc -= 1;
      // bias spawn toward the centre so the plume has a bright core and soft edges
      const rx = (Math.random() - 0.5) + (Math.random() - 0.5);   // ~triangular
      const rz = (Math.random() - 0.5) + (Math.random() - 0.5);
      const age0 = rand(0, 0.18);                 // born slightly "aged" sometimes
      const col = sampleRamp(age0);
      add(additive, {
        x: e.x + rx * 0.16 * s, y: e.y + rand(-0.05, 0.06), z: e.z + rz * 0.16 * s,
        vx: rx * 0.35, vy: rand(1.3, 2.3) * (0.9 + 0.2 * fl), vz: rz * 0.35,
        life: rand(0.5, 0.95), size: rand(2.2, 4.4) * s * (0.9 + 0.15 * fl),
        gravity: -1.1, drag: 1.0,                 // buoyancy: accelerates upward, then air-drags
        r: col[0], g: col[1], b: col[2],
        fire: true,                               // flag so update() re-colours along the ramp
      });
    }
    // --- occasional rising embers: tiny, long-lived, wandering up ----------
    e.emberAcc += e.emberRate * fl * dt;
    while (e.emberAcc >= 1) {
      e.emberAcc -= 1;
      const a = rand(0, Math.PI * 2), sp = rand(0.05, 0.35);
      add(additive, {
        x: e.x + rand(-0.12, 0.12) * s, y: e.y + rand(0.05, 0.25), z: e.z + rand(-0.12, 0.12) * s,
        vx: Math.cos(a) * sp, vy: rand(1.4, 2.6), vz: Math.sin(a) * sp,
        life: rand(1.0, 2.0), size: rand(0.7, 1.5) * s,
        gravity: -0.5, drag: 0.5,
        r: 1.0, g: rand(0.55, 0.78), b: rand(0.15, 0.3),
      });
    }
    // --- drive the (optional) flickering point light -----------------------
    if (e.light) {
      if (e.ownLight) e.light.position.set(e.x, e.y + 0.5, e.z);  // existing scene lights stay put
      e.light.intensity = e.baseIntensity * fl;
    }
  }

  function emitWater(e, dt) {
    e.acc += e.rate * dt;
    while (e.acc >= 1) {
      e.acc -= 1;
      const a = rand(0, Math.PI * 2), rr = Math.sqrt(Math.random()) * e.r;
      add(additive, {
        x: e.x + Math.cos(a) * rr, y: e.y + rand(0, 0.05), z: e.z + Math.sin(a) * rr,
        vx: rand(-0.1, 0.1), vy: rand(0.05, 0.2), vz: rand(-0.1, 0.1),
        life: rand(0.8, 1.6), size: rand(1.5, 3.2),
        gravity: 0, drag: 1.0,
        r: rand(0.5, 0.7), g: rand(0.75, 0.9), b: 1.0,    // pale blue-white glints
      });
    }
  }

  // ----- auto-place fire on the REAL emitters in the scene -----------------
  // Rather than hardcoding torch/brazier coordinates (which drift whenever a
  // building moves), we walk the live scene graph and find the actual flame
  // meshes and warm point-lights, then anchor a flame plume at each in WORLD
  // space. Discovery is deferred a beat so all buildings are in the graph.
  function isWarm(col) {
    // warm == hue in the red/orange/yellow band AND reasonably saturated/bright
    const hsl = { h: 0, s: 0, l: 0 };
    col.getHSL(hsl);
    return (hsl.h <= 0.13 || hsl.h >= 0.97) && hsl.s > 0.45 && hsl.l > 0.25;
  }

  function discoverFireSources() {
    const found = [];   // { pos: Vector3, src: Object3D, intensity }
    const wp = new THREE.Vector3();
    scene.traverse((o) => {
      // (a) emissive warm meshes — torches, braziers, lanterns, candles, embers
      const m = o.isMesh ? o.material : null;
      const mat = Array.isArray(m) ? m[0] : m;
      if (mat && mat.emissive && (mat.emissiveIntensity || 0) >= 1.0 && isWarm(mat.emissive)) {
        o.getWorldPosition(wp);
        // skip flat hearths/fireplaces that sit very low & wide? keep them — they read as fire too.
        found.push({ x: wp.x, y: wp.y, z: wp.z, src: o, intensity: 0 });
      }
      // (b) warm point lights — these already mark "this is a fire" spots
      if (o.isPointLight && isWarm(o.color)) {
        o.getWorldPosition(wp);
        found.push({ x: wp.x, y: wp.y, z: wp.z, src: o, intensity: 1, light: true, lightObj: o });
      }
    });

    // Merge sources that are basically the same fire (a flame mesh AND its point
    // light sitting on top of each other) so we don't double-emit. Prefer the
    // mesh position but inherit "has a light" so that spot gets a flicker light.
    const MERGE = 1.1;     // metres
    const merged = [];
    for (const f of found) {
      let hit = null;
      for (const g of merged) {
        const dx = g.x - f.x, dy = g.y - f.y, dz = g.z - f.z;
        if (dx * dx + dy * dy + dz * dz < MERGE * MERGE) { hit = g; break; }
      }
      if (hit) {
        hit.intensity = Math.max(hit.intensity, f.intensity);
        if (f.lightObj && !hit.lightObj) hit.lightObj = f.lightObj;   // remember the real light to flicker
        // keep a real mesh's source/position over a bare light's
        if (!f.light && hit.light) { hit.x = f.x; hit.y = f.y; hit.z = f.z; hit.src = f.src; hit.light = false; }
      } else {
        merged.push({ ...f });
      }
    }
    return merged;
  }

  // Cap how many emitters we run (perf). Sort so the brightest / lit ones win,
  // then attach a flame at each found world position.
  const MAX_FIRE_EMITTERS = 48;
  function placeAutoFire() {
    const srcs = discoverFireSources();
    srcs.sort((a, b) => b.intensity - a.intensity);
    const use = srcs.slice(0, MAX_FIRE_EMITTERS);
    for (const s of use) {
      attachFire(s.x, s.y, s.z, {
        rate: 28, emberRate: 3, scale: 1,
        src: s.src,
        // only the spots that already had a warm point light get a flicker light,
        // so we stay inside the renderer's light budget.
        intensity: s.intensity ? 7 : 0,
        existingLight: s.lightObj || null,   // flicker the scene's own light, don't stack a new one
      });
    }
    console.log('[vfx] auto-placed fire on ' + use.length + ' emitter(s) (of ' + srcs.length + ' found)');
    return use.length;
  }
  // Gentle shimmer over the ornamental pond (the one verified water landmark in
  // world.js: POND = { x:22, z:-16, r:6 }). The old guessed "moat" emitters at
  // z 21 didn't line up with the real water bands, so they're gone.
  attachWater(22, 0.22, -16, 5);

  // Defer one tick so late-added buildings (castle interiors etc.) are present.
  let autoPlaced = false;

  // Is this source object actually being rendered right now? Walk up the parent
  // chain checking .visible — this is exactly how the game hides off-floor
  // buildings (keep.ground/upper/basement + the outdoor array all toggle
  // .visible), so a flame is culled the moment its torch is on another floor.
  function srcVisible(o) {
    let n = o;
    while (n) { if (n.visible === false) return false; n = n.parent; }
    return true;
  }

  const CULL_DIST2 = 70 * 70;   // beyond this from the camera, don't bother emitting

  // ----- main loop ----------------------------------------------------------
  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    // re-grab camera in case it changed; bail if the game tore down the scene
    camera = window.eldenmoor && window.eldenmoor.camera;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;       // clamp after tab-switch / hitches

    // auto-place fire once, after the first frame, so every building (incl. the
    // castle interiors swapped in by setFloor) is already in the scene graph.
    if (!autoPlaced) { autoPlaced = true; try { placeAutoFire(); } catch (e) { console.error('[vfx] auto-place failed', e); } }

    const floor = (window.eldenmoor && window.eldenmoor.getFloor) ? window.eldenmoor.getFloor() : 0;
    const outdoors = floor === 0;
    const cam = camera;

    for (const e of emitters) {
      if (!e.enabled) { if (e.light) e.light.intensity = 0; continue; }
      if (e.type === 'water') { if (outdoors) emitWater(e, dt); continue; }

      // ----- fire: cull off-floor (source hidden) and far-away emitters ------
      const visible = e.src ? srcVisible(e.src) : outdoors;
      let near = true;
      if (visible && cam) {
        const dx = e.x - cam.position.x, dy = e.y - cam.position.y, dz = e.z - cam.position.z;
        near = (dx * dx + dy * dy + dz * dz) < CULL_DIST2;
      }
      if (!visible || !near) { if (e.light) e.light.intensity = 0; continue; }

      tickFireFlicker(e, now);
      emitFire(e, dt);
    }

    additive.update(dt); normal.update(dt);
    additive.flush(); normal.flush();
  }
  requestAnimationFrame(tick);

  return {
    burst, attachFire, attachWater, detach,
    // expose pool stats for debugging
    stats: () => ({ additive: additive.live, normal: normal.live, emitters: emitters.length }),
  };
}

// ----- self-initialize: poll for window.eldenmoor, then start ---------------
(function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.camera) {
      clearInterval(iv);
      try {
        em.vfx = startVFX(em);
      } catch (err) {
        console.error('[vfx] failed to start', err);
      }
    } else if (tries > 600) {     // ~60s — give up quietly
      clearInterval(iv);
    }
  }, 100);
})();
