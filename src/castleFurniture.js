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

// ---- small procedural props (cel-shade exempt, no extra downloads) ----------
// A royal carpet runner — deep red with a woven gold border. Lays flat on floor.
let _runnerTex = null;
function runnerTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#6e1422'; x.fillRect(0, 0, 64, 256);
  x.fillStyle = '#5a0f1b'; for (let i = 0; i < 256; i += 16) x.fillRect(0, i, 64, 2);
  x.strokeStyle = '#cda23e'; x.lineWidth = 4; x.strokeRect(5, 0, 54, 256);
  x.lineWidth = 2; x.strokeRect(12, 0, 40, 256);
  x.fillStyle = '#cda23e';
  for (let i = 16; i < 256; i += 40) { x.beginPath(); x.moveTo(32, i); x.lineTo(40, i + 8); x.lineTo(32, i + 16); x.lineTo(24, i + 8); x.closePath(); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; return t;
}
function addRunner(root, x, z, len, w = 3.2, y = 0.09) {
  if (!_runnerTex) _runnerTex = runnerTexture();
  const tex = _runnerTex.clone(); tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, Math.max(1, Math.round(len / 4))); tex.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z);
  m.receiveShadow = true; m.userData.__toonDone = true; m.userData.noCollide = true;
  root.add(m); return m;
}

// A tall standing heraldic banner against a wall (cloth + simple gold trim).
let _hbTex = null;
function heraldTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#2a3f72'; x.fillRect(0, 0, 64, 160);
  x.strokeStyle = '#cda23e'; x.lineWidth = 5; x.strokeRect(4, 4, 56, 152);
  x.fillStyle = '#cda23e'; x.beginPath(); x.moveTo(32, 40); x.lineTo(50, 80); x.lineTo(32, 120); x.lineTo(14, 80); x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function addBanner(root, x, z, ry, h = 4.4, w = 1.8, top = 5.2) {
  if (!_hbTex) _hbTex = heraldTexture();
  const g = new THREE.Group();
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: _hbTex, side: THREE.DoubleSide, roughness: 0.9 }));
  cloth.position.y = top - h / 2; cloth.castShadow = true;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, w + 0.4, 8), new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.9 }));
  rod.rotation.z = Math.PI / 2; rod.position.y = top;
  g.add(cloth, rod);
  g.position.set(x, 0, z); g.rotation.y = ry;
  g.traverse((o) => { if (o.isMesh) o.userData.__toonDone = true; o.userData.noCollide = true; });
  root.add(g); return g;
}

// A simple place setting (plate + goblet) to make feast tables feel lived-in.
function addPlaceSetting(root, x, z, y = 1.35) {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.06, 14), new THREE.MeshStandardMaterial({ color: 0xd9d2c2, roughness: 0.6 }));
  const goblet = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.26, 10), new THREE.MeshStandardMaterial({ color: 0xc9a23e, metalness: 0.3, roughness: 0.5 }));
  goblet.position.set(0.42, 0.13, 0.1);
  g.add(plate, goblet);
  g.position.set(x, y, z);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.__toonDone = true; o.userData.noCollide = true; } });
  root.add(g); return g;
}

// ---- Ground floor: the grand throne room ------------------------------------
function furnishGround(floor) {
  const root = new THREE.Group(); root.name = 'castle-furniture'; floor.add(root);
  const put = placer(root); const HD = 22;
  put('syn_Throne', 0, HD - 3, Math.PI, 1.95, 0.55);
  put('wj_prop_weapon_rack', -5.5, HD - 3.5, Math.PI, 2.6);
  put('wj_prop_weapon_rack',  5.5, HD - 3.5, Math.PI, 2.6);
  put('wj_prop_candelabra', -3.6, HD - 2.0, 0, 2.2, 0.8); warmLight(root, -3.6, 2.4, HD - 2.0);
  put('wj_prop_candelabra',  3.6, HD - 2.0, 0, 2.2, 0.8); warmLight(root, 3.6, 2.4, HD - 2.0);
  // grand red-and-gold runner sweeping up the central aisle to the dais
  addRunner(root, 0, 0, 36, 3.4);
  // heraldic banners marching down both side walls (clear of doorways)
  for (const sx of [-1, 1]) for (const z of [-15, -5, 5, 15]) addBanner(root, sx * 21.4, z, sx < 0 ? Math.PI / 2 : -Math.PI / 2);
  // pair of tall banners flanking the throne dais
  for (const sx of [-1, 1]) addBanner(root, sx * 8, HD - 0.8, Math.PI, 5.0, 2.0, 5.6);
  for (const sx of [-1, 1]) for (const z of [2, -8]) {
    put('syn_Table', sx * 15, z, 0, 1.4);
    put('syn_Bench', sx * 12.6, z, Math.PI / 2, 1.4);
    put('syn_Bench', sx * 17.4, z, -Math.PI / 2, 1.4);
    put('syn_BarrelFullMead', sx * 15, z + 4, 0, 1.6);
    // place settings down each feast table — lived-in feast hall
    for (const dz of [-1.4, 0, 1.4]) addPlaceSetting(root, sx * 13.6, z + dz, 1.45);
    for (const dz of [-1.4, 0, 1.4]) addPlaceSetting(root, sx * 16.4, z + dz, 1.45);
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
  // a runner leading to the royal solar throne (clear of the central seating rug at z=4)
  addRunner(root, 0, 13, 12, 2.8, 0.12);
  for (const sx of [-1, 1]) addBanner(root, sx * 6, HD - 1.0, Math.PI, 4.0, 1.6, 4.6);
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
  // more wine-cellar storage on the right wall + a stacked crate corner
  for (const z of [-16, -13, -10]) { put('syn_BarrelFullMead', 18, z, 0, 1.6); put('syn_BarrelFullMead', 16.4, z, 0, 1.6); }
  put('syn_Crate', 13, -16, 0.2, 1.3); put('syn_Crate', 14.2, -16, 0.5, 1.1);
  put('syn_Crate', 13.4, -15.6, 0.3, 1.0, 1.3);
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
