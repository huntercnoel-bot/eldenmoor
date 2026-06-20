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
//   vfx.attachFire(x, y, z, opts) // ambient fire embers (braziers/torches) -> handle
//   vfx.attachWater(x, y, z, r)   // gentle water shimmer over a patch -> handle
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
  for (let i = 0; i < max; i++) {
    parts[i] = { active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, size: 1, gravity: 0, drag: 0.0, r: 1, g: 1, b: 1, baseSize: 1 };
    free.push(i);
  }
  let liveCount = 0;

  function spawn(p) {
    const i = free.pop();
    if (i === undefined) return -1;       // pool exhausted — drop silently
    const d = parts[i];
    Object.assign(d, p);
    d.active = true;
    d.maxLife = p.life;
    d.baseSize = p.size;
    return i;
  }

  // Repack active particles into the front of the buffers each frame.
  function flush() {
    let n = 0;
    for (let i = 0; i < max; i++) {
      const d = parts[i];
      if (!d.active) continue;
      positions[n * 3] = d.x; positions[n * 3 + 1] = d.y; positions[n * 3 + 2] = d.z;
      colors[n * 3] = d.r; colors[n * 3 + 1] = d.g; colors[n * 3 + 2] = d.b;
      sizes[n] = d.size;
      n++;
    }
    liveCount = n;
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;
  }

  function update(dt) {
    for (let i = 0; i < max; i++) {
      const d = parts[i];
      if (!d.active) continue;
      d.life -= dt;
      if (d.life <= 0) { d.active = false; free.push(i); continue; }
      d.vy -= d.gravity * dt;
      if (d.drag) { const f = Math.max(0, 1 - d.drag * dt); d.vx *= f; d.vy *= f; d.vz *= f; }
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      const k = d.life / d.maxLife;            // 1 -> 0 over lifetime
      // fade size out near death so particles shrink away (alpha is in texture)
      d.size = d.baseSize * (0.35 + 0.65 * k);
      // dim the colour as it fades (especially nice for additive sparks)
      d.r = d._r * (0.25 + 0.75 * k);
      d.g = d._g * (0.25 + 0.75 * k);
      d.b = d._b * (0.25 + 0.75 * k);
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

  function attachFire(x, y, z, opts) {
    const o = opts || {};
    const e = {
      type: 'fire', x, y: y == null ? 1.2 : y, z,
      rate: o.rate || 22,          // particles / second
      acc: 0, enabled: true,
      scale: o.scale || 1,
    };
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

  function emitFire(e, dt) {
    e.acc += e.rate * dt;
    while (e.acc >= 1) {
      e.acc -= 1;
      const s = e.scale;
      add(additive, {
        x: e.x + rand(-0.18, 0.18) * s, y: e.y + rand(-0.1, 0.1), z: e.z + rand(-0.18, 0.18) * s,
        vx: rand(-0.25, 0.25), vy: rand(1.0, 2.0), vz: rand(-0.25, 0.25),
        life: rand(0.6, 1.2), size: rand(1.4, 3.0) * s,
        gravity: -0.6, drag: 0.6,            // negative gravity -> rises & accelerates up
        r: 1.0, g: rand(0.45, 0.7), b: rand(0.08, 0.2),   // orange embers
      });
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

  // ----- ambient auto-emitters ---------------------------------------------
  // Outdoor approach braziers (positions baked in buildings.js: ±4.2 at
  // z -23.6 and -28.0; flame box centred ~y 1.0). Embers drift up from each.
  for (const [bx, bz] of [[-4.2, -23.6], [4.2, -23.6], [-4.2, -28.0], [4.2, -28.0]]) {
    attachFire(bx, 1.25, bz, { rate: 16 });
  }
  // Gentle shimmer over the ornamental pond (drawn in world.js / collider in water.js)
  attachWater(22, 0.22, -16, 5);
  // ...and a touch of glint on the front moat sections flanking the causeway.
  attachWater(17, 0.22, 21, 4);
  attachWater(-17, 0.22, 21, 4);

  // ----- main loop ----------------------------------------------------------
  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    // re-grab camera in case it changed; bail if the game tore down the scene
    camera = window.eldenmoor && window.eldenmoor.camera;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;       // clamp after tab-switch / hitches

    // only the ground floor (floor 0) shows the outdoor ambient effects
    const floor = (window.eldenmoor && window.eldenmoor.getFloor) ? window.eldenmoor.getFloor() : 0;
    const outdoors = floor === 0;
    for (const e of emitters) {
      if (!e.enabled || !outdoors) continue;
      if (e.type === 'fire') emitFire(e, dt);
      else if (e.type === 'water') emitWater(e, dt);
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
