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

  for (const s of shops) {
    const g = s.group; if (!g) continue;
    const shell = g.userData.shell, roof = g.userData.roof;
    const hw = g.userData.hw || 6.8, hd = g.userData.hd || 5.8;

    // Hide the procedural roof for good (the glTF building has its own).
    if (roof) roof.visible = false;
    // Hide the procedural shell to start (we're standing outside).
    if (shell) shell.visible = false;

    // Load + place the glTF building over the shop, door toward the shop's door.
    const src = await load(s.glb);
    const o = src.clone(true);
    // Orient: the inn's door is on its -z face; the shop door is on `face`.
    o.rotation.y = (s.face === 1) ? Math.PI : 0;
    // Scale by WIDTH so the building stays proportional (the inn is wide+shallow;
    // matching its depth would blow it up). Its shallow back leaves the shop's
    // rear poking out slightly, but the hidden procedural shell covers that.
    const sz = new THREE.Vector3(); new THREE.Box3().setFromObject(o).getSize(sz);
    o.scale.setScalar((hw * 2 + 1) / (sz.x || 1));
    o.traverse((m) => {
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.userData.__toonDone = true; }
    });
    o.position.set(s.x, 0, s.z);
    const minY = new THREE.Box3().setFromObject(o).min.y;
    o.position.set(s.x, -minY, s.z);
    em.scene.add(o);
    (em.scene.userData.outdoor = em.scene.userData.outdoor || []).push(o);

    // Remove this shop from the roof-toggle list so main.js stops managing it.
    const ents = em.scene.userData.enterables;
    if (ents) { const i = ents.findIndex((e) => e.roof === roof); if (i >= 0) ents.splice(i, 1); }

    live.push({ footprint: { minX: s.x - hw, maxX: s.x + hw, minZ: s.z - hd, maxZ: s.z + hd }, glb: o, shell, inside: false });
  }

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
        if (s.glb) s.glb.visible = !inside;
        if (s.shell) s.shell.visible = inside;
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
