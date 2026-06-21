// storeModels.js — swaps each shop's procedural exterior SHELL for a realistic
// glTF building (BabylonJS inn). Walk-in is preserved exactly like the old shops:
//
//   outside  → glТF building shown, procedural shell hidden
//   inside   → glTF building hidden, procedural shell (walls) shown, roof off
//              so the over-the-shoulder camera sees down into the interior
//
// The procedural walls still collide even while hidden (collision reads geometry,
// not visibility), so the doorway stays a doorway and you reach the shopkeeper.
// The shop itself opens by talking to the shopkeeper NPC — untouched here.
//
// Self-contained: polls for window.eldenmoor and boots itself; main.js only
// needs `import './storeModels.js';`.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const VILLAGE = './assets/models/village/';
const loader = new GLTFLoader();
const cache = {};

function load(name) {
  if (!cache[name]) {
    cache[name] = new Promise((ok, err) =>
      loader.load(VILLAGE + name + '.glb', (g) => ok(g.scene), undefined, err));
  }
  return cache[name];
}

async function swapShops(em) {
  const shops = em.scene.userData.shops || [];
  const live = [];   // { footprint, glb, shell, inside }

  // Phase 1 — IMMEDIATELY hide every procedural shop (roof + the whole group:
  // walls, floor and all interior dressing — counter, shelves, hearth, lanterns).
  // This kills the old-asset-over-the-storefront overlap right away, regardless
  // of how long the glTF buildings take to stream in. Collision is baked from
  // geometry at startup, so hiding the group doesn't open the walls.
  for (const s of shops) {
    const g = s.group; if (!g) continue;
    const roof = g.userData.roof;
    if (roof) roof.visible = false;
    g.visible = false;
    // Stop main.js's roof-toggle from also managing this shop.
    const ents = em.scene.userData.enterables;
    if (ents) { const i = ents.findIndex((e) => e.roof === roof); if (i >= 0) ents.splice(i, 1); }
  }

  // Phase 2 — load + place every glTF storefront IN PARALLEL. On failure, re-show
  // the procedural shop so a lot is never left empty.
  await Promise.all(shops.map(async (s) => {
    const g = s.group; if (!g) return;
    const roof = g.userData.roof;
    const hw = g.userData.hw || 6.8, hd = g.userData.hd || 5.8;
    try {
      const src = await load(s.glb);
      const o = src.clone(true);
      o.rotation.y = (s.face === 1) ? Math.PI : 0;   // inn door is on -z; face the shop door
      // Scale by WIDTH so the wide+shallow inn stays proportional.
      const sz = new THREE.Vector3(); new THREE.Box3().setFromObject(o).getSize(sz);
      o.scale.setScalar((hw * 2 + 1) / (sz.x || 1));
      o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.userData.__toonDone = true; } });
      o.position.set(s.x, 0, s.z);
      const minY = new THREE.Box3().setFromObject(o).min.y;
      o.position.set(s.x, -minY, s.z);
      em.scene.add(o);
      (em.scene.userData.outdoor = em.scene.userData.outdoor || []).push(o);
      live.push({ footprint: { minX: s.x - hw, maxX: s.x + hw, minZ: s.z - hd, maxZ: s.z + hd }, glb: o, group: g, roof, inside: false });
    } catch (err) {
      console.error('[storeModels] glTF load failed, keeping procedural shop', s.glb, err);
      g.visible = true; if (roof) roof.visible = false;   // fall back to the procedural shop
    }
  }));

  // Per-frame: toggle building vs. interior as the player crosses the threshold.
  function tick() {
    requestAnimationFrame(tick);
    const p = em.player; if (!p) return;
    const onGround = !em.getFloor || em.getFloor() === 0;
    if (!onGround) return;          // the floor system hides all outdoor meshes
    for (const s of live) {
      const f = s.footprint;
      const inside = p.position.x > f.minX && p.position.x < f.maxX &&
                     p.position.z > f.minZ && p.position.z < f.maxZ;
      if (inside !== s.inside) {
        s.inside = inside;
        if (s.glb) s.glb.visible = !inside;          // glTF storefront only when outside
        if (s.group) s.group.visible = inside;       // whole procedural shop only when inside
        if (s.roof) s.roof.visible = false;          // ...but never the roof, so you see in
      }
    }
  }
  tick();
}

// ----- self-initialize --------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(async () => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.player && em.scene.userData.shops) {
      clearInterval(iv);
      try { await swapShops(em); }
      catch (err) { console.error('[storeModels] swap failed', err); }
    } else if (tries > 800) { clearInterval(iv); }
  }, 100);
})();
