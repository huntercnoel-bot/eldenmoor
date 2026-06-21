// castleFurniture.js — furnishes the throne room with real glTF models instead of
// the old box-throne. Pieces are warm hand-painted Synty mead-hall furniture
// (throne, feast tables, benches, barrels, crates, lamp posts, torches) plus a
// couple of detailed "whiskeyjack" hero props (weapon racks, candelabra).
//
// Everything is added as CHILDREN of the procedural castle ground floor
// (scene.userData.keep.ground), so it inherits the castle's show-when-inside /
// hide-when-outside visibility for free, and sits in the castle's local space
// (gate at -z, throne at the back +z). Tagged __toonDone → no cel-shade.
//
// Self-contained: polls for window.eldenmoor and boots itself.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const DIR = './assets/models/interior/';
const loader = new GLTFLoader();
const cache = {};

function load(name) {
  if (!cache[name]) cache[name] = new Promise((ok, err) => loader.load(DIR + name + '.glb', (g) => ok(g.scene), undefined, err));
  return cache[name];
}

async function furnish(em) {
  const keep = em.scene.userData.keep;
  if (!keep || !keep.ground) return;
  const root = new THREE.Group(); root.name = 'castle-furniture';
  keep.ground.add(root);                 // local space; inherits castle visibility

  const names = ['syn_Throne', 'syn_Table', 'syn_Bench', 'syn_BarrelFullMead', 'syn_Crate',
                 'syn_LampPostHanging', 'syn_Torch', 'syn_TorchHolder', 'wj_prop_weapon_rack', 'wj_prop_candelabra'];
  await Promise.all(names.map((n) => load(n).catch(() => {})));
  const proto = {};
  for (const n of names) { try { proto[n] = await cache[n]; } catch (e) {} }

  // place a clone at local (x,z), planted on the floor (or a given y), rotated, scaled
  const put = (name, x, z, ry = 0, s = 1, y = null) => {
    const src = proto[name]; if (!src) return null;
    const o = src.clone(true);
    o.rotation.y = ry; o.scale.setScalar(s);
    o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.userData.__toonDone = true; } });
    o.position.set(x, 0, z);
    if (y == null) { const minY = new THREE.Box3().setFromObject(o).min.y; o.position.y = -minY; }
    else o.position.y = y;
    root.add(o);
    return o;
  };
  const warmLight = (x, y, z) => { const l = new THREE.PointLight(0xffa53a, 5, 16, 2); l.position.set(x, y, z); root.add(l); };

  const HD = 22;                          // castle half-depth (throne at the back, +z)

  // --- the throne on the dais (King stands just in front of it at local z≈16) ---
  put('syn_Throne', 0, HD - 3, Math.PI, 3.0, 0.8);           // dais top ≈ 0.8
  // detailed weapon racks flanking the throne
  put('wj_prop_weapon_rack', -5.5, HD - 3.5, Math.PI, 2.6);
  put('wj_prop_weapon_rack',  5.5, HD - 3.5, Math.PI, 2.6);
  // candelabra on the dais corners (warm light)
  put('wj_prop_candelabra', -3.6, HD - 2.0, 0, 2.2, 0.8); warmLight(-3.6, 2.4, HD - 2.0);
  put('wj_prop_candelabra',  3.6, HD - 2.0, 0, 2.2, 0.8); warmLight(3.6, 2.4, HD - 2.0);

  // --- feast tables + benches down the two sides of the hall ---
  for (const sx of [-1, 1]) for (const z of [2, -8]) {
    put('syn_Table', sx * 15, z, 0, 1.4);
    put('syn_Bench', sx * 12.6, z, Math.PI / 2, 1.4);
    put('syn_Bench', sx * 17.4, z, -Math.PI / 2, 1.4);
    put('syn_BarrelFullMead', sx * 15, z + 4, 0, 1.6);
  }
  // crates + barrels stacked in the back corners
  for (const sx of [-1, 1]) {
    put('syn_Crate', sx * 19, HD - 4, 0, 1.5);
    put('syn_Crate', sx * 19, HD - 5.4, 0.4, 1.3);
    put('syn_BarrelFullMead', sx * 20, HD - 6.5, 0, 1.7);
  }

  // --- lamp posts lining the royal aisle (clear of the stairs at local ±8, 3) ---
  for (const sx of [-1, 1]) for (const z of [-13, -2, 13]) { put('syn_LampPostHanging', sx * 10.5, z, 0, 1.4); warmLight(sx * 10.5, 3.2, z); }

  // --- wall torches along the side walls ---
  for (const sx of [-1, 1]) for (const z of [-15, -5, 5, 15]) {
    put('syn_TorchHolder', sx * 21.5, z, sx < 0 ? Math.PI / 2 : -Math.PI / 2, 2.0, 2.4);
    put('syn_Torch', sx * 21.2, z, 0, 2.0, 2.6);
    warmLight(sx * 20.5, 3.0, z);
  }

  return root;
}

(function boot() {
  let tries = 0;
  const iv = setInterval(async () => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.player && em.scene.userData.keep && em.scene.userData.keep.ground) {
      clearInterval(iv);
      try { await furnish(em); }
      catch (err) { console.error('[castleFurniture] failed', err); }
    } else if (tries > 800) { clearInterval(iv); }
  }, 100);
})();
