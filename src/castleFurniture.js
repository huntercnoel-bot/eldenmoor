// castleFurniture.js — furnishes ALL the castle's rooms (ground throne room,
// upper royal floor, basement cellar) with real glTF models instead of boxes:
// warm Synty mead-hall furniture (throne, feast tables, benches, barrels, crates,
// lamp posts, torches) + detailed "whiskeyjack" hero props (weapon racks,
// candelabra). Pieces are added as CHILDREN of each floor's group
// (scene.userData.keep.{ground,upper,basement}) so they inherit that floor's
// show/hide visibility for free, and live in the castle's local space (gate -z,
// back +z). Tagged __toonDone → no cel-shade. One download, cloned per room.
//
// Self-contained: polls for window.eldenmoor and boots itself.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const DIR = './assets/models/interior/';
const loader = new GLTFLoader();
const cache = {};
const proto = {};

function load(name) {
  if (!cache[name]) cache[name] = new Promise((ok, err) => loader.load(DIR + name + '.glb', (g) => ok(g.scene), undefined, err));
  return cache[name];
}

// make a put(parent) placer that clones a cached prototype into `parent` (local space)
function placer(parent) {
  return (name, x, z, ry = 0, s = 1, y = null) => {
    const src = proto[name]; if (!src) return null;
    const o = src.clone(true);
    o.rotation.y = ry; o.scale.setScalar(s);
    o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.userData.__toonDone = true; } });
    o.position.set(x, 0, z);
    if (y == null) { const minY = new THREE.Box3().setFromObject(o).min.y; o.position.y = -minY; }
    else o.position.y = y;
    parent.add(o);
    return o;
  };
}
const warmLight = (root, x, y, z, i = 5, d = 16) => { const l = new THREE.PointLight(0xffa53a, i, d, 2); l.position.set(x, y, z); root.add(l); };

// ---- Ground floor: the grand throne room ------------------------------------
function furnishGround(floor) {
  const root = new THREE.Group(); root.name = 'castle-furniture'; floor.add(root);
  const put = placer(root); const HD = 22;
  put('syn_Throne', 0, HD - 3, Math.PI, 1.95, 0.55);
  put('wj_prop_weapon_rack', -5.5, HD - 3.5, Math.PI, 2.6);
  put('wj_prop_weapon_rack',  5.5, HD - 3.5, Math.PI, 2.6);
  put('wj_prop_candelabra', -3.6, HD - 2.0, 0, 2.2, 0.8); warmLight(root, -3.6, 2.4, HD - 2.0);
  put('wj_prop_candelabra',  3.6, HD - 2.0, 0, 2.2, 0.8); warmLight(root, 3.6, 2.4, HD - 2.0);
  for (const sx of [-1, 1]) for (const z of [2, -8]) {
    put('syn_Table', sx * 15, z, 0, 1.4);
    put('syn_Bench', sx * 12.6, z, Math.PI / 2, 1.4);
    put('syn_Bench', sx * 17.4, z, -Math.PI / 2, 1.4);
    put('syn_BarrelFullMead', sx * 15, z + 4, 0, 1.6);
  }
  for (const sx of [-1, 1]) {
    put('syn_Crate', sx * 19, HD - 4, 0, 1.5);
    put('syn_Crate', sx * 19, HD - 5.4, 0.4, 1.3);
    put('syn_BarrelFullMead', sx * 20, HD - 6.5, 0, 1.7);
  }
  for (const sx of [-1, 1]) for (const z of [-13, -2, 13]) { put('syn_LampPostHanging', sx * 10.5, z, 0, 1.4); warmLight(root, sx * 10.5, 3.2, z); }
  for (const sx of [-1, 1]) for (const z of [-15, -5, 5, 15]) {
    put('syn_TorchHolder', sx * 21.5, z, sx < 0 ? Math.PI / 2 : -Math.PI / 2, 2.0, 2.4);
    put('syn_Torch', sx * 21.2, z, 0, 2.0, 2.6);
    warmLight(root, sx * 20.5, 3.0, z, 4, 12);
  }
}

// ---- Upper floor: royal chamber + war room ----------------------------------
function furnishUpper(floor) {
  const root = new THREE.Group(); root.name = 'castle-furniture-upper'; floor.add(root);
  const put = placer(root); const HD = 21;
  // a throne where the old royal seat box was
  put('syn_Throne', 0, HD - 3, Math.PI, 2.4, 0);
  put('wj_prop_candelabra', -2.8, HD - 2.2, 0, 2.0); warmLight(root, -2.8, 2.4, HD - 2.2);
  put('wj_prop_candelabra',  2.8, HD - 2.2, 0, 2.0); warmLight(root, 2.8, 2.4, HD - 2.2);
  // war room (left): weapon racks flanking the map table
  put('wj_prop_weapon_rack', -16, -7, Math.PI / 2, 2.4);
  put('wj_prop_weapon_rack', -16, -13, Math.PI / 2, 2.4);
  put('syn_BarrelFullMead', -19, -16, 0, 1.5); put('syn_Crate', -17, -16, 0, 1.3);
  // wall torches + a couple of lamp posts
  for (const sx of [-1, 1]) for (const z of [-12, 0, 12]) {
    put('syn_TorchHolder', sx * 21, z, sx < 0 ? Math.PI / 2 : -Math.PI / 2, 1.8, 2.2);
    put('syn_Torch', sx * 20.8, z, 0, 1.8, 2.4); warmLight(root, sx * 20, 2.8, z, 4, 12);
  }
}

// ---- Basement: wine cellar + storeroom --------------------------------------
function furnishBasement(floor) {
  const root = new THREE.Group(); root.name = 'castle-furniture-cellar'; floor.add(root);
  const put = placer(root);
  // storeroom crates (centre-front, replacing the removed boxes)
  for (const p of [[-3, -12], [-1.8, -12], [3, -13], [1.8, -12]]) put('syn_Crate', p[0], p[1], Math.random() * 0.6, 1.3);
  put('syn_Crate', -2.4, -13.2, 0.3, 1.1, 1.3);   // a stacked one
  // wine cellar (left): rows of mead barrels
  for (const z of [-16, -13, -10, -6]) { put('syn_BarrelFullMead', -19, z, 0, 1.6); put('syn_BarrelFullMead', -17.4, z, 0, 1.6); }
  // warmer light from a couple of candelabra
  put('wj_prop_candelabra', -10, -14, 0, 2.0); warmLight(root, -10, 2.2, -14, 5, 13);
  put('wj_prop_candelabra', 8, 0, 0, 2.0); warmLight(root, 8, 2.2, 0, 5, 13);
  // a few crates + a barrel near the storeroom for clutter
  put('syn_Crate', 4, -14, 0.5, 1.2); put('syn_BarrelFullMead', -4, -15, 0, 1.5);
}

async function furnishAll(em) {
  const keep = em.scene.userData.keep; if (!keep) return;
  const names = ['syn_Throne', 'syn_Table', 'syn_Bench', 'syn_BarrelFullMead', 'syn_Crate',
                 'syn_LampPostHanging', 'syn_Torch', 'syn_TorchHolder', 'wj_prop_weapon_rack', 'wj_prop_candelabra'];
  await Promise.all(names.map((n) => load(n).catch(() => {})));
  for (const n of names) { try { proto[n] = await cache[n]; } catch (e) {} }
  if (keep.ground) furnishGround(keep.ground);
  if (keep.upper) furnishUpper(keep.upper);
  if (keep.basement) furnishBasement(keep.basement);
}

(function boot() {
  let tries = 0;
  const iv = setInterval(async () => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.player && em.scene.userData.keep && em.scene.userData.keep.ground) {
      clearInterval(iv);
      try { await furnishAll(em); }
      catch (err) { console.error('[castleFurniture] failed', err); }
    } else if (tries > 800) { clearInterval(iv); }
  }, 100);
})();
