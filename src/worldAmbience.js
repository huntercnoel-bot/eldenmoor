// worldAmbience.js — near-free outdoor "life" layer.
//
// Self-contained, like ambient.js: it polls for window.eldenmoor, then adds a
// tiny amount of cheap animated ambience to the existing outdoor scene and runs
// its own rAF loop. It NEVER touches gameplay, collision, networking, or the
// material/lighting pipeline beyond reading the scene.
//
// What it adds (all deliberately minimal — the user has complained about lag):
//   1. Gentle cloud DRIFT. The world's cloud puffs are already one merged mesh
//      (world.js makeClouds); we just rotate that group a hair per frame so the
//      sky reads as alive. Zero new geometry, zero new draw calls.
//   2. A small flock of distant BIRDS — one merged mesh of a handful of little
//      "M"-shaped silhouettes that slowly circles high overhead, far enough away
//      to read as wildlife, never close enough to demand detail. One draw call.
//
// Performance guardrails honoured:
//   * One extra draw call total (the birds). Clouds add zero.
//   * Every added mesh is tagged userData.__toonDone (so the cel-shade/outline
//     pass skips it) and userData.noCollide (so colliders skip it).
//   * frustumCulled stays true; meshes are pushed into scene.userData.outdoor so
//     they vanish underground / upstairs with the rest of the scenery.
//   * No per-frame allocations: all temporaries are module-scoped and reused.

import * as THREE from '../vendor/three.module.js';

(function () {
  'use strict';

  // --- tuning knobs ----------------------------------------------------------
  const CLOUD_DRIFT = 0.0042;     // radians/sec the cloud canopy slowly turns
  const BIRD_COUNT = 7;           // little silhouettes in the flock (one mesh)
  const FLOCK_RADIUS = 78;        // how far out the flock circles
  const FLOCK_HEIGHT = 58;        // height of the flock overhead
  const FLOCK_SPEED = 0.045;      // radians/sec the whole flock orbits
  const FLAP_SPEED = 6.5;         // wing-beat rate
  const FLAP_AMOUNT = 0.34;       // wing-tip rise/fall (local units)

  // --- reused temporaries (NO per-frame allocation) --------------------------
  const _v = new THREE.Vector3();

  // Build the flock as a single merged mesh of `BIRD_COUNT` little wedges. We
  // store, per bird, its base offset + a per-vertex "wing factor" so we can flap
  // the wing tips by writing the position attribute in place each frame.
  function makeFlock() {
    // One bird = 4 verts forming a shallow "M": tip-L, shoulder-L(=body), and
    // mirrored on the right. Two triangles. Wing tips carry wingFactor = 1; the
    // body verts carry 0, so only the tips rise/fall when we flap.
    const perBird = 4;
    const verts = BIRD_COUNT * perBird;
    const positions = new Float32Array(verts * 3);
    const base = new Float32Array(verts * 3);   // immutable rest pose
    const wingFactor = new Float32Array(verts);
    const indices = [];

    // Each bird gets a fixed angular slot + slightly varied radius/height so the
    // flock reads as a loose skein, not a rigid ring.
    const slot = [];
    for (let b = 0; b < BIRD_COUNT; b++) {
      const ang = (b / BIRD_COUNT) * Math.PI * 2;
      slot.push({
        ang,
        r: FLOCK_RADIUS * (0.78 + ((b * 0.137) % 0.4)),
        h: FLOCK_HEIGHT + ((b * 7) % 18) - 9,
        phase: b * 1.7,            // desynchronised wing-beats
        scale: 1.1 + ((b * 0.31) % 0.7),
      });
    }

    let vi = 0;
    for (let b = 0; b < BIRD_COUNT; b++) {
      const o = vi;
      const s = slot[b].scale;
      // local layout (x = wingspan, z = body depth), y added by flap
      // 0: left tip, 1: body-left, 2: body-right, 3: right tip
      const lay = [
        [-1.6 * s, 0, 0.2 * s, 1],   // left tip  (wingFactor 1)
        [-0.2 * s, 0, -0.5 * s, 0],  // body-left
        [0.2 * s, 0, -0.5 * s, 0],   // body-right
        [1.6 * s, 0, 0.2 * s, 1],    // right tip (wingFactor 1)
      ];
      for (let k = 0; k < perBird; k++) {
        const idx = (o + k) * 3;
        base[idx] = lay[k][0]; base[idx + 1] = lay[k][1]; base[idx + 2] = lay[k][2];
        positions[idx] = lay[k][0]; positions[idx + 1] = lay[k][1]; positions[idx + 2] = lay[k][2];
        wingFactor[o + k] = lay[k][3];
      }
      // two tris: tip-L/body-L/body-R and body-R/right-tip/body-L  (double-sided mat)
      indices.push(o + 0, o + 1, o + 2, o + 2, o + 3, o + 1);
      vi += perBird;
    }

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    // Bird silhouettes — flat, dark, unlit so they read as distant specks against
    // the bright sky. fog:true so they fade naturally into the haze. No outline.
    const mat = new THREE.MeshBasicMaterial({
      color: 0x2c2a30, transparent: true, opacity: 0.82,
      side: THREE.DoubleSide, fog: true, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = -1;
    mesh.userData.__toonDone = true;   // cel-shade/outline pass skips it
    mesh.userData.noCollide = true;    // colliders skip it
    mesh.userData.__birds = { posAttr, base, wingFactor, slot, perBird };
    return mesh;
  }

  // Flap + orbit the flock by writing the position attribute in place.
  function updateFlock(mesh, t) {
    const d = mesh.userData.__birds;
    const { posAttr, base, wingFactor, slot, perBird } = d;
    const arr = posAttr.array;
    const orbit = t * FLOCK_SPEED;
    for (let b = 0; b < slot.length; b++) {
      const sl = slot[b];
      const a = sl.ang + orbit;
      const cx = Math.cos(a) * sl.r;
      const cz = Math.sin(a) * sl.r;
      const cy = sl.h + Math.sin(t * 0.5 + sl.phase) * 2.0;   // gentle bob
      // heading: face along the tangent of the circle so wings sweep correctly
      const hx = -Math.sin(a), hz = Math.cos(a);
      const sx = Math.cos(a), sz = Math.sin(a);   // "side" (radial) axis
      const flap = Math.sin(t * FLAP_SPEED + sl.phase) * FLAP_AMOUNT;
      const o = b * perBird;
      for (let k = 0; k < perBird; k++) {
        const vIdx = o + k;
        const bi = vIdx * 3;
        const lx = base[bi];        // local wingspan (along side axis)
        const lz = base[bi + 2];    // local depth (along heading axis)
        const wy = base[bi + 1] + wingFactor[vIdx] * flap;
        // world = center + lx*side + lz*heading, y lifted by flap
        arr[bi] = cx + lx * sx + lz * hx;
        arr[bi + 1] = cy + wy;
        arr[bi + 2] = cz + lx * sz + lz * hz;
      }
    }
    posAttr.needsUpdate = true;
  }

  function start(game) {
    const scene = game.scene;
    if (!scene) { setTimeout(() => start(game), 500); return; }

    const clouds = scene.userData.clouds || null;   // existing merged cloud group

    const flock = makeFlock();
    scene.add(flock);
    // Vanish with the rest of the outdoor scenery (underground / upstairs).
    if (Array.isArray(scene.userData.outdoor)) scene.userData.outdoor.push(flock);

    const clock = new THREE.Clock();

    function tick() {
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = clock.elapsedTime;

      // Only animate when the flock is actually shown (it's toggled off with the
      // outdoor scenery), so we burn nothing underground / in interiors.
      if (flock.visible) {
        updateFlock(flock, t);
        if (clouds && clouds.visible) {
          clouds.rotation.y = t * CLOUD_DRIFT;   // slow canopy drift, zero alloc
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    if (window.console) console.log('[worldAmbience] sky life online (drift + flock)');
  }

  // Poll for the game, then start. Mirrors ambient.js's lifecycle.
  function waitForGame() {
    const g = window.eldenmoor;
    if (g && g.scene) { start(g); return; }
    setTimeout(waitForGame, 500);
  }
  waitForGame();
})();
